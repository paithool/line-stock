import type { Context, Next } from 'hono';
import type { Env } from '../types';
import * as repo from '../db/repo';

/* ------------------------------------------------------------- web auth */

export interface AuthUser {
  id: number;
  username: string;
  name: string;
}

const SESSION_COOKIE = 'web_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// PBKDF2 สำหรับเก็บรหัสผ่าน
const PASSWORD_ITERATIONS = 120_000;

/* ----------------------------------------------------------- LINE legacy */

/**
 * ผู้ใช้จาก LINE Login เดิม
 * เก็บไว้เพื่อไม่ให้ระบบ LINE เดิมเสีย
 */
export interface LineAuthUser {
  lineUserId: string;
  name: string | null;
  picture: string | null;
}

interface VerifyResponse {
  sub: string;
  name?: string;
  picture?: string;
  aud?: string;
  exp?: number;
}

/** ตรวจ ID token ที่ได้จาก LIFF กับเซิร์ฟเวอร์ของ LINE */
export async function verifyIdToken(
  env: Env,
  idToken: string,
): Promise<LineAuthUser | null> {
  if (!env.LINE_LOGIN_CHANNEL_ID) {
    console.error('LINE_LOGIN_CHANNEL_ID ยังไม่ได้ตั้งค่า');
    return null;
  }

  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: env.LINE_LOGIN_CHANNEL_ID,
    }),
  });

  if (!res.ok) {
    console.warn(
      'verify id_token failed',
      res.status,
      await res.text(),
    );
    return null;
  }

  const data = (await res.json()) as VerifyResponse;

  if (!data.sub) return null;

  return {
    lineUserId: data.sub,
    name: data.name ?? null,
    picture: data.picture ?? null,
  };
}

/* ----------------------------------------------------------- crypto utils */

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);

  const hash = await crypto.subtle.digest('SHA-256', data);

  return bytesToBase64Url(new Uint8Array(hash));
}

/**
 * สร้าง password hash ด้วย PBKDF2
 *
 * รูปแบบ:
 * pbkdf2$sha256$iterations$salt$hash
 */
async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PASSWORD_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256,
  );

  const hash = new Uint8Array(bits);

  return [
    'pbkdf2',
    'sha256',
    PASSWORD_ITERATIONS,
    bytesToBase64Url(salt),
    bytesToBase64Url(hash),
  ].join('$');
}

function constantTimeEqual(
  a: Uint8Array,
  b: Uint8Array,
): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;

  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }

  return diff === 0;
}

async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split('$');

  if (parts.length !== 5) return false;

  const [
    algorithm,
    hashAlgorithm,
    iterationsText,
    saltText,
    expectedHashText,
  ] = parts;

  if (algorithm !== 'pbkdf2') return false;
  if (hashAlgorithm !== 'sha256') return false;

  const iterations = Number(iterationsText);

  if (
    !Number.isInteger(iterations) ||
    iterations < 10_000 ||
    iterations > 1_000_000
  ) {
    return false;
  }

  let salt: Uint8Array;
  let expectedHash: Uint8Array;

  try {
    salt = base64UrlToBytes(saltText);
    expectedHash = base64UrlToBytes(expectedHashText);
  } catch {
    return false;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    key,
    256,
  );

  return constantTimeEqual(
    new Uint8Array(bits),
    expectedHash,
  );
}

function createSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

/* -------------------------------------------------------------- cookies */

function getCookie(
  c: Context,
  name: string,
): string | null {
  const cookieHeader = c.req.header('cookie') ?? '';

  const cookies = cookieHeader.split(';');

  for (const item of cookies) {
    const index = item.indexOf('=');

    if (index === -1) continue;

    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();

    if (key === name) return value;
  }

  return null;
}

