import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import archiver from "archiver";
import { pool } from "../db.js";
import { createSqliteSnapshot } from "../gtfsSqliteSnapshot.js";

export const gtfsRouter = Router();

const GTFS_TABLES = [
  "gtfs_agency","gtfs_calendar","gtfs_fare_attributes","gtfs_fare_rules",
  "gtfs_frequencies","gtfs_routes","gtfs_shapes","gtfs_stop_times","gtfs_stops","gtfs_trips",
] as const;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024, files: 20 } });

const IMPORT_MAP: Record<string, { table: string; columns: string[] }> = {
  "agency.txt": { table: "gtfs_agency", columns: ["agency_id","agency_name","agency_url","agency_timezone"] },
  "calendar.txt": { table: "gtfs_calendar", columns: ["service_id","monday","tuesday","wednesday","thursday","friday","saturday","sunday","start_date","end_date"] },
  "routes.txt": { table: "gtfs_routes", columns: ["route_id","agency_id","route_short_name","route_long_name","route_type","route_color"] },
  "stops.txt": { table: "gtfs_stops", columns: ["stop_id","stop_name","stop_desc","stop_lat","stop_lon"] },
  "trips.txt": { table: "gtfs_trips", columns: ["trip_id","route_id","service_id","trip_headsign","direction_id","shape_id"] },
  "stop_times.txt": { table: "gtfs_stop_times", columns: ["trip_id","arrival_time","departure_time","stop_id","stop_sequence"] },
  "shapes.txt": { table: "gtfs_shapes", columns: ["shape_id","shape_pt_lat","shape_pt_lon","shape_pt_sequence"] },
  "frequencies.txt": { table: "gtfs_frequencies", columns: ["trip_id","start_time","end_time","headway_secs"] },
  "fare_attributes.txt": { table: "gtfs_fare_attributes", columns: ["fare_id","price","currency_type","payment_method","transfers","transfer_duration"] },
  "fare_rules.txt": { table: "gtfs_fare_rules", columns: ["fare_id","route_id","origin_id","destination_id"] },
};

const REQUIRED_PACKAGE_FILES = ["agency.txt","routes.txt","stops.txt","trips.txt","stop_times.txt"] as const;
const SNAPSHOT_DIR = process.env.GTFS_SNAPSHOT_DIR ?? "/app/data/gtfs";

function snapshotPath(version: string) {
  return path.join(SNAPSHOT_DIR, `gtfs-${version}.zip`);
}
function sqliteSnapshotPath(version: string) {
  return path.join(SNAPSHOT_DIR, `aptransp_gtfs_${version}.db`);
}

async function createSnapshot(version: string, files: Express.Multer.File[]) {
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  const target = snapshotPath(version);
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(target, { flags: "wx" });
    const archive = archiver("zip", { zlib: { level: 6 } });
    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    for (const file of files) archive.append(file.buffer, { name: file.originalname.toLowerCase() });
    void archive.finalize();
  });
  return target;
}

async function sha256File(filePath: string) {
  return await new Promise<string>((resolve, reject) => {
    const hash = createHash("sha256");
    const input = createReadStream(filePath);
    input.on("error", reject);
    input.on("data", chunk => hash.update(chunk));
    input.on("end", () => resolve(hash.digest("hex")));
  });
}

function versionName() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

function parseGtfs(file: Express.Multer.File) {
  return parse(file.buffer, { columns: true, skip_empty_lines: true, bom: true, trim: true, relax_column_count: true }) as Record<string,string>[];
}

async function insertRows(client: any, table: string, columns: string[], rows: Record<string,string>[]) {
  const batchSize = 500;
  let imported = 0;
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const values: unknown[] = [];
    const tuples = batch.map((row, rowIndex) => {
      const placeholders = columns.map((column, colIndex) => {
        values.push(row[column] === "" || row[column] === undefined ? null : row[column]);
        return `$${rowIndex * columns.length + colIndex + 1}`;
      });
      return `(${placeholders.join(",")})`;
    });
    if (tuples.length) await client.query(`INSERT INTO ${table} (${columns.join(",")}) VALUES ${tuples.join(",")}`, values);
    imported += batch.length;
  }
  return imported;
}

async function totalRecords(client: any) {
  let total = 0;
  for (const table of GTFS_TABLES) {
    const r = await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
    total += Number(r.rows[0]?.count ?? 0);
  }
  return total;
}

