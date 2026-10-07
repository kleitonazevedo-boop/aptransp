/**
 * Camada de acesso ao banco local SQLite (aptransp.db).
 *
 * - Android/iOS (Capacitor): plugin nativo @capacitor-community/sqlite.
 * - Web (preview/desenvolvimento): jeep-sqlite (sql.js/WASM) com persistência em IndexedDB.
 *
 * Nenhuma chamada de rede é feita aqui. 100% offline.
 */
import { Capacitor } from "@capacitor/core";
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from "@capacitor-community/sqlite";
import { MIGRATIONS, LOCAL_USER_ID } from "./migrations";

export const DB_NAME = "aptransp";
export const GTFS_DB_PREFIX = "aptransp_gtfs_";
export { LOCAL_USER_ID };

export type SqlValue = string | number | null;

export interface LocalDb {
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  one<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T | null>;
  transaction(statements: Array<{ sql: string; params?: SqlValue[] }>): Promise<void>;
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
}

const isNative = Capacitor.isNativePlatform();
let sqlite: SQLiteConnection | null = null;
let dbConn: SQLiteDBConnection | null = null;
let initPromise: Promise<LocalDb> | null = null;
let ready = false;
const gtfsConnections = new Map<string, SQLiteDBConnection>();

export function isDatabaseReady() {
  return ready;
}

async function setupWebStore() {
  const { defineCustomElements } = await import("jeep-sqlite/loader");
  defineCustomElements(window);
  if (!document.querySelector("jeep-sqlite")) {
    const el = document.createElement("jeep-sqlite");
    document.body.appendChild(el);
  }
  await customElements.whenDefined("jeep-sqlite");
  await sqlite!.initWebStore();
}

async function persist() {
  if (!isNative) {
    try {
      await sqlite?.saveToStore(DB_NAME);
    } catch (e) {
      console.warn("[db] saveToStore", e);
    }
  }
}

async function runMigrations(conn: SQLiteDBConnection) {
  await conn.execute(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version INTEGER PRIMARY KEY,
       name TEXT NOT NULL,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     );`,
  );
  const res = await conn.query("SELECT version FROM schema_migrations;");
  const applied = new Set((res.values ?? []).map((r) => Number((r as { version: number }).version)));

  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    for (const stmt of m.statements) await conn.execute(stmt);
    await conn.run("INSERT INTO schema_migrations (version, name) VALUES (?, ?);", [m.version, m.name]);
    console.log(`[db] migration ${m.version} (${m.name}) aplicada`);
  }

  // Usuário local padrão (sem autenticação remota)
  await conn.run(
    `INSERT OR IGNORE INTO user_profile (id, nome, is_admin) VALUES (?, ?, 1);`,
    [LOCAL_USER_ID, "Usuário Local"],
  );
}

async function openDatabase(): Promise<LocalDb> {
  sqlite = new SQLiteConnection(CapacitorSQLite);
  if (!isNative) await setupWebStore();

  const existing = (await sqlite.isConnection(DB_NAME, false)).result;
  dbConn = existing
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);

  await dbConn.open();
  await dbConn.execute("PRAGMA foreign_keys = ON;");
  await runMigrations(dbConn);
  await persist();
  ready = true;
  console.log("[db] aptransp.db pronto (offline)");

  const api: LocalDb = {
    async run(sql, params = []) {
      await dbConn!.run(sql, params, false);
      await persist();
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      const r = await dbConn!.query(sql, params);
      return (r.values ?? []) as T[];
    },
    async one<T>(sql: string, params: SqlValue[] = []) {
      const rows = await api.all<T>(sql, params);
      return rows[0] ?? null;
    },
    async beginTransaction() {
      await dbConn!.beginTransaction();
    },
    async commitTransaction() {
      await dbConn!.commitTransaction();
      await persist();
    },
    async rollbackTransaction() {
      await dbConn!.rollbackTransaction();
      await persist();
    },
    async transaction(statements) {
      if (!statements.length) return;
      await dbConn!.executeSet(
        statements.map((s) => ({ statement: s.sql, values: (s.params ?? []) as SqlValue[] })),
        false,
      );
      await persist();
    },
  };
  return api;
}

/** Inicializa (idempotente) e devolve a API do banco local. */
export function getDb(): Promise<LocalDb> {
  if (!initPromise) {
    initPromise = openDatabase().catch((e) => {
      initPromise = null;
      console.error("[db] falha ao abrir aptransp.db", e);
      throw e;
    });
  }
  return initPromise;
}


function wrapConnection(conn: SQLiteDBConnection, shouldPersist = false): LocalDb {
  const api: LocalDb = {
    async run(sql, params = []) {
      await conn.run(sql, params, false);
      if (shouldPersist) await persist();
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      const r = await conn.query(sql, params);
      return (r.values ?? []) as T[];
    },
    async one<T>(sql: string, params: SqlValue[] = []) {
      const rows = await api.all<T>(sql, params);
      return rows[0] ?? null;
    },
    async beginTransaction() { await conn.beginTransaction(); },
    async commitTransaction() {
      await conn.commitTransaction();
      if (shouldPersist) await persist();
    },
    async rollbackTransaction() {
      await conn.rollbackTransaction();
      if (shouldPersist) await persist();
    },
    async transaction(statements) {
      if (!statements.length) return;
      await conn.executeSet(
        statements.map((s) => ({ statement: s.sql, values: (s.params ?? []) as SqlValue[] })),
        false,
      );
      if (shouldPersist) await persist();
    },
  };
  return api;
}

/** Nome lógico do snapshot GTFS baixado pelo plugin nativo. */
export function gtfsDatabaseName(version: string) {
  return `${GTFS_DB_PREFIX}${version}`;
}

/** Abre um snapshot GTFS já instalado, sem executar migrations do banco principal. */
export async function getGtfsSnapshotDb(version: string): Promise<LocalDb> {
  if (!isNative) throw new Error("Snapshot GTFS remoto está disponível somente no app nativo");
  await getDb();
  const name = gtfsDatabaseName(version);
  const cached = gtfsConnections.get(name);
  if (cached) return wrapConnection(cached);

  const existing = (await sqlite!.isConnection(name, false)).result;
  const conn = existing
    ? await sqlite!.retrieveConnection(name, false)
    : await sqlite!.createConnection(name, false, "no-encryption", 1, false);
  await conn.open();
  gtfsConnections.set(name, conn);
  return wrapConnection(conn);
}

/** Faz o plugin nativo baixar o .db diretamente para a pasta SQLite do app. */
export async function downloadGtfsSnapshot(url: string): Promise<void> {
  if (!isNative) throw new Error("Download nativo do GTFS disponível somente no app");
  await getDb();
  await CapacitorSQLite.getFromHTTPRequest({ url, overwrite: true });
}

/** Utilitário: id único sem dependências externas. */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Exporta o banco inteiro em JSON (backup local). */
export async function exportDatabaseJson(): Promise<string> {
  await getDb();
  const json = await dbConn!.exportToJson("full");
  return JSON.stringify(json.export ?? {}, null, 2);
}
