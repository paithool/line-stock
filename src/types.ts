export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;

  ENVIRONMENT?: string;

  WEB_ADMIN_USERNAME?: string;
  WEB_ADMIN_PASSWORD?: string;
  WEB_ADMIN_DISPLAY_NAME?: string;
}

export type MovementType =
  | 'issue'
  | 'receive'
  | 'adjust'
  | 'transfer_out'
  | 'transfer_in'
  | 'archive';

export type ActionType =
  | 'issue'
  | 'receive'
  | 'adjust'
  | 'transfer';

export interface Product {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  category: string | null;
  unit: string;
  min_qty: number;
  note: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: number;
  code: string;
  name: string;
  is_default: number;
  active: number;
}

export interface Actor {
  name: string | null;
  source: 'system';
}
