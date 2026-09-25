PRAGMA foreign_keys=OFF;

CREATE TABLE movements_new (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ref            TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (
    type IN (
      'issue',
      'receive',
      'adjust',
      'transfer_out',
      'transfer_in',
      'archive'
    )
  ),
  product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id    INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  qty            REAL NOT NULL,
  delta          REAL NOT NULL,
  balance_after  REAL NOT NULL,
  note           TEXT,
  actor_line_id  TEXT,
  actor_name     TEXT,
  source         TEXT NOT NULL DEFAULT 'line'
                 CHECK (source IN ('line','liff','system')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO movements_new (
  id,
  ref,
  type,
  product_id,
  location_id,
  qty,
  delta,
  balance_after,
  note,
  actor_line_id,
  actor_name,
  source,
  created_at
)
SELECT
  id,
  ref,
  type,
  product_id,
  location_id,
  qty,
  delta,
  balance_after,
  note,
  actor_line_id,
  actor_name,
  source,
  created_at
FROM movements;

DROP TABLE movements;

ALTER TABLE movements_new RENAME TO movements;

CREATE INDEX idx_movements_product
ON movements(product_id, id DESC);

CREATE INDEX idx_movements_created
ON movements(created_at DESC);

CREATE INDEX idx_movements_ref
ON movements(ref);

PRAGMA foreign_keys=ON;
