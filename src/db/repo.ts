import type { Actor, Location, MovementType, Product } from '../types';
import { AppError, makeRef, norm } from '../lib/util';

/* ------------------------------------------------------------------ users */



/* -------------------------------------------------------------- locations */

export async function listLocations(
  db: D1Database,
  storeId: number,
  activeOnly = true,
): Promise<Location[]> {
  const sql = `
    SELECT *
    FROM locations
    WHERE store_id = ?
      ${activeOnly ? 'AND active = 1' : ''}
    ORDER BY is_default DESC, code
  `;

  const { results } = await db
    .prepare(sql)
    .bind(storeId)
    .all<Location>();

  return results ?? [];
}

export async function getLocation(
  db: D1Database,
  storeId: number,
  id: number,
): Promise<Location | null> {
  return db
    .prepare(`
      SELECT *
      FROM locations
      WHERE id = ?
        AND store_id = ?
    `)
    .bind(id, storeId)
    .first<Location>();
}

export async function defaultLocation(
  db: D1Database,
  storeId: number,
): Promise<Location | null> {
  return db
    .prepare(`
      SELECT *
      FROM locations
      WHERE store_id = ?
        AND active = 1
      ORDER BY is_default DESC, id
      LIMIT 1
    `)
    .bind(storeId)
    .first<Location>();
}

/** หาคลังจากคำที่ผู้ใช้พิมพ์ เช่น "MAIN" หรือ "คลังกลาง" หรือ "หน้าร้าน" */
export async function findLocationByKeyword(
  db: D1Database,
  storeId: number,
  keyword: string,
): Promise<Location | null> {
  const k = norm(keyword);
  if (!k) return null;
  const all = await listLocations(db, storeId, true);
  return (
    all.find((l) => norm(l.code) === k || norm(l.name) === k) ??
    all.find((l) => norm(l.name).includes(k) || norm(l.code).includes(k)) ??
    null
  );
}
 export async function createLocation(
  db: D1Database,
   storeId: number,
  code: string,
  name: string,
  isDefault = false,
): Promise<Location> {

  const newCode = code.trim().toUpperCase();
  const newName = name.trim();

  if (!newCode) {
    throw new AppError('กรุณาระบุรหัสคลัง');
  }

  if (!newName) {
    throw new AppError('กรุณาระบุชื่อคลัง');
  }

  // ตรวจสอบรหัสคลังซ้ำเฉพาะคลังที่ยังใช้งานอยู่
  const dupCode = await db
  .prepare(
    `SELECT id
     FROM locations
     WHERE store_id = ?
       AND UPPER(TRIM(code)) = UPPER(TRIM(?))
       AND active = 1
     LIMIT 1`,
  )
  .bind(storeId, newCode)
  .first();

  if (dupCode) {
    throw new AppError(`รหัสคลัง ${newCode} ถูกใช้งานแล้ว`);
  }

  // ตรวจสอบชื่อคลังซ้ำเฉพาะคลังที่ยังใช้งานอยู่
  const dupName = await db
  .prepare(
    `SELECT id
     FROM locations
     WHERE store_id = ?
       AND LOWER(TRIM(name)) = LOWER(TRIM(?))
       AND active = 1
     LIMIT 1`,
  )
  .bind(storeId, newName)
  .first();

  if (dupName) {
    throw new AppError(`ชื่อคลัง "${newName}" ถูกใช้งานแล้ว`);
  }

  const row = await db
    .prepare(
      `INSERT INTO locations
       (code, name, is_default)
       VALUES (?, ?, ?, ?)
       RETURNING *`,
    )
    .bind(
  storeId,
  newCode,
  newName,
  isDefault ? 1 : 0,
)
    .first<Location>();

  if (!row) {
    throw new AppError('ไม่สามารถเพิ่มคลังสินค้าได้');
  }

  if (isDefault) {
  await db
    .prepare(
      `UPDATE locations
       SET is_default = 0
       WHERE store_id = ?
         AND id != ?`,
    )
    .bind(storeId, row.id)
    .run();
}

  return row;
 }
  
  export async function updateLocation(
  db: D1Database,
  storeId: number,
  id: number,
  patch: Partial<Location>,
): Promise<Location | null> {

  const current = await getLocation(db, storeId, id);

  if (!current) {
    throw new AppError('ไม่พบคลังที่ต้องการแก้ไข', 404);
  }

  const nextCode = (
    patch.code ?? current.code
  ).trim().toUpperCase();

  const nextName = (
    patch.name ?? current.name
  ).trim();

  const nextDefault =
    patch.is_default ?? current.is_default;

  const nextActive =
    patch.active ?? current.active;

  if (!nextCode) {
    throw new AppError('กรุณาระบุรหัสคลัง');
  }

  if (!nextName) {
    throw new AppError('กรุณาระบุชื่อคลัง');
  }

  // ตรวจสอบรหัสคลังซ้ำ
  // ตรวจเฉพาะคลังที่ยัง active = 1
  const dupCode = await db
  .prepare(
    `SELECT id
     FROM locations
     WHERE store_id = ?
       AND UPPER(TRIM(code)) = UPPER(TRIM(?))
       AND id != ?
       AND active = 1
     LIMIT 1`,
  )
  .bind(storeId, nextCode, id)
  .first();

  if (dupCode) {
    throw new AppError(`รหัสคลัง ${nextCode} ถูกใช้งานแล้ว`);
  }

  // ตรวจสอบชื่อคลังซ้ำ
  // ตรวจเฉพาะคลังที่ยัง active = 1
  const dupName = await db
  .prepare(
    `SELECT id
     FROM locations
     WHERE store_id = ?
       AND LOWER(TRIM(name)) = LOWER(TRIM(?))
       AND id != ?
       AND active = 1
     LIMIT 1`,
  )
  .bind(storeId, nextName, id)
  .first();

  if (dupName) {
    throw new AppError(`ชื่อคลัง "${nextName}" ถูกใช้งานแล้ว`);
  }

  await db
  .prepare(
    `UPDATE locations
     SET code = ?,
         name = ?,
         is_default = ?,
         active = ?
     WHERE id = ?
       AND store_id = ?`,
  )
  .bind(
    nextCode,
    nextName,
    nextDefault ? 1 : 0,
    nextActive ? 1 : 0,
    id,
    storeId,
  )
  .run();

  // ถ้าตั้งเป็นคลังหลัก
  // ให้ยกเลิกคลังหลักอื่น
  if (nextDefault) {
  await db
    .prepare(
      `UPDATE locations
       SET is_default = 0
       WHERE store_id = ?
         AND id != ?`,
    )
    .bind(storeId, id)
    .run();
}

  return getLocation(db, storeId, id);
}
  
  
  