function sessionCookie(token: string): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_MS / 1000}`,
  ].join('; ');
}

function clearSessionCookie(): string {
  return [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; ');
}

/* -------------------------------------------------------------- context */

export type AppContext = Context<{
  Bindings: Env;
  Variables: {
    user: AuthUser;
  };
}>;

/* --------------------------------------------------------------- login */

/**
 * สร้าง Admin คนแรกจาก Cloudflare Variables/Secrets
 *
 * จะทำเฉพาะกรณีที่ยังไม่มี web_users เท่านั้น
 */
async function ensureInitialAdmin(
  env: Env,
  username: string,
  password: string,
): Promise<void> {
  if (
    !env.WEB_ADMIN_USERNAME ||
    !env.WEB_ADMIN_PASSWORD
  ) {
    return;
  }

  const cleanAdminUsername =
    env.WEB_ADMIN_USERNAME.trim();

  // ต้องตรงกับ Cloudflare Secret ก่อนจึงจะสร้าง Admin ได้
  if (
    username.trim() !== cleanAdminUsername ||
    password !== env.WEB_ADMIN_PASSWORD
  ) {
    return;
  }

  const existing =
    await repo.getWebUserByUsername(
      env.DB,
      cleanAdminUsername,
    );

  if (existing) return;

  const passwordHash =
    await hashPassword(password);

  try {
    await repo.createWebUser(
      env.DB,
      cleanAdminUsername,
      passwordHash,
      env.WEB_ADMIN_DISPLAY_NAME?.trim() ||
        cleanAdminUsername,
    );
  } catch (err) {
    // ป้องกันกรณีมีการ Login พร้อมกัน 2 ครั้ง
    const created =
      await repo.getWebUserByUsername(
        env.DB,
        cleanAdminUsername,
      );

    if (!created) {
      throw err;
    }
  }
}

export async function loginWebUser(
  c: AppContext,
  username: string,
  password: string,
): Promise<Response> {
  const cleanUsername = username.trim();

  if (!cleanUsername || !password) {
    return c.json(
      { error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' },
      400,
    );
  }

  // สร้าง Admin คนแรก ถ้ายังไม่มีบัญชี
  
await ensureInitialAdmin(
  c.env,
  cleanUsername,
  password,
);
  const account =
    await repo.getWebUserPasswordHash(
      c.env.DB,
      cleanUsername,
    );

  if (!account || account.active !== 1) {
    return c.json(
      { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
      401,
    );
  }

  const passwordOk = await verifyPassword(
    password,
    account.password_hash,
  );

  if (!passwordOk) {
    return c.json(
      { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
      401,
    );
  }

  const user = await repo.getWebUserById(
    c.env.DB,
    account.id,
  );

  if (!user || user.active !== 1) {
    return c.json(
      { error: 'บัญชีผู้ใช้ไม่พร้อมใช้งาน' },
      403,
    );
  }

  const token = createSessionToken();
  const tokenHash = await sha256(token);
  const expiresAt = Date.now() + SESSION_TTL_MS;

  await repo.createWebSession(
    c.env.DB,
    tokenHash,
    user.id,
    expiresAt,
  );

  await repo.updateWebUserLogin(
    c.env.DB,
    user.id,
  );

  const authUser: AuthUser = {
    id: user.id,
    username: user.username,
    name: user.display_name,
  };

  return c.json(
    {
      ok: true,
      user: authUser,
    },
    200,
    {
      'Set-Cookie': sessionCookie(token),
    },
  );
}

/* -------------------------------------------------------------- logout */

export async function logoutWebUser(
  c: AppContext,
): Promise<Response> {
  const token = getCookie(c, SESSION_COOKIE);

  if (token) {
    const tokenHash = await sha256(token);

    await repo.deleteWebSession(
      c.env.DB,
      tokenHash,
    );
  }

  return c.json(
    { ok: true },
    200,
    {
      'Set-Cookie': clearSessionCookie(),
    },
  );
}

/* ----------------------------------------------------------- require auth */

/**
 * ตรวจสอบ Web Session จาก HttpOnly Cookie
 */
export async function requireAuth(
  c: AppContext,
  next: Next,
): Promise<Response | void> {
  const token = getCookie(
    c,
    SESSION_COOKIE,
  );

  if (!token) {
    return c.json(
      { error: 'กรุณาเข้าสู่ระบบ' },
      401,
    );
  }

  const tokenHash = await sha256(token);

  const session =
    await repo.getWebSession(
      c.env.DB,
      tokenHash,
    );

  if (!session) {
    return c.json(
      { error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' },
      401,
    );
  }

  if (session.expires_at < Date.now()) {
    await repo.deleteWebSession(
      c.env.DB,
      tokenHash,
    );

    return c.json(
      { error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' },
      401,
    );
  }

  const user =
    await repo.getWebUserById(
      c.env.DB,
      session.user_id,
    );

  if (!user || user.active !== 1) {
    await repo.deleteWebSession(
      c.env.DB,
      tokenHash,
    );

    return c.json(
      { error: 'บัญชีผู้ใช้ไม่พร้อมใช้งาน' },
      403,
    );
  }

  const authUser: AuthUser = {
    id: user.id,
    username: user.username,
    name: user.display_name,
  };

  c.set('user', authUser);

  // ล้าง session เก่าที่หมดอายุเป็นครั้งคราว
  if (Math.random() < 0.05) {
    c.executionCtx.waitUntil(
      repo.purgeExpiredWebSessions(c.env.DB).catch(() => {}),
    );
  }

  return next();
}
