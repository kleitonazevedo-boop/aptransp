/**
 * Migrações do banco local SQLite (aptransp.db).
 * Cada entrada é aplicada uma única vez, em ordem, e registrada em schema_migrations.
 */

export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

export const LOCAL_USER_ID = "local-user";

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "core",
    statements: [
      `CREATE TABLE IF NOT EXISTS user_profile (
        id TEXT PRIMARY KEY,
        nome TEXT,
        email TEXT,
        telefone TEXT,
        data_nascimento TEXT,
        idade INTEGER,
        endereco_residencial TEXT,
        endereco_trabalho TEXT,
        cidade TEXT,
        estado TEXT,
        cep TEXT,
        avatar_url TEXT,
        latitude_residencial REAL,
        longitude_residencial REAL,
        latitude_trabalho REAL,
        longitude_trabalho REAL,
        is_admin INTEGER NOT NULL DEFAULT 1,
        ultimo_login TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS route_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        origem TEXT NOT NULL,
        destino TEXT NOT NULL,
        modo_transporte TEXT NOT NULL,
        distancia REAL,
        tempo_estimado REAL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`,
      `CREATE INDEX IF NOT EXISTS idx_history_user ON route_history(user_id, created_at DESC);`,
      `CREATE TABLE IF NOT EXISTS favorite_routes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        origem TEXT NOT NULL,
        destino TEXT NOT NULL,
        modo_transporte TEXT NOT NULL,
        distancia REAL,
        tempo_estimado REAL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS favorite_places (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        label TEXT NOT NULL,
        endereco TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        kind TEXT NOT NULL DEFAULT 'custom',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS system_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        level TEXT NOT NULL,
        source TEXT NOT NULL,
        message TEXT NOT NULL,
        meta TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`,
      `CREATE INDEX IF NOT EXISTS idx_logs_created ON system_logs(created_at DESC);`,
    ],
  },
  {
    version: 2,
    name: "gtfs",
    statements: [
      `CREATE TABLE IF NOT EXISTS gtfs_imports (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        table_name TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        rows_imported INTEGER DEFAULT 0,
        rows_total INTEGER,
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS gtfs_agency (
        agency_id TEXT PRIMARY KEY, agency_name TEXT, agency_url TEXT, agency_timezone TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS gtfs_routes (
        route_id TEXT PRIMARY KEY, agency_id TEXT, route_short_name TEXT,
        route_long_name TEXT, route_type TEXT, route_color TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS gtfs_stops (
        stop_id TEXT PRIMARY KEY, stop_name TEXT, stop_desc TEXT,
        stop_lat REAL, stop_lon REAL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_stops_lat ON gtfs_stops(stop_lat);`,
      `CREATE INDEX IF NOT EXISTS idx_stops_lon ON gtfs_stops(stop_lon);`,
      `CREATE TABLE IF NOT EXISTS gtfs_trips (
        trip_id TEXT PRIMARY KEY, route_id TEXT, service_id TEXT,
        trip_headsign TEXT, direction_id TEXT, shape_id TEXT
      );`,
      `CREATE INDEX IF NOT EXISTS idx_trips_route ON gtfs_trips(route_id);`,
      `CREATE TABLE IF NOT EXISTS gtfs_stop_times (
        trip_id TEXT, arrival_time TEXT, departure_time TEXT,
        stop_id TEXT, stop_sequence INTEGER
      );`,
      `CREATE INDEX IF NOT EXISTS idx_stoptimes_stop ON gtfs_stop_times(stop_id);`,
      `CREATE INDEX IF NOT EXISTS idx_stoptimes_trip ON gtfs_stop_times(trip_id);`,
      `CREATE TABLE IF NOT EXISTS gtfs_shapes (
        shape_id TEXT, shape_pt_lat REAL, shape_pt_lon REAL, shape_pt_sequence INTEGER
      );`,
      `CREATE INDEX IF NOT EXISTS idx_shapes_id ON gtfs_shapes(shape_id);`,
      `CREATE TABLE IF NOT EXISTS gtfs_calendar (
        service_id TEXT PRIMARY KEY, monday INTEGER, tuesday INTEGER, wednesday INTEGER,
        thursday INTEGER, friday INTEGER, saturday INTEGER, sunday INTEGER,
        start_date TEXT, end_date TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS gtfs_frequencies (
        trip_id TEXT, start_time TEXT, end_time TEXT, headway_secs INTEGER
      );`,
      `CREATE TABLE IF NOT EXISTS gtfs_fare_attributes (
        fare_id TEXT PRIMARY KEY, price TEXT, currency_type TEXT,
        payment_method TEXT, transfers TEXT, transfer_duration TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS gtfs_fare_rules (
        fare_id TEXT, route_id TEXT, origin_id TEXT, destination_id TEXT
      );`,
    ],
  },
];