export async function deleteLocation(
  db: D1Database,
  storeId: number,
  id: number,
): Promise<void> {
  const used = await db
  .prepare(`
    SELECT COUNT(*) AS c
    FROM stock_levels s
    INNER JOIN products p ON p.id = s.product_id
    WHERE s.location_id = ?
      AND s.store_id = ?
      AND p.store_id = ?
      AND p.active = 1
      AND ABS(s.qty) > 0.000001
  `)
  .bind(id, storeId, storeId)
  .first<{ c: number }>();

  if ((used?.c ?? 0) > 0) {
    throw new AppError(
      'คลังนี้ยังมีสินค้าคงเหลืออยู่ ย้ายสินค้าออกก่อนจึงจะลบได้'
    );
  }

  await db
  .prepare(
    `UPDATE locations
     SET active = 0
     WHERE id = ?
       AND store_id = ?`,
  )
  .bind(id, storeId)
  .run();
}

/* --------------------------------------------------------------- products */

export interface ProductWithStock extends Product {
  total_qty: number;
  location_count: number;
}

export async function searchProducts(
  db: D1Database,
  storeId: number,
  query: string,
  limit = 20,
): Promise<ProductWithStock[]> {
  const terms = norm(query).split(' ').filter(Boolean).slice(0, 5);
  const where: string[] = [
  'p.active = 1',
  'p.store_id = ?',
];
  const binds: unknown[] = [storeId];
  for (const t of terms) {
    where.push('(LOWER(p.name) LIKE ? OR LOWER(p.sku) LIKE ? OR LOWER(p.category) LIKE ? OR p.barcode = ?)');
    binds.push(`%${t}%`, `%${t}%`, `%${t}%`, t);
  }
  const sql = `
    SELECT p.*,
           COALESCE(
  (SELECT SUM(qty)
   FROM stock_levels s
   WHERE s.product_id = p.id
     AND s.store_id = p.store_id),
  0
) AS total_qty,
           (SELECT COUNT(*)
 FROM stock_levels s
 WHERE s.product_id = p.id
   AND s.store_id = p.store_id
   AND s.qty > 0) AS location_count,
    FROM products p
    WHERE ${where.join(' AND ')}
    ORDER BY
      CASE WHEN LOWER(p.name) = ? THEN 0
           WHEN LOWER(p.sku)  = ? THEN 0
           WHEN p.barcode     = ? THEN 0
           WHEN LOWER(p.name) LIKE ? THEN 1
           ELSE 2 END,
      p.name
    LIMIT ?`;
  const q = norm(query);
  const { results } = await db
    .prepare(sql)
    .bind(...binds, q, q, q, `${q}%`, limit)
    .all<ProductWithStock>();
  return results ?? [];
}

