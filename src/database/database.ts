/**
 * Camada de acesso ao banco local SQLite (aptransp.db).
 *
 * - Android/iOS (Capacitor): plugin nativo @capacitor-community/sqlite.
 * - Web (preview/desenvolvimento): jeep-sqlite (sql.js/WASM) com persistência em IndexedDB.
 *
 * Nenhuma chamada de rede é feita aqui. 100% offline.
 */
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from "@capacitor-community/sqlite";
import { MIGRATIONS, LOCAL_USER_ID } from "./migrations";

export const DB_NAME = "aptransp";
export { LOCAL_USER_ID };

export type SqlValue = string | number | null;

export interface LocalDb {
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  one<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T | null>;
  transaction(statements: Array<{ sql: string; params?: SqlValue[] }>): Promise<void>;
}

const isNative = Capacitor.isNativePlatform();
let sqlite: SQLiteConnection | null = null;
let dbConn: SQLiteDBConnection | null = null;
let initPromise: Promise<LocalDb> | null = null;
let ready = false;

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

let databaseSource = "existing-local-database";

async function bundledDatabaseSeedExists(): Promise<boolean> {
  if (typeof document === "undefined") return false;
  try {
    const url = new URL("/assets/databases/aptransp.db", document.baseURI);
    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) return false;
    await response.body?.cancel();
    return true;
  } catch {
    return false;
  }
}

async function pragmaScalar(conn: SQLiteDBConnection, sql: string): Promise<unknown> {
  const result = await conn.query(sql);
  const first = (result.values ?? [])[0] as Record<string, unknown> | undefined;
  return first ? (Object.values(first)[0] ?? null) : null;
}

async function logDatabaseDiagnostics(conn: SQLiteDBConnection): Promise<void> {
  const databaseList = await conn.query("PRAGMA database_list;");
  const databaseRows = (databaseList.values ?? []) as Array<Record<string, unknown>>;
  const mainDatabase = databaseRows.find((row) => row.name === "main");
  const databasePath = String(mainDatabase?.file ?? "");
  const fileName = databasePath.split("/").pop() || "unknown";
  let fileExists: boolean | null = null;
  let fileSize: number | null = null;

  if (Capacitor.getPlatform() === "ios" && fileName !== "unknown") {
    try {
      const stat = await Filesystem.stat({ path: fileName, directory: Directory.Documents });
      fileExists = stat.type === "file";
      fileSize = stat.size;
    } catch {
      fileExists = false;
    }
  } else if (isNative) {
    fileExists = (await sqlite!.isDatabase(DB_NAME)).result === true;
  }

  console.info("[GTFS-DB] Database path: " + (databasePath || "unavailable"));
  console.info("[GTFS-DB] Database file: " + fileName);
  console.info("[GTFS-DB] Database file exists: " + String(fileExists));
  console.info("[GTFS-DB] Database size bytes: " + (fileSize === null ? "unavailable" : String(fileSize)));
  console.info("[GTFS-DB] Database source: " + databaseSource);

  const integrity = String(await pragmaScalar(conn, "PRAGMA integrity_check;") ?? "unavailable");
  const userVersion = Number(await pragmaScalar(conn, "PRAGMA user_version;") ?? 0);
  const schemaVersionRow = await conn.query(
    "SELECT COALESCE(MAX(version), 0) AS schema_version FROM schema_migrations;",
  );
  const schemaVersion = Number((schemaVersionRow.values?.[0] as { schema_version?: number } | undefined)?.schema_version ?? 0);

  const sqliteSchemaVersion = Number(await pragmaScalar(conn, "PRAGMA schema_version;") ?? 0);
  console.info("[GTFS-DB] integrity_check: " + integrity);
  console.info("[GTFS-DB] user_version: " + userVersion);
  console.info("[GTFS-DB] schema_version: " + schemaVersion);
  console.info("[GTFS-DB] sqlite_schema_version: " + sqliteSchemaVersion);

  const tableResult = await conn.query(
    "SELECT name FROM sqlite_master WHERE type = 'table';",
  );
  const tableNames = new Set(
    (tableResult.values ?? []).map((row) => String((row as { name?: unknown }).name ?? "")),
  );
  const tableSpecs = [
    { label: "stops", aliases: ["gtfs_stops", "stops"] },
    { label: "routes", aliases: ["gtfs_routes", "routes"] },
    { label: "trips", aliases: ["gtfs_trips", "trips"] },
    { label: "stop_times", aliases: ["gtfs_stop_times", "stop_times"] },
    { label: "shapes", aliases: ["gtfs_shapes", "shapes"] },
  ];
  const counts: Record<string, number | null> = {};

  for (const spec of tableSpecs) {
    const table = spec.aliases.find((candidate) => tableNames.has(candidate));
    if (!table) {
      counts[spec.label] = null;
      console.info("[GTFS-DB] " + spec.label + ": table missing");
      continue;
    }
    const countResult = await conn.query('SELECT COUNT(*) AS n FROM "' + table + '";');
    const count = Number((countResult.values?.[0] as { n?: number } | undefined)?.n ?? 0);
    counts[spec.label] = count;
    console.info("[GTFS-DB] " + spec.label + ": " + count);
  }

  const invalidTables = ["stops", "routes", "trips", "stop_times"].filter(
    (table) => counts[table] === null || counts[table] === 0,
  );
  if (integrity !== "ok") {
    console.error("[GTFS-DB] Database integrity check failed.");
  } else if (invalidTables.length) {
    console.warn(
      "[GTFS-DB] Base GTFS local não instalada ou sem dados; tabelas ausentes/vazias: " +
      invalidTables.join(", "),
    );
  } else {
    console.info("[GTFS-DB] Essential GTFS tables contain data.");
  }
}