async function validateGtfs(client: any) {
  const checks = [
    ["trips_without_route", `SELECT COUNT(*)::int count FROM gtfs_trips t LEFT JOIN gtfs_routes r ON r.route_id=t.route_id WHERE r.route_id IS NULL`],
    ["stop_times_without_trip", `SELECT COUNT(*)::int count FROM gtfs_stop_times st LEFT JOIN gtfs_trips t ON t.trip_id=st.trip_id WHERE t.trip_id IS NULL`],
    ["stop_times_without_stop", `SELECT COUNT(*)::int count FROM gtfs_stop_times st LEFT JOIN gtfs_stops s ON s.stop_id=st.stop_id WHERE s.stop_id IS NULL`],
  ] as const;
  const errors: Record<string, number> = {};
  for (const [name, sql] of checks) {
    const r = await client.query(sql);
    const count = Number(r.rows[0]?.count ?? 0);
    if (count) errors[name] = count;
  }
  return errors;
}

gtfsRouter.get("/version", async (_req, res) => {
  try {
    const result = await pool.query(`SELECT version, status, imported_at, published_at, total_records, notes FROM gtfs_versions WHERE status='published' ORDER BY published_at DESC NULLS LAST, id DESC LIMIT 1`);
    const current = result.rows[0] ?? null;
    res.json({ status: "ok", hasPublishedVersion: Boolean(current), version: current });
  } catch (error) {
    console.error("[gtfs/version]", error);
    res.status(500).json({ status: "error", message: "Failed to read GTFS version" });
  }
});