export async function listProducts(
  db: D1Database,
  storeId: number,
  opts: {
    q?: string;
    locationId?: number;
    status?: 'all' | 'low' | 'out';
    limit?: number;
  } = {},
): Promise<ProductWithStock[]> {
  const limit = opts.limit ?? 200;
  const binds: unknown[] = [storeId];
const where: string[] = [
  'p.active = 1',
  'p.store_id = ?',
];
  

  if (opts.q && opts.q.trim()) {
    where.push('(LOWER(p.name) LIKE ? OR LOWER(p.sku) LIKE ? OR LOWER(p.category) LIKE ? OR p.barcode LIKE ?)');
    const like = `%${norm(opts.q)}%`;
    binds.push(like, like, like, like);
  }

  const qtyExpr = opts.locationId
  ? 'COALESCE((SELECT SUM(qty) FROM stock_levels s WHERE s.product_id = p.id AND s.store_id = p.store_id AND s.location_id = ?), 0)'
  : 'COALESCE((SELECT SUM(qty) FROM stock_levels s WHERE s.product_id = p.id AND s.store_id = p.store_id), 0)';
  const qtyBinds = opts.locationId ? [opts.locationId] : [];

  let having = '';
  if (opts.status === 'low') having = `HAVING total_qty > 0 AND total_qty <= p.min_qty`;
  else if (opts.status === 'out') having = `HAVING total_qty <= 0`;

  const sql = `
    SELECT p.*, ${qtyExpr} AS total_qty,
           (SELECT COUNT(*)
 FROM stock_levels s
 WHERE s.product_id = p.id
   AND s.store_id = p.store_id
   AND s.qty > 0) AS location_count
    FROM products p
    WHERE ${where.join(' AND ')}
    GROUP BY p.id
    ${having}
    ORDER BY p.name
    LIMIT ?`;

  // ลำดับ bind: qtyExpr อยู่ใน SELECT จึงมาก่อน WHERE
  const { results } = await db.prepare(sql).bind(...qtyBinds, ...binds, limit).all<ProductWithStock>();
  return results ?? [];
}

export async function getProduct(
  db: D1Database,
  storeId: number,
  id: number,
): Promise<Product | null> {
  return db
  .prepare(
    `SELECT *
     FROM products
     WHERE id = ?
       AND store_id = ?`,
  )
  .bind(id, storeId)
  .first<Product>();
}

export async function getProductByBarcode(
  db: D1Database,
  storeId: number,
  barcode: ref,
): Promise<Product | null> {
  return db
  .prepare(
    `SELECT *
     FROM products
     WHERE (barcode = ? OR sku = ?)
       AND active = 1
       AND store_id = ?`,
  )
  .bind(
    barcode.trim(),
    barcode.trim(),
    storeId,
  )
  .first<Product>();
}

export async function createProduct(
  db: D1Database,
  storeId: number,
  input: Partial<Product>,
): Promise<Product> {
  if (!input.name?.trim()) throw new AppError('กรุณาระบุชื่อสินค้า');
  const sku = input.sku?.trim() || (await nextSku(db, storeId));
  const dup = await db
  .prepare(
    `SELECT id
     FROM products
     WHERE store_id = ?
       AND sku = ?`,
  )
  .bind(storeId, sku)
  .first();
  if (dup) throw new AppError(`รหัสสินค้า ${sku} ถูกใช้ไปแล้ว`);
  if (input.barcode?.trim()) {
    const dupBc = await db
  .prepare(
    `SELECT id
     FROM products
     WHERE store_id = ?
       AND barcode = ?`,
  )
  .bind(
    storeId,
    input.barcode.trim(),
  )
  .first();
    if (dupBc) throw new AppError(`บาร์โค้ด ${input.barcode.trim()} ถูกใช้ไปแล้ว`);
  }
  const row = await db
    .prepare(
      `INSERT INTO products
 (store_id, sku, barcode, name, category, unit, min_qty, note)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
       
    )
    .bind(
      storeId,
      sku,
      input.barcode?.trim() || null,
      input.name.trim(),
      input.category?.trim() || null,
      input.unit?.trim() || 'ชิ้น',
      Number(input.min_qty ?? 0),
      input.note?.trim() || null,
    )
    .first<Product>();
  return row!;
}

async function nextSku(
  db: D1Database,
  storeId: number,
): Promise<string> {
  const row = await db
  .prepare(
    `SELECT COUNT(*) AS c
     FROM products
     WHERE store_id = ?`,
  )
  .bind(storeId)
  .first<{ c: number }>();
  return `SKU-${String((row?.c ?? 0) + 1).padStart(4, '0')}`;
}

export async function updateProduct(
  db: D1Database,
  storeId: number,
  id: number,
  patch: Partial<Product>,
): Promise<Product | null> {
  const current = await getProduct(db, storeId, id);
  if (!current) throw new AppError('ไม่พบสินค้า', 404);
    const sku = (patch.sku ?? current.sku).trim();

  if (sku !== current.sku) {
    const dupSku = await db
  .prepare(
    `SELECT id
     FROM products
     WHERE store_id = ?
       AND sku = ?
       AND id != ?`,
  )
  .bind(storeId, sku, id)
  .first();

    if (dupSku) {
      throw new AppError(`รหัสสินค้า ${sku} ถูกใช้ไปแล้ว`);
    }
  }
  const barcode = patch.barcode !== undefined ? patch.barcode?.trim() || null : current.barcode;
  if (barcode && barcode !== current.barcode) {
    const dup = await db
  .prepare(
    `SELECT id
     FROM products
     WHERE store_id = ?
       AND barcode = ?
       AND id != ?`,
  )
  .bind(storeId, barcode, id)
  .first();
    if (dup) throw new AppError(`บาร์โค้ด ${barcode} ถูกใช้ไปแล้ว`);
  }
  await db
    .prepare(
      `UPDATE products SET sku = ?, barcode = ?, name = ?, category = ?, unit = ?, min_qty = ?, note = ?, active = ?,
         updated_at = datetime('now')
WHERE id = ?
  AND store_id = ?`,
    )
    .bind(
      sku,
      barcode,
      (patch.name ?? current.name).trim(),
      patch.category !== undefined ? patch.category?.trim() || null : current.category,
      (patch.unit ?? current.unit).trim(),
      Number(patch.min_qty ?? current.min_qty),
      patch.note !== undefined ? patch.note?.trim() || null : current.note,
      patch.active ?? current.active,
id,
storeId,
    
    )
    .run();
  return getProduct(db, storeId, id);
}

export async function archiveProduct(
  db: D1Database,
  storeId: number,
  id: number,
  actor: Actor,
): Promise<void> {
  const product = await db
    .prepare(
      `SELECT id, name
 FROM products
 WHERE id = ?
   AND store_id = ?
   AND active = 1`,
       
       
    )
    .bind(id, storeId)
    .first<{ id: number; name: string }>();

  if (!product) {
    throw new AppError('ไม่พบสินค้าหรือสินค้าถูกปิดใช้งาน', 404);
  }

  const { results } = await db
  .prepare(
    `SELECT location_id, qty
     FROM stock_levels
     WHERE product_id = ?
       AND store_id = ?`,
  )
  .bind(id, storeId)
  .all<{ location_id: number; qty: number }>();

  const ref = makeRef('ARC');

  const statements: D1PreparedStatement[] = [];

  for (const row of results ?? []) {
    // ปรับยอดสินค้าในคลังเป็น 0
    statements.push(
      db
        .prepare(
          UPDATE stock_levels
SET qty = 0,
    updated_at = datetime('now')
WHERE product_id = ?
  AND location_id = ?
  AND store_id = ?
        )
        .bind(id, row.location_id, storeId)
    );

    // บันทึกประวัติการนำสินค้าออกจากระบบ
    statements.push(
      db
  .prepare(
    INSERT INTO movements
(
  store_id,
  ref,
  type,
  product_id,
  location_id,
  qty,
  delta,
  balance_after,
  note,
  actor_name,
  source
)
VALUES (?, ?, 'archive', ?, ?, ?, ?, 0, ?, ?, ?)
  )
  .bind(
    storeId,
    ref,
    id,
    row.location_id,
    Math.abs(row.qty),
    -row.qty,
    'นำสินค้าออกจากระบบ',
    actor.name,
    actor.source,
  ),
 );
}

  // ปิดสินค้า
  statements.push(
    db
      .prepare(
        `UPDATE products
SET active = 0,
    updated_at = datetime('now')
WHERE id = ?
  AND store_id = ?
      )
      .bind(id, storeId)
  );

  // ทำทั้งหมดเป็นชุดเดียว
  await db.batch(statements);
}
/* ----------------------------------------------------------------- stock */

