import { Hono } from 'hono';
import type { Env } from '../types';
import * as repo from '../db/repo';
import { AppError } from '../lib/util';
import {
  loginWebUser,
  logoutWebUser,
  requireAuth,
  requireAdmin,
  changeWebUserPassword,
  updateWebUserProfile,
  createWebUserByAdmin,
  type AuthUser,
} from './auth';

type Vars = {
  Variables: {
    user: AuthUser;
  };
  Bindings: Env;
};

export const api = new Hono<Vars>();

/* -------------------------------------------------------------- web auth */

api.post('/login', async (c) => {
  const body = await c.req.json<{
    username?: string;
    password?: string;
  }>();

  return loginWebUser(
    c,
    body.username ?? '',
    body.password ?? '',
  );
});

api.post('/logout', (c) => {
  return logoutWebUser(c);
});

api.use('/*', requireAuth);

api.get('/me', (c) => c.json(c.get('user')));

/* ---------------------------------------------------------- admin users */
api.get('/admin/stores', requireAdmin, async (c) => {
  const stores = await repo.listStores(c.env.DB);
  return c.json({ stores });
});

api.post('/admin/stores', requireAdmin, async (c) => {
  const body = await c.req.json<{
    code?: string;
    name?: string;
  }>();

  const code = body.code?.trim() ?? '';
  const name = body.name?.trim() ?? '';

  if (!code || !name) {
    return c.json(
      { error: 'กรุณาระบุรหัสร้านและชื่อร้าน' },
      400,
    );
  }

  const result = await c.env.DB
    .prepare(
      `
      INSERT INTO stores (
        code,
        name
      )
      VALUES (?, ?)
      `,
    )
    .bind(code, name)
    .run();

  return c.json(
    {
      id: result.meta.last_row_id,
      code,
      name,
      active: 1,
    },
    201,
  );
});

api.get('/admin/users', requireAdmin, async (c) => {
  const users = await repo.listWebUsers(c.env.DB);

  return c.json({
    users,
  });
});

api.post('/admin/users', requireAdmin, async (c) => {
  const body = await c.req.json<{
    username?: string;
    displayName?: string;
    password?: string;
    role?: string;
  }>();

  return createWebUserByAdmin(
    c,
    body.username ?? '',
    body.displayName ?? '',
    body.password ?? '',
    body.role ?? 'user',
  );
});

api.post('/admin/users/:id/role-status', requireAdmin, async (c) => {
  const userId = Number(c.req.param('id'));

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError('รหัสผู้ใช้ไม่ถูกต้อง');
  }

  const body = await c.req.json<{
    role?: string;
    active?: boolean | number;
  }>();

  const role = body.role ?? 'user';
  const active = body.active ? 1 : 0;

  const user = await repo.updateWebUserRoleStatus(
    c.env.DB,
    userId,
    role,
    active,
  );

  return c.json(user);
});

/* -------------------------------------------------------------- password */

api.post('/users/:id/password', async (c) => {
  const targetUserId = Number(c.req.param('id'));

  if (
    !Number.isInteger(targetUserId) ||
    targetUserId <= 0
  ) {
    throw new AppError('รหัสผู้ใช้ไม่ถูกต้อง');
  }

  const currentUser = c.get('user');

  if (
    targetUserId !== currentUser.id &&
    currentUser.role !== 'admin'
  ) {
    return c.json(
      { error: 'ไม่มีสิทธิ์แก้ไขบัญชีผู้ใช้นี้' },
      403,
    );
  }

  const body = await c.req.json<{
    newPassword?: string;
  }>();

  const newPassword = body.newPassword ?? '';

  return changeWebUserPassword(
    c,
    targetUserId,
    newPassword,
  );
});

api.post('/users/:id/profile', async (c) => {
  const targetUserId = Number(c.req.param('id'));

  if (
    !Number.isInteger(targetUserId) ||
    targetUserId <= 0
  ) {
    throw new AppError('รหัสผู้ใช้ไม่ถูกต้อง');
  }

  const currentUser = c.get('user');

  if (
    targetUserId !== currentUser.id &&
    currentUser.role !== 'admin'
  ) {
    return c.json(
      { error: 'ไม่มีสิทธิ์แก้ไขบัญชีผู้ใช้นี้' },
      403,
    );
  }

  const body = await c.req.json<{
    username?: string;
    displayName?: string;
  }>();

  const username = body.username ?? '';
  const displayName = body.displayName ?? '';

  return updateWebUserProfile(
    c,
    targetUserId,
    username,
    displayName,
  );
});

/* -------------------------------------------------------------- summary */

