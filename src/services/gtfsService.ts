import { supabase } from "@/integrations/supabase/client";

export const GTFS_FILES = [
  "agency.txt", "calendar.txt", "routes.txt", "shapes.txt",
  "stops.txt", "stop_times.txt", "trips.txt", "frequencies.txt",
  "fare_attributes.txt", "fare_rules.txt",
] as const;

export type GtfsFileName = typeof GTFS_FILES[number];

export interface GtfsImport {
  id: string;
  user_id: string;
  storage_path: string;
  filename: string;
  status: "pending" | "running" | "done" | "error";
  table_name?: string | null;
  rows_imported?: number | null;
  rows_total?: number | null;
  next_offset?: number | null;
  error_message?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const gtfsService = {
  async uploadFile(file: File): Promise<{ path: string } | null> {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const path = `${u.user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("gtfs-uploads").upload(path, file, { upsert: true });
    if (error) { console.error("[gtfs:upload]", error); return null; }
    // register import
    await supabase.from("gtfs_imports").insert({
      user_id: u.user.id, storage_path: path, filename: file.name, status: "pending",
    });
    return { path };
  },

  async listImports(): Promise<GtfsImport[]> {
    const { data, error } = await supabase
      .from("gtfs_imports").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) { console.error("[gtfs:list]", error); return []; }
    return (data ?? []) as GtfsImport[];
  },

  async runImport(importId: string): Promise<{ done: boolean; rowsImported?: number; error?: string }> {
    const { data, error } = await supabase.functions.invoke("gtfs-import", { body: { importId } });
    if (error) return { done: false, error: error.message };
    return data as { done: boolean; rowsImported?: number; error?: string };
  },

  async deleteImport(id: string, storagePath: string): Promise<boolean> {
    await supabase.storage.from("gtfs-uploads").remove([storagePath]);
    const { error } = await supabase.from("gtfs_imports").delete().eq("id", id);
    if (error) { console.error("[gtfs:del]", error); return false; }
    return true;
  },
};