export interface LevelRow {
  location_id: number;
  code: string;
  name: string;
  qty: number;
}

export async function getLevels(
  db: D1Database,
  storeId: number,
  productId: number,
): Promise<LevelRow[]> {
  const { results } = await db
    .prepare(
      `SELECT l.id AS location_id, l.code, l.name, COALESCE(s.qty, 0) AS qty
       FROM locations l
       LEFT JOIN stock_levels s
  ON s.location_id = l.id
 AND s.product_id = ?
 AND s.store_id = ?
       WHERE l.active = 1
       AND l.store_id = ?
       ORDER BY l.is_default DESC, l.code`,
    )
    .bind(productId, storeId, storeId)
    .all<LevelRow>();
  return results ?? [];
}


export async function getQty(
  db: D1Database,
  storeId: number,
  productId: number,
  locationId: number,
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT qty
       FROM stock_levels
       WHERE store_id = ?
         AND product_id = ?
         AND location_id = ?`,
    )
    .bind(storeId, productId, locationId)
    .first<{ qty: number }>();

  return row?.qty ?? 0;
}
export async function totalQty(
  db: D1Database,
  storeId: number,
  productId: number,
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(qty), 0) AS q
       FROM stock_levels
       WHERE store_id = ?
         AND product_id = ?`,
    )
    .bind(storeId, productId)
    .first<{ q: number }>();

  return row?.q ?? 0;
}

/** บวก/ลบสต๊อกแบบกันติดลบ (atomic ที่ระดับ statement) */
async function addStock(
  db: D1Database,
  storeId: number,
  productId: number,
  locationId: number,
  delta: number,
): Promise<number> {
  const location = await db
    .prepare(
      `SELECT id
       FROM locations
       WHERE id = ?
         AND store_id = ?
         AND active = 1`,
    )
    .bind(locationId, storeId)
    .first();

  if (!location) {
    throw new AppError('ไม่พบคลังหรือคลังถูกปิดใช้งาน');
  }

  await db
    .prepare(
      `INSERT OR IGNORE INTO stock_levels
       (store_id, product_id, location_id, qty)
       VALUES (?, ?, ?, 0)`,
    )
    .bind(storeId, productId, locationId)
    .run();

  const row = await db
    .prepare(
      `UPDATE stock_levels
       SET qty = qty + ?,
           updated_at = datetime('now')
       WHERE store_id = ?
         AND product_id = ?
         AND location_id = ?
         AND qty + ? >= 0
       RETURNING qty`,
    )
    .bind(
      delta,
      storeId,
      productId,
      locationId,
      delta,
    )
    .first<{ qty: number }>();

  if (!row) {
    const have = await getQty(
      db,
      storeId,
      productId,
      locationId,
    );

    throw new AppError(
      `สต๊อกไม่พอ (คงเหลือ ${have})`,
    );
  }

  return row.qty;
}