api.get('/summary', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const storeId = user.store_id;

  const [
    summary,
    low,
    recent,
    locations,
  ] = await Promise.all([
    repo.getSummary(
      db,
      storeId,
    ),

    repo.lowStockProducts(
      db,
      storeId,
      8,
    ),

    repo.listMovements(
      db,
      storeId,
      {
        limit: 12,
      },
    ),

    repo.listLocations(
      db,
      storeId,
      true,
    ),
  ]);

  const byLocation = await db
    .prepare(
      `SELECT
         l.id,
         l.code,
         l.name,

         COALESCE(
           SUM(
             CASE
               WHEN p.active = 1
               THEN s.qty
               ELSE 0
             END
           ),
           0
         ) AS units,

         COUNT(
           CASE
             WHEN p.active = 1
              AND s.qty > 0
             THEN 1
           END
         ) AS items

       FROM locations l

       LEFT JOIN stock_levels s
         ON s.location_id = l.id
        AND s.store_id = l.store_id

       LEFT JOIN products p
         ON p.id = s.product_id
        AND p.store_id = s.store_id

       WHERE l.active = 1
         AND l.store_id = ?

       GROUP BY
         l.id,
         l.code,
         l.name,
         l.is_default

       ORDER BY
         l.is_default DESC,
         l.code`,
    )
    .bind(storeId)
    .all();

  return c.json({
    summary,
    low,
    recent,
    locations,
    byLocation: byLocation.results ?? [],
  });
});

/* ------------------------------------------------------------ locations */

api.get('/locations', async (c) => {
  const user = c.get('user');

  return c.json(
    await repo.listLocations(
      c.env.DB,
      user.store_id,
      false,
    ),
  );
});

api.post('/locations', async (c) => {
  const body = await c.req.json<{
    code: string;
    name: string;
    is_default?: boolean;
  }>();

  if (
    !body.code?.trim() ||
    !body.name?.trim()
  ) {
    throw new AppError(
      'กรุณากรอกรหัสและชื่อคลัง',
    );
  }

  const user = c.get('user');

  return c.json(
    await repo.createLocation(
      c.env.DB,
      user.store_id,
      body.code,
      body.name,
      !!body.is_default,
    ),
    201,
  );
});

api.put('/locations/:id', async (c) => {
  const body =
    await c.req.json<Record<string, unknown>>();

  const patch: Record<string, unknown> = {
    ...body,
  };

  if ('is_default' in body) {
    patch.is_default = body.is_default ? 1 : 0;
  }

  if ('active' in body) {
    patch.active = body.active ? 1 : 0;
  }

  const user = c.get('user');

  return c.json(
    await repo.updateLocation(
      c.env.DB,
      user.store_id,
      Number(c.req.param('id')),
      patch as never,
    ),
  );
});

api.delete('/locations/:id', async (c) => {
  const user = c.get('user');

  await repo.deleteLocation(
    c.env.DB,
    user.store_id,
    Number(c.req.param('id')),
  );

  return c.json({
    ok: true,
  });
});

/* ------------------------------------------------------------- products */

api.get('/products', async (c) => {
  const user = c.get('user');

  const q =
    c.req.query('q') ?? '';

  const locationId =
    c.req.query('locationId')
      ? Number(
          c.req.query('locationId'),
        )
      : undefined;

  const status =
    (c.req.query('status') as
      | 'all'
      | 'low'
      | 'out'
      | undefined) ?? 'all';

  const products =
    await repo.listProducts(
      c.env.DB,
      user.store_id,
      {
        q,
        locationId,
        status,
        limit: 300,
      },
    );

  return c.json(products);
});

api.get(
  '/products/lookup/:code',
  async (c) => {
    const user = c.get('user');

    const product =
      await repo.getProductByBarcode(
        c.env.DB,
        user.store_id,
        c.req.param('code'),
      );

    if (!product) {
      return c.json(
        {
          error:
            'ไม่พบสินค้าที่มีบาร์โค้ดนี้',
        },
        404,
      );
    }

    const levels =
      await repo.getLevels(
        c.env.DB,
        user.store_id,
        product.id,
      );

    return c.json({
      product,
      levels,
    });
  },
);

api.get('/products/:id', async (c) => {
  const user = c.get('user');

  const id =
    Number(c.req.param('id'));

  const product =
    await repo.getProduct(
      c.env.DB,
      user.store_id,
      id,
    );

  if (!product) {
    return c.json(
      {
        error: 'ไม่พบสินค้า',
      },
      404,
    );
  }

  const [
    levels,
    movements,
  ] = await Promise.all([
    repo.getLevels(
      c.env.DB,
      user.store_id,
      id,
    ),

    repo.listMovements(
      c.env.DB,
      user.store_id,
      {
        productId: id,
        limit: 30,
      },
    ),
  ]);

  return c.json({
    product,
    levels,
    movements,
    total: levels.reduce(
      (sum, level) =>
        sum + level.qty,
      0,
    ),
  });
});