gtfsRouter.get("/status", async (_req, res) => {
  try {
    const counts: Record<string, number> = {};
    let totalRecords = 0;
    for (const table of GTFS_TABLES) {
      const result = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${table}`);
      const count = Number(result.rows[0]?.count ?? 0); counts[table] = count; totalRecords += count;
    }
    const [versionResult, importResult] = await Promise.all([
      pool.query(`SELECT version,status,imported_at,published_at,total_records,notes FROM gtfs_versions ORDER BY id DESC LIMIT 1`),
      pool.query(`SELECT id,filename,table_name,status,rows_imported,rows_total,error_message,created_at,updated_at FROM gtfs_imports ORDER BY created_at DESC LIMIT 20`),
    ]);
    res.json({ status:"ok", totalRecords, counts, latestVersion:versionResult.rows[0]??null, recentImports:importResult.rows });
  } catch (error) {
    console.error("[gtfs/status]", error);
    res.status(500).json({ status:"error", message:"Failed to read GTFS status" });
  }
});

gtfsRouter.post("/import", upload.single("file"), async (req, res) => {
  const file=req.file;
  if(!file) return res.status(400).json({status:"error",message:"Campo file é obrigatório"});
  const config=IMPORT_MAP[file.originalname.toLowerCase()];
  if(!config) return res.status(400).json({status:"error",message:"Arquivo GTFS não suportado",file:file.originalname});
  const importId=randomUUID(); const client=await pool.connect();
  try {
    await pool.query(`INSERT INTO gtfs_imports (id,filename,table_name,status) VALUES ($1,$2,$3,'running')`,[importId,file.originalname,config.table]);
    const rows=parseGtfs(file); await client.query("BEGIN"); await client.query(`TRUNCATE TABLE ${config.table}`);
    const imported=await insertRows(client,config.table,config.columns,rows); await client.query("COMMIT");
    await pool.query(`UPDATE gtfs_imports SET status='done',rows_imported=$2,rows_total=$2,updated_at=NOW() WHERE id=$1`,[importId,imported]);
    return res.json({status:"ok",importId,file:file.originalname,table:config.table,rowsImported:imported});
  } catch(error) {
    await client.query("ROLLBACK").catch(()=>undefined);
    await pool.query(`UPDATE gtfs_imports SET status='error',error_message=$2,updated_at=NOW() WHERE id=$1`,[importId,error instanceof Error?error.message:"Unknown error"]).catch(()=>undefined);
    return res.status(500).json({status:"error",message:"Failed to import GTFS file",importId});
  } finally { client.release(); }
});

gtfsRouter.post("/import/package", upload.array("files",20), async (req,res)=>{
  const files=(req.files as Express.Multer.File[]|undefined)??[];
  if(!files.length) return res.status(400).json({status:"error",message:"Campo files é obrigatório"});
  const byName=new Map(files.map(f=>[f.originalname.toLowerCase(),f]));
  const unsupported=files.filter(f=>!IMPORT_MAP[f.originalname.toLowerCase()]).map(f=>f.originalname);
  const missing=REQUIRED_PACKAGE_FILES.filter(name=>!byName.has(name));
  if(unsupported.length||missing.length) return res.status(400).json({status:"error",message:"Pacote GTFS inválido",missingRequiredFiles:missing,unsupportedFiles:unsupported});

  const client=await pool.connect(); const version=versionName(); const importedFiles:any[]=[];
  let createdSnapshot: string | null = null;
  try {
    await client.query("BEGIN");
    for(const table of [...GTFS_TABLES].reverse()) await client.query(`TRUNCATE TABLE ${table}`);
    for(const [filename,config] of Object.entries(IMPORT_MAP)) {
      const file=byName.get(filename); if(!file) continue;
      const importId=randomUUID(); const rows=parseGtfs(file);
      await client.query(`INSERT INTO gtfs_imports (id,filename,table_name,status,rows_total) VALUES ($1,$2,$3,'running',$4)`,[importId,file.originalname,config.table,rows.length]);
      const imported=await insertRows(client,config.table,config.columns,rows);
      await client.query(`UPDATE gtfs_imports SET status='done',rows_imported=$2,updated_at=NOW() WHERE id=$1`,[importId,imported]);
      importedFiles.push({file:file.originalname,table:config.table,rowsImported:imported});
    }
    const validationErrors=await validateGtfs(client);
    if(Object.keys(validationErrors).length) throw new Error(`GTFS referential validation failed: ${JSON.stringify(validationErrors)}`);
    const total=await totalRecords(client);
    createdSnapshot=await createSnapshot(version,files);
    await createSqliteSnapshot(client, SNAPSHOT_DIR, version, total);
    await client.query(`INSERT INTO gtfs_versions (version,status,imported_at,total_records,notes) VALUES ($1,'ready',NOW(),$2,$3)`,[version,total,`Package import: ${importedFiles.map(x=>x.file).join(", ")}`]);
    await client.query("COMMIT");
    return res.json({status:"ok",version,versionStatus:"ready",totalRecords:total,files:importedFiles});
  } catch(error) {
    await client.query("ROLLBACK").catch(()=>undefined);
    if(createdSnapshot) await unlink(createdSnapshot).catch(()=>undefined);
    await unlink(sqliteSnapshotPath(version)).catch(()=>undefined);
    console.error("[gtfs/import/package]",error);
    return res.status(500).json({status:"error",message:"Failed to import GTFS package",detail:error instanceof Error?error.message:"Unknown error"});
  } finally { client.release(); }
});

gtfsRouter.post("/publish", async (req,res)=>{
  const requested=typeof req.body?.version==="string"?req.body.version:null;
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    const candidate=await client.query(
      requested
        ? `SELECT id,version,status,total_records FROM gtfs_versions WHERE version=$1 AND status IN ('ready','published') ORDER BY id DESC LIMIT 1 FOR UPDATE`
        : `SELECT id,version,status,total_records FROM gtfs_versions WHERE status='ready' ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      requested?[requested]:[]
    );
    if(!candidate.rows[0]) { await client.query("ROLLBACK"); return res.status(404).json({status:"error",message:"Nenhuma versão GTFS pronta para publicação"}); }
    const row=candidate.rows[0];
    try {
      await Promise.all([stat(snapshotPath(row.version)), stat(sqliteSnapshotPath(row.version))]);
    } catch {
      await client.query("ROLLBACK");
      return res.status(409).json({status:"error",message:"Snapshots ZIP/SQLite da versão não encontrados. Reimporte o pacote GTFS com a API atual antes de publicar.",version:row.version});
    }
    // O schema atual aceita apenas os estados já definidos pelo banco (ex.: ready/published).
    // Em vez de usar um novo status "archived", a versão publicada anterior volta para "ready".
    // O endpoint /version considera somente status=published, preservando uma única versão ativa.
    await client.query(`UPDATE gtfs_versions SET status='ready',published_at=NULL WHERE status='published' AND id<>$1`,[row.id]);
    await client.query(`UPDATE gtfs_versions SET status='published',published_at=NOW() WHERE id=$1`,[row.id]);
    await client.query("COMMIT");
    return res.json({status:"ok",version:row.version,versionStatus:"published",totalRecords:Number(row.total_records??0),publishedAt:new Date().toISOString()});
  } catch(error) {
    await client.query("ROLLBACK").catch(()=>undefined); console.error("[gtfs/publish]",error);
    return res.status(500).json({status:"error",message:"Failed to publish GTFS version"});
  } finally { client.release(); }
});