async function logMovement(
  db: D1Database,
  args: {
    ref: string;
    type: MovementType;
    storeId: number;
    productId: number;
    locationId: number;
    qty: number;
    delta: number;
    balanceAfter: number;
    note?: string | null;
    actor: Actor;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO movements
 (store_id, ref, type, product_id, location_id, qty, delta, balance_after, note, actor_name, source)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      args.storeId,
      args.ref,
      args.type,
      args.productId,
      args.locationId,
      Math.abs(args.qty),
      args.delta,
      args.balanceAfter,
      args.note ?? null,
      args.actor.name,
      args.actor.source,
    )
    .run();
}

export interface MovementResult {
  ref: string;
  balanceAfter: number;
  balanceAfterTo?: number;
  total: number;
}

/** เบิกออก */
export async function issue(
  db: D1Database,
  storeId: number,
  productId: number,
  locationId: number,
  qty: number,
  note: string | null,
  actor: Actor,
): Promise<MovementResult> {
  if (qty <= 0) throw new AppError('จำนวนต้องมากกว่า 0');
  const ref = makeRef('OUT');
  const balance = await addStock(
  db,
  storeId,
  productId,
  locationId,
  -qty,
);
  await logMovement(db, {
    storeId,
    ref, type: 'issue', productId, locationId, qty, delta: -qty, balanceAfter: balance, note, actor,
  });
  return { ref, balanceAfter: balance, total: await totalQty(db, storeId, productId) };
}

/** รับเข้า */
export async function receive(
  db: D1Database,
  storeId: number,
  productId: number,
  locationId: number,
  qty: number,
  note: string | null,
  actor: Actor,
): Promise<MovementResult> {
  if (qty <= 0) throw new AppError('จำนวนต้องมากกว่า 0');
  const ref = makeRef('IN');
  const balance = await addStock(
  db,
  storeId,
  productId,
  locationId,
  qty,
);
  await logMovement(db, {
    storeId, ref, type: 'receive', productId, locationId, qty, delta: qty, balanceAfter: balance, note, actor,
  });
  return { ref, balanceAfter: balance, total: await totalQty(db, storeId, productId) };
}

/** ปรับยอดให้เท่ากับจำนวนที่นับได้จริง */
export async function adjust(
  db: D1Database,
  storeId: number,
  productId: number,
  locationId: number,
  targetQty: number,
  note: string | null,
  actor: Actor,
): Promise<MovementResult> {
  if (targetQty < 0) throw new AppError('จำนวนคงเหลือติดลบไม่ได้');
  const ref = makeRef('ADJ');
  await db
    .prepare(
  `INSERT OR IGNORE INTO stock_levels
   (store_id, product_id, location_id, qty)
   VALUES (?, ?, ?, 0)`,
)
.bind(storeId, productId, locationId)
    .run();

  let delta = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await getQty(db, storeId, productId, locationId);
    delta = targetQty - current;
    const row = await db
      .prepare(
         `UPDATE stock_levels SET qty = ?, updated_at = datetime('now')
 WHERE store_id = ? AND product_id = ? AND location_id = ? AND qty = ? RETURNING qty`,
      )
      .bind(targetQty, storeId, productId, locationId, current)
      .first<{ qty: number }>();
    if (row) {
      await logMovement(db, {
        ref, type: 'adjust', productId, locationId, qty: Math.abs(delta), delta,
        balanceAfter: row.qty, note, actor,
      });
      return { ref, balanceAfter: row.qty, total: await totalQty(db, productId) };
    }
  }
  throw new AppError('ปรับยอดไม่สำเร็จ มีการแก้ไขสต๊อกพร้อมกัน กรุณาลองใหม่');
}


