// SQLite-backed persistence.
// State survives sessions. inv_mass only grows.

import Database from 'better-sqlite3';
import path     from 'path';
import { Receipt, ReceiptStore } from './receipts';
import { Fact, MEMState, SystemDef, superposition } from '../agent/state';

// Read at call time, not module load time — env var is set in boot() before first call
function db_path(): string {
  return process.env.MEM_DB_PATH ?? path.join(process.cwd(), 'mem.db');
}

// Single shared connection per process — opened once, reused everywhere
let _db: Database.Database | null = null;

function openDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(db_path());
  _db.pragma('journal_mode = WAL');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS receipts (
      id        TEXT PRIMARY KEY,
      data      TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS facts (
      id        TEXT PRIMARY KEY,
      data      TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS systems (
      id         TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  return _db;
}

export function makeReceiptStore(): ReceiptStore {
  const db      = openDb();
  const insert  = db.prepare('INSERT OR IGNORE INTO receipts (id, data, timestamp) VALUES (?, ?, ?)');
  const byId    = db.prepare('SELECT data FROM receipts WHERE id = ?');
  const since   = db.prepare('SELECT data FROM receipts WHERE timestamp >= ? ORDER BY timestamp ASC');
  const allRows = db.prepare('SELECT data FROM receipts ORDER BY timestamp ASC');
  const latest  = db.prepare('SELECT data FROM receipts ORDER BY timestamp DESC LIMIT ?');

  return {
    async write(r: Receipt) {
      insert.run(r.id, JSON.stringify(r), r.timestamp);
    },
    async read(id: string) {
      const row = byId.get(id) as { data: string } | undefined;
      return row ? JSON.parse(row.data) as Receipt : null;
    },
    async since(timestamp: number) {
      return (since.all(timestamp) as { data: string }[]).map(r => JSON.parse(r.data) as Receipt);
    },
    async all() {
      return (allRows.all() as { data: string }[]).map(r => JSON.parse(r.data) as Receipt);
    },
    async latest(n: number) {
      return (latest.all(n) as { data: string }[]).map(r => JSON.parse(r.data) as Receipt);
    },
  };
}

export async function loadState(session_id: string): Promise<MEMState> {
  const db    = openDb();
  const facts = (db.prepare('SELECT data FROM facts ORDER BY timestamp ASC').all() as { data: string }[])
    .map(r => JSON.parse(r.data) as Fact);
  const systems = (db.prepare('SELECT data FROM systems ORDER BY created_at ASC').all() as { data: string }[])
    .map(r => JSON.parse(r.data) as SystemDef);
  return superposition(session_id, facts, systems);
}

export function commitFact(fact: Fact): void {
  openDb()
    .prepare('INSERT OR REPLACE INTO facts (id, data, timestamp) VALUES (?, ?, ?)')
    .run(fact.id, JSON.stringify(fact), fact.timestamp);
}

export function commitSystem(system: SystemDef): void {
  openDb()
    .prepare('INSERT OR REPLACE INTO systems (id, data, created_at) VALUES (?, ?, ?)')
    .run(system.id, JSON.stringify(system), system.created_at);
}