gtfsRouter.get("/sync/manifest", async (req,res)=>{
  try {
    const result=await pool.query(`SELECT version,total_records,published_at FROM gtfs_versions WHERE status='published' ORDER BY published_at DESC NULLS LAST,id DESC LIMIT 1`);
    const row=result.rows[0];
    if(!row) return res.status(404).json({status:"error",message:"Nenhuma versão GTFS publicada"});
    const filePath=snapshotPath(row.version);
    let info;
    try { info=await stat(filePath); } catch { return res.status(503).json({status:"error",message:"Snapshot da versão publicada indisponível",version:row.version}); }
    const checksum=await sha256File(filePath);
    const sqlitePath=sqliteSnapshotPath(row.version);
    let sqliteInfo;
    try { sqliteInfo=await stat(sqlitePath); } catch { return res.status(503).json({status:"error",message:"Snapshot SQLite da versão publicada indisponível",version:row.version}); }
    const sqliteChecksum=await sha256File(sqlitePath);
    const base=`${req.protocol}://${req.get("host")}`;
    return res.json({
      status:"ok",
      version:row.version,
      publishedAt:row.published_at,
      totalRecords:Number(row.total_records??0),
      package:{format:"zip",sizeBytes:info.size,sha256:checksum,url:`${base}/api/v1/gtfs/sync/download/${encodeURIComponent(row.version)}`},
      sqlite:{format:"sqlite",sizeBytes:sqliteInfo.size,sha256:sqliteChecksum,url:`${base}/api/v1/gtfs/sync/sqlite/aptransp_gtfs_${encodeURIComponent(row.version)}.db`}
    });
  } catch(error) {
    console.error("[gtfs/sync/manifest]",error);
    return res.status(500).json({status:"error",message:"Failed to build GTFS sync manifest"});
  }
});

gtfsRouter.get("/sync/sqlite/aptransp_gtfs_:version.db", async (req,res)=>{
  try {
    const result=await pool.query(`SELECT version FROM gtfs_versions WHERE version=$1 AND status='published' LIMIT 1`,[req.params.version]);
    if(!result.rows[0]) return res.status(404).json({status:"error",message:"Versão GTFS publicada não encontrada"});
    const filePath=sqliteSnapshotPath(result.rows[0].version);
    try { await stat(filePath); } catch { return res.status(404).json({status:"error",message:"Snapshot SQLite GTFS não encontrado"}); }
    res.setHeader("Content-Type","application/vnd.sqlite3");
    res.setHeader("Content-Disposition",`attachment; filename="aptransp_gtfs_${result.rows[0].version}.db"`);
    res.setHeader("Cache-Control","public, max-age=31536000, immutable");
    return createReadStream(filePath).pipe(res);
  } catch(error) {
    console.error("[gtfs/sync/sqlite]",error);
    return res.status(500).json({status:"error",message:"Failed to download SQLite GTFS snapshot"});
  }
});

gtfsRouter.get("/sync/download/:version", async (req,res)=>{
  try {
    const result=await pool.query(`SELECT version FROM gtfs_versions WHERE version=$1 AND status='published' LIMIT 1`,[req.params.version]);
    if(!result.rows[0]) return res.status(404).json({status:"error",message:"Versão GTFS publicada não encontrada"});
    const filePath=snapshotPath(result.rows[0].version);
    try { await stat(filePath); } catch { return res.status(404).json({status:"error",message:"Snapshot GTFS não encontrado"}); }
    res.setHeader("Content-Type","application/zip");
    res.setHeader("Content-Disposition",`attachment; filename="gtfs-${result.rows[0].version}.zip"`);
    res.setHeader("Cache-Control","public, max-age=31536000, immutable");
    return createReadStream(filePath).pipe(res);
  } catch(error) {
    console.error("[gtfs/sync/download]",error);
    return res.status(500).json({status:"error",message:"Failed to download GTFS snapshot"});
  }
});