/** ย้ายระหว่างคลัง */
export async function transfer(
  db: D1Database,
  productId: number,
  fromId: number,
  toId: number,
  qty: number,
  note: string | null,
  actor: Actor,
): Promise<MovementResult> {
  if (qty <= 0) {
    throw new AppError('จำนวนต้องมากกว่า 0');
  }

  if (fromId === toId) {
    throw new AppError('คลังต้นทางและปลายทางต้องต่างกัน');
  }

  // ตรวจสอบสินค้า
  const product = await db
    .prepare(
      'SELECT id FROM products WHERE id = ? AND active = 1',
    )
    .bind(productId)
    .first();

  if (!product) {
    throw new AppError('ไม่พบสินค้าหรือสินค้าถูกปิดใช้งาน');
  }

  // ตรวจสอบคลังต้นทาง
  const fromLocation = await db
    .prepare(
      'SELECT id FROM locations WHERE id = ? AND active = 1',
    )
    .bind(fromId)
    .first();

  if (!fromLocation) {
    throw new AppError('ไม่พบคลังต้นทางหรือคลังถูกปิดใช้งาน');
  }

  // ตรวจสอบคลังปลายทาง
  const toLocation = await db
    .prepare(
      'SELECT id FROM locations WHERE id = ? AND active = 1',
    )
    .bind(toId)
    .first();

  if (!toLocation) {
    throw new AppError('ไม่พบคลังปลายทางหรือคลังถูกปิดใช้งาน');
  }

  // สร้าง stock_levels ทั้งสองฝั่งหากยังไม่มี
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO stock_levels
         (product_id, location_id, qty)
         VALUES (?, ?, 0)`,
      )
      .bind(productId, fromId),

    db
      .prepare(
        `INSERT OR IGNORE INTO stock_levels
         (product_id, location_id, qty)
         VALUES (?, ?, 0)`,
      )
      .bind(productId, toId),
  ]);

  /*
   * อ่านยอดปัจจุบันก่อนทำรายการ
   */
  const fromBefore = await getQty(db, productId, fromId);
  const toBefore = await getQty(db, productId, toId);

  if (fromBefore < qty) {
    throw new AppError(`สต๊อกไม่พอ (คงเหลือ ${fromBefore})`);
  }

  const fromBalance = fromBefore - qty;
  const toBalance = toBefore + qty;
  const ref = makeRef('TRF');

  /*
   * ย้ายสต๊อกแบบ atomic batch
   *
   * จุดสำคัญ:
   * การเพิ่มปลายทางจะเกิดขึ้นเฉพาะเมื่อ
   * คลังต้นทางมีจำนวนเพียงพอในขณะทำ batch
   */
  const result = await db.batch([
    // หักจากต้นทาง
    db
      .prepare(
        `UPDATE stock_levels
         SET qty = qty - ?, updated_at = datetime('now')
         WHERE product_id = ?
           AND location_id = ?
           AND qty >= ?`,
      )
      .bind(qty, productId, fromId, qty),

    // เพิ่มปลายทาง
    db
      .prepare(
        `UPDATE stock_levels
         SET qty = qty + ?, updated_at = datetime('now')
         WHERE product_id = ?
           AND location_id = ?
           AND EXISTS (
             SELECT 1
             FROM stock_levels
             WHERE product_id = ?
               AND location_id = ?
               AND qty >= 0
           )`,
      )
      .bind(
        qty,
        productId,
        toId,
        productId,
        fromId,
      ),

    // ประวัติย้ายออก
    db
      .prepare(
        `INSERT INTO movements
         (ref, type, product_id, location_id, qty, delta,
          balance_after, note, actor_name, source)
         VALUES (?, 'transfer_out', ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        ref,
        productId,
        fromId,
        qty,
        -qty,
        fromBalance,
        note ?? null,
        actor.name,
        actor.source,
      ),

    // ประวัติย้ายเข้า
    db
      .prepare(
        `INSERT INTO movements
         (ref, type, product_id, location_id, qty, delta,
          balance_after, note, actor_name, source)
         VALUES (?, 'transfer_in', ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        ref,
        productId,
        toId,
        qty,
        qty,
        toBalance,
        note ?? null,
        actor.name,
        actor.source,
      ),
  ]);

  // ตรวจสอบผลการ UPDATE ต้นทาง
  if (result[0].meta.changes !== 1) {
    throw new AppError(
      'ย้ายคลังไม่สำเร็จ เนื่องจากยอดสต๊อกเปลี่ยนแปลง กรุณาลองใหม่',
    );
  }

  return {
    ref,
    balanceAfter: fromBalance,
    balanceAfterTo: toBalance,
    total: await totalQty(db, productId),
  };
}
  
  

  

/* ------------------------------------------------------------- movements */

export interface MovementRow {
  id: number;
  ref: string;
  type: MovementType;
  qty: number;
  delta: number;
  balance_after: number;
  note: string | null;
  actor_name: string | null;
  source: string;
  created_at: string;
  product_name: string;
  sku: string;
  unit: string;
  location_name: string;
  location_code: string;
}
export async function listMovements(
  db: D1Database,
  opts: {
    productId?: number;
    locationId?: number;
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {},
): Promise<MovementRow[]> {
  const where: string[] = [];
  const binds: unknown[] = [];

  if (opts.productId) {
    where.push('m.product_id = ?');
    binds.push(opts.productId);
  }

  if (opts.locationId) {
    where.push('m.location_id = ?');
    binds.push(opts.locationId);
  }

  /*
   * วันที่เริ่มต้น
   *
   * created_at ในฐานข้อมูลเป็น UTC
   * จึงแปลงเป็นเวลาไทย (+7 ชั่วโมง) ก่อนเปรียบเทียบ
   */
  if (opts.startDate) {
    where.push(`date(m.created_at, '+7 hours') >= date(?)`);
    binds.push(opts.startDate);
  }

  /*
   * วันที่สิ้นสุด
   *
   * ใช้ <= endDate หลังแปลงเป็นเวลาไทย
   */
  if (opts.endDate) {
    where.push(`date(m.created_at, '+7 hours') <= date(?)`);
    binds.push(opts.endDate);
  }

  const sql = `
    SELECT
      m.id,
      m.ref,
      m.type,
      m.qty,
      m.delta,
      m.balance_after,
      m.note,
      m.actor_name,
      m.source,
      m.created_at,

      p.name AS product_name,
      p.sku,
      p.unit,

      l.name AS location_name,
      l.code AS location_code

    FROM movements m

    JOIN products p
      ON p.id = m.product_id

    JOIN locations l
      ON l.id = m.location_id

    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}

    ORDER BY m.id DESC

    LIMIT ?
  `;

  const limit = Math.min(
    Math.max(Number(opts.limit ?? 50), 1),
    200,
  );

  const { results } = await db
    .prepare(sql)
    .bind(...binds, limit)
    .all<MovementRow>();

  return results ?? [];
}

/* --------------------------------------------------------------- reports */

export async function lowStockProducts(db: D1Database, limit = 50): Promise<ProductWithStock[]> {
  const { results } = await db
    .prepare(
      `SELECT p.*, COALESCE((SELECT SUM(qty) FROM stock_levels s WHERE s.product_id = p.id), 0) AS total_qty,
              (SELECT COUNT(*) FROM stock_levels s WHERE s.product_id = p.id AND s.qty > 0) AS location_count
       FROM products p
       WHERE p.active = 1 AND p.min_qty > 0
         AND COALESCE((SELECT SUM(qty) FROM stock_levels s WHERE s.product_id = p.id), 0) <= p.min_qty
       ORDER BY (COALESCE((SELECT SUM(qty) FROM stock_levels s WHERE s.product_id = p.id), 0) - p.min_qty), p.name
       LIMIT ?`,
    )
    .bind(limit)
    .all<ProductWithStock>();
  return results ?? [];
}

export interface Summary {
  productCount: number;
  locationCount: number;
  totalUnits: number;
  lowCount: number;
  outCount: number;
  todayIssue: number;
  todayReceive: number;
  todayMovements: number;
}

export async function getSummary(db: D1Database): Promise<Summary> {
  const row = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM products WHERE active = 1) AS productCount,
        (SELECT COUNT(*) FROM locations WHERE active = 1) AS locationCount,
        (SELECT COALESCE(SUM(s.qty), 0) FROM stock_levels s JOIN products p ON p.id = s.product_id WHERE p.active = 1) AS totalUnits,
        (SELECT COUNT(*) FROM products p WHERE p.active = 1 AND p.min_qty > 0
           AND COALESCE((SELECT SUM(qty) FROM stock_levels s WHERE s.product_id = p.id), 0) <= p.min_qty
           AND COALESCE((SELECT SUM(qty) FROM stock_levels s WHERE s.product_id = p.id), 0) > 0) AS lowCount,
        (SELECT COUNT(*) FROM products p WHERE p.active = 1
           AND COALESCE((SELECT SUM(qty) FROM stock_levels s WHERE s.product_id = p.id), 0) <= 0) AS outCount,
        (SELECT COALESCE(SUM(qty), 0) FROM movements WHERE type = 'issue' AND date(created_at, '+7 hours') = date('now', '+7 hours')) AS todayIssue,
        (SELECT COALESCE(SUM(qty), 0) FROM movements WHERE type = 'receive' AND date(created_at, '+7 hours') = date('now', '+7 hours')) AS todayReceive,
        (SELECT COUNT(*) FROM movements WHERE date(created_at, '+7 hours') = date('now', '+7 hours')) AS todayMovements`,
    )
    .first<Summary>();
  return (
    row ?? {
      productCount: 0, locationCount: 0, totalUnits: 0, lowCount: 0,
      outCount: 0, todayIssue: 0, todayReceive: 0, todayMovements: 0,
    }
  );
}