async function openDatabase(): Promise<LocalDb> {
  sqlite = new SQLiteConnection(CapacitorSQLite);
  if (!isNative) await setupWebStore();

  const hasConnection = (await sqlite.isConnection(DB_NAME, false)).result === true;
  const hasLocalDatabase = (await sqlite.isDatabase(DB_NAME)).result === true;

  if (isNative && !hasConnection && !hasLocalDatabase) {
    if (await bundledDatabaseSeedExists()) {
      console.info("[GTFS-DB] Bundled seed found at assets/databases/aptransp.db; copying to writable SQLite storage.");
      try {
        await sqlite.copyFromAssets(false);
        databaseSource = "bundled-seed";
      } catch (error) {
        databaseSource = "bundle-seed-copy-failed";
        console.error("[GTFS-DB] Failed to copy bundled database seed.", error instanceof Error ? error.message : "copy failed");
      }
    } else {
      databaseSource = "new-local-database-no-bundled-seed";
      console.warn("[GTFS-DB] No bundled seed found at assets/databases/aptransp.db; a new local database would contain no GTFS rows.");
    }
  } else if (hasLocalDatabase || hasConnection) {
    databaseSource = "existing-local-database";
  }

  const existingConnection = (await sqlite.isConnection(DB_NAME, false)).result === true;
  dbConn = existingConnection
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);

  await dbConn.open();
  await dbConn.execute("PRAGMA foreign_keys = ON;");

  const integrityBeforeMigrations = String(
    await pragmaScalar(dbConn, "PRAGMA integrity_check;") ?? "unavailable",
  );
  console.info("[GTFS-DB] integrity_check before migrations: " + integrityBeforeMigrations);
  if (integrityBeforeMigrations !== "ok") {
    throw new Error("O banco SQLite local está inválido (integrity_check).");
  }

  const currentUserVersion = Number(await pragmaScalar(dbConn, "PRAGMA user_version;") ?? 0);
  const supportedSchemaVersion = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;
  console.info("[GTFS-DB] user_version before migrations: " + currentUserVersion);
  if (currentUserVersion > supportedSchemaVersion) {
    throw new Error("O banco SQLite foi criado por uma versão mais recente do aplicativo.");
  }

  await runMigrations(dbConn);
  if (currentUserVersion < supportedSchemaVersion) {
    await dbConn.execute("PRAGMA user_version = " + supportedSchemaVersion + ";");
  }
  await logDatabaseDiagnostics(dbConn);
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