api.post('/products', async (c) => {
  const user = c.get('user');

  const body =
    await c.req.json<
      Record<string, unknown>
    >();

  const product =
    await repo.createProduct(
      c.env.DB,
      user.store_id,
      body,
    );

  // ตั้งยอดเริ่มต้นถ้าระบุมา
  const initialQty = Number(
    body.initial_qty ?? 0,
  );

  const locationId = Number(
    body.location_id ?? 0,
  );

  if (
    initialQty > 0 &&
    locationId
  ) {
    const actor = {
      name: user.username,
      source: 'system' as const,
    };

    await repo.receive(
      c.env.DB,
      user.store_id,
      product.id,
      locationId,
      initialQty,
      'จำนวนเริ่มต้นตอนเพิ่มสินค้า',
      actor,
    );
  }

  return c.json(
    product,
    201,
  );
});

api.put('/products/:id', async (c) => {
  const user = c.get('user');

  const body =
    await c.req.json<
      Record<string, unknown>
    >();

  return c.json(
    await repo.updateProduct(
      c.env.DB,
      user.store_id,
      Number(c.req.param('id')),
      body,
    ),
  );
});

api.delete('/products/:id', async (c) => {
  const user = c.get('user');

  const actor = {
    name: user.username,
    source: 'system' as const,
  };

  await repo.archiveProduct(
    c.env.DB,
    user.store_id,
    Number(c.req.param('id')),
    actor,
  );

  return c.json({
    ok: true,
  });
});

/* ------------------------------------------------------------ movements */

api.get('/movements', async (c) => {
  const user = c.get('user');

  const productId =
    c.req.query('productId')
      ? Number(
          c.req.query('productId'),
        )
      : undefined;

  const locationId =
    c.req.query('locationId')
      ? Number(
          c.req.query('locationId'),
        )
      : undefined;

  const startDate =
    c.req.query('startDate')
      ?.trim() || undefined;

  const endDate =
    c.req.query('endDate')
      ?.trim() || undefined;

  const limit = Math.min(
    Math.max(
      Number(
        c.req.query('limit') ?? 60,
      ),
      1,
    ),
    200,
  );

  return c.json(
    await repo.listMovements(
      c.env.DB,
      user.store_id,
      {
        productId,
        locationId,
        startDate,
        endDate,
        limit,
      },
    ),
  );
});

api.post('/movements', async (c) => {
  const body =
    await c.req.json<{
      action:
        | 'issue'
        | 'receive'
        | 'adjust'
        | 'transfer';

      productId: number;
      locationId: number;
      toLocationId?: number;
      qty: number;
      note?: string;
    }>();

  const user = c.get('user');

  const actor = {
    name: user.username,
    source: 'system' as const,
  };

  const db = c.env.DB;
  const storeId = user.store_id;

  const qty = Number(body.qty);

  if (
    !body.productId ||
    !body.locationId
  ) {
    throw new AppError(
      'ข้อมูลไม่ครบ',
    );
  }

  if (!Number.isFinite(qty)) {
    throw new AppError(
      'จำนวนไม่ถูกต้อง',
    );
  }

  let result;

  switch (body.action) {
    case 'issue':
      result = await repo.issue(
        db,
        storeId,
        body.productId,
        body.locationId,
        qty,
        body.note ?? null,
        actor,
      );
      break;

    case 'receive':
      result = await repo.receive(
        db,
        storeId,
        body.productId,
        body.locationId,
        qty,
        body.note ?? null,
        actor,
      );
      break;

    case 'adjust':
      result = await repo.adjust(
        db,
        storeId,
        body.productId,
        body.locationId,
        qty,
        body.note ?? null,
        actor,
      );
      break;

    case 'transfer':
      if (!body.toLocationId) {
        throw new AppError(
          'กรุณาเลือกคลังปลายทาง',
        );
      }

      result = await repo.transfer(
        db,
        storeId,
        body.productId,
        body.locationId,
        body.toLocationId,
        qty,
        body.note ?? null,
        actor,
      );
      break;

    default:
      throw new AppError(
        'ประเภทรายการไม่ถูกต้อง',
      );
  }

  const levels =
    await repo.getLevels(
      db,
      storeId,
      body.productId,
    );

  return c.json({
    ...result,
    levels,
  });
});