export interface WebUser {
  id: number;
  username: string;
  display_name: string;
  active: number;
  role: string;
  store_id: number;
  created_at: string;
  last_login_at: string | null;
}

export async function getWebUserByUsername(
  db: D1Database,
  username: string,
): Promise<WebUser | null> {
  return db
    .prepare(
      `SELECT id, username, display_name, active, role, store_id, created_at, last_login_at
       FROM web_users
       WHERE username = ?`,
    )
    .bind(username.trim())
    .first<WebUser>();
}

export async function getWebUserById(
  db: D1Database,
  id: number,
): Promise<WebUser | null> {
  return db
    .prepare(
      `SELECT id, username, display_name, active, role, store_id, created_at, last_login_at
       FROM web_users
       WHERE id = ?`,
    )
    .bind(id)
    .first<WebUser>();
}

export async function listWebUsers(
  db: D1Database,
): Promise<WebUser[]> {
  const result = await db
    .prepare(
      `SELECT
         id,
         username,
         display_name,
         active,
         role,
         store_id,
         created_at,
         last_login_at
       FROM web_users
       ORDER BY id`,
    )
    .all<WebUser>();

  return result.results ?? [];
}

export async function createWebUser(
  db: D1Database,
  username: string,
  passwordHash: string,
  displayName: string,
  role: string = 'user',
): Promise<WebUser> {
  const row = await db
    .prepare(
      `INSERT INTO web_users
       (username, password_hash, display_name, role)
       VALUES (?, ?, ?, ?)
       RETURNING id, username, display_name, active, role, created_at, last_login_at`,
    )
    .bind(username.trim(), passwordHash, displayName.trim(),
          role,
         )
    .first<WebUser>();

  if (!row) throw new AppError('สร้างบัญชี Admin ไม่สำเร็จ');
  return row;
}

