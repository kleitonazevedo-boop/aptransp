// Edge function: gtfs-import
// Processa um arquivo GTFS em chunks. Cada chamada importa ~5000 linhas.
// Retorna { done, rowsImported, total } — cliente chama em loop até done=true.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CHUNK = 5000;

const FILE_TABLE_MAP: Record<string, string> = {
  "agency.txt": "gtfs_agency",
  "calendar.txt": "gtfs_calendar",
  "routes.txt": "gtfs_routes",
  "shapes.txt": "gtfs_shapes",
  "stops.txt": "gtfs_stops",
  "stop_times.txt": "gtfs_stop_times",
  "trips.txt": "gtfs_trips",
  "frequencies.txt": "gtfs_frequencies",
  "fare_attributes.txt": "gtfs_fare_attributes",
  "fare_rules.txt": "gtfs_fare_rules",
};

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { importId } = await req.json();
    if (!importId) return new Response(JSON.stringify({ error: "importId required" }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: imp, error: impErr } = await supabase
      .from("gtfs_imports").select("*").eq("id", importId).single();
    if (impErr || !imp) throw new Error(impErr?.message ?? "import not found");

    const table = FILE_TABLE_MAP[imp.filename];
    if (!table) throw new Error(`Arquivo desconhecido: ${imp.filename}`);

    // download from storage
    const { data: file, error: dlErr } = await supabase.storage.from("gtfs-uploads").download(imp.storage_path);
    if (dlErr || !file) throw new Error(dlErr?.message ?? "download failed");
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
    const header = parseCSVLine(lines[0]);
    const total = lines.length - 1;

    const offset = imp.next_offset ?? 0;
    const start = 1 + offset;
    const end = Math.min(lines.length, start + CHUNK);

    await supabase.from("gtfs_imports").update({
      status: "running", table_name: table, rows_total: total, updated_at: new Date().toISOString(),
    }).eq("id", importId);

    const rows: Record<string, string>[] = [];
    for (let i = start; i < end; i++) {
      const vals = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      header.forEach((h, j) => { row[h.trim()] = vals[j] ?? ""; });
      rows.push(row);
    }

    if (rows.length) {
      const { error: insErr } = await supabase.from(table).insert(rows);
      if (insErr) throw new Error(`insert ${table}: ${insErr.message}`);
    }

    const imported = offset + rows.length;
    const done = end >= lines.length;

    await supabase.from("gtfs_imports").update({
      rows_imported: imported,
      next_offset: done ? null : imported,
      status: done ? "done" : "running",
      updated_at: new Date().toISOString(),
    }).eq("id", importId);

    return new Response(JSON.stringify({ done, rowsImported: imported, total }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // try mark error
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.importId) {
        const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        await sb.from("gtfs_imports").update({ status: "error", error_message: msg }).eq("id", body.importId);
      }
    } catch { /* noop */ }
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
