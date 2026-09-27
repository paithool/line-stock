import { Hono } from 'hono';
import type { Env } from './types';
import { api } from './api/routes';
import { AppError } from './lib/util';

const app = new Hono<{ Bindings: Env }>();

app.get('/healthz', (c) => c.json({ ok: true, service: 'line-stock' }));


/* ------------------------------------------------------------ REST API */

app.route('/api', api);

app.onError((err, c) => {
  if (err instanceof AppError) return c.json({ error: err.message }, err.status as 400);
  console.error('unhandled error', err);
  return c.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, 500);
});

/* หน้า Web Admin */
app.notFound(async (c) => {
  if (c.req.path.startsWith('/api') || c.req.path.startsWith('/line')) {
    return c.json({ error: 'ไม่พบเส้นทางนี้' }, 404);
  }
  const url = new URL(c.req.url);
  url.pathname = '/index.html';
  return c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw));
});

export default app;