export async function getWebUserPasswordHash(
  db: D1Database,
  username: string,
): Promise<{ id: number; password_hash: string; active: number; store_id: number; } | null> {
  return db
    .prepare(
      `SELECT id, password_hash, active, store_id
       FROM web_users
       WHERE username = ?`,
    )
    .bind(username.trim())
    .first<{ id: number; password_hash: string; active: number; store_id: number; }>();
}
export async function updateWebUserPassword(
  db: D1Database,
  userId: number,
  passwordHash: string,
): Promise<void> {
  const result = await db
    .prepare(
      `UPDATE web_users
       SET password_hash = ?
       WHERE id = ?`,
    )
    .bind(passwordHash, userId)
    .run();

  if (result.meta.changes !== 1) {
    throw new AppError('ไม่สามารถเปลี่ยนรหัสผ่านได้');
  }
}
export async function updateWebUserProfile(
  db: D1Database,
  userId: number,
  username: string,
  displayName: string,
): Promise<WebUser> {
  const cleanUsername = username.trim();
  const cleanDisplayName = displayName.trim();

  if (!cleanUsername) {
    throw new AppError('กรุณาระบุชื่อผู้ใช้');
  }

  if (!cleanDisplayName) {
    throw new AppError('กรุณาระบุชื่อที่แสดง');
  }

  // ตรวจสอบชื่อผู้ใช้ซ้ำ
  const duplicate = await db
    .prepare(
      `SELECT id
       FROM web_users
       WHERE username = ?
         AND id != ?
       LIMIT 1`,
    )
    .bind(cleanUsername, userId)
    .first<{ id: number }>();

  if (duplicate) {
    throw new AppError('ชื่อผู้ใช้นี้ถูกใช้งานแล้ว');
  }

  const result = await db
    .prepare(
      `UPDATE web_users
       SET username = ?,
           display_name = ?
       WHERE id = ?`,
    )
    .bind(
      cleanUsername,
      cleanDisplayName,
      userId,
    )
    .run();

  if (result.meta.changes !== 1) {
    throw new AppError('ไม่สามารถแก้ไขข้อมูลผู้ใช้ได้');
  }

  const user = await getWebUserById(db, userId);

  if (!user) {
    throw new AppError('ไม่พบผู้ใช้');
  }

  return user;
}

export async function updateWebUserRoleStatus(
  db: D1Database,
  userId: number,
  role: string,
  active: number,
): Promise<WebUser> {
  if (role !== 'user' && role !== 'admin') {
    throw new AppError('สิทธิ์ผู้ใช้ไม่ถูกต้อง');
  }

  if (active !== 0 && active !== 1) {
    throw new AppError('สถานะผู้ใช้ไม่ถูกต้อง');
  }

  const result = await db
    .prepare(
      `UPDATE web_users
       SET role = ?,
           active = ?
       WHERE id = ?`,
    )
    .bind(
      role,
      active,
      userId,
    )
    .run();

  if (result.meta.changes !== 1) {
    throw new AppError('ไม่สามารถแก้ไขสิทธิ์ผู้ใช้ได้');
  }

  const user = await getWebUserById(db, userId);

  if (!user) {
    throw new AppError('ไม่พบผู้ใช้');
  }

  return user;
}

export async function updateWebUserLogin(
  db: D1Database,
  id: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE web_users
       SET last_login_at = datetime('now')
       WHERE id = ?`,
    )
    .bind(id)
    .run();
}

export async function createWebSession(
  db: D1Database,
  tokenHash: string,
  userId: number,
  expiresAt: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO web_sessions
       (token_hash, user_id, expires_at)
       VALUES (?, ?, ?)`,
    )
    .bind(tokenHash, userId, expiresAt)
    .run();
}

export async function getWebSession(
  db: D1Database,
  tokenHash: string,
): Promise<{ user_id: number; expires_at: number } | null> {
  return db
    .prepare(
      `SELECT user_id, expires_at
       FROM web_sessions
       WHERE token_hash = ?`,
    )
    .bind(tokenHash)
    .first<{ user_id: number; expires_at: number }>();
}

export async function deleteWebSession(
  db: D1Database,
  tokenHash: string,
): Promise<void> {
  await db
    .prepare('DELETE FROM web_sessions WHERE token_hash = ?')
    .bind(tokenHash)
    .run();
}

export async function purgeExpiredWebSessions(
  db: D1Database,
): Promise<void> {
  await db
    .prepare('DELETE FROM web_sessions WHERE expires_at < ?')
    .bind(Date.now())
    .run();
}
