import { useEffect, useState } from "react";
import { ArrowLeft, Upload, Loader2, Play, Trash2, RefreshCw } from "lucide-react";
import { Logo } from "@/components/Logo";
import { gtfsService, GTFS_FILES, type GtfsImport } from "@/services/gtfsService";
import { logger } from "@/services/loggerService";

interface Props { onBack: () => void }

const GtfsImportScreen = ({ onBack }: Props) => {
  const [imports, setImports] = useState<GtfsImport[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => setImports(await gtfsService.listImports());

  useEffect(() => { void reload(); }, []);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setError(null);
    for (const f of files) {
      const valid = (GTFS_FILES as readonly string[]).includes(f.name);
      if (!valid) { setError(`Arquivo inválido: ${f.name}`); continue; }
      const r = await gtfsService.uploadFile(f);
      if (!r) { setError(`Falha ao subir ${f.name}`); void logger.error("gtfs", "Upload falhou", { file: f.name }); }
      else void logger.info("gtfs", "Upload OK", { file: f.name });
    }
    await reload();
  };

  const onImport = async (imp: GtfsImport) => {
    setBusy(imp.id);
    // chunked: chama enquanto não terminar
    while (true) {
      const r = await gtfsService.runImport(imp.id);
      if (r.error) { setError(r.error); void logger.error("gtfs", "Import erro", { id: imp.id, error: r.error }); break; }
      if (r.done) { void logger.info("gtfs", "Import OK", { id: imp.id, rows: r.rowsImported }); break; }
    }
    setBusy(null);
    await reload();
  };

  const onDelete = async (imp: GtfsImport) => {
    if (!confirm(`Excluir ${imp.filename}?`)) return;
    await gtfsService.deleteImport(imp.id, imp.storage_path);
    await reload();
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <header className="bg-brand-purple text-white px-4 pt-4 pb-3 flex items-center justify-between">
        <button onClick={onBack} aria-label="Voltar" className="p-1"><ArrowLeft className="w-6 h-6" /></button>
        <Logo className="w-8 h-8" />
        <span />
      </header>
      <div className="bg-brand-yellow text-blue-900 text-center text-sm font-bold py-2">Importação SPTrans (GTFS)</div>

      <div className="flex-1 overflow-y-auto bg-amber-50 p-4 space-y-3">
        <label className="block bg-white border-2 border-dashed border-amber-300 rounded-2xl p-6 text-center cursor-pointer">
          <Upload className="w-6 h-6 text-amber-700 mx-auto mb-1" />
          <p className="text-sm font-semibold text-blue-900">Selecionar arquivos GTFS</p>
          <p className="text-[11px] text-blue-900/60">{GTFS_FILES.join(", ")}</p>
          <input type="file" multiple accept=".txt" className="hidden" onChange={onUpload} />
        </label>

        {error && <div className="bg-red-100 text-red-800 text-xs rounded-xl p-3">{error}</div>}

        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-blue-900">Importações</p>
          <button onClick={reload} className="text-xs text-brand-purple flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Atualizar
          </button>
        </div>

        {imports.length === 0 ? (
          <p className="text-xs text-blue-900/60 text-center py-6">Sem importações ainda.</p>
        ) : imports.map((imp) => (
          <div key={imp.id} className="bg-white rounded-2xl p-3 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-blue-900">{imp.filename}</p>
              <span className={`text-[10px] uppercase font-bold ${
                imp.status === "done" ? "text-emerald-700" :
                imp.status === "error" ? "text-red-700" :
                imp.status === "running" ? "text-amber-700" : "text-blue-700"
              }`}>{imp.status}</span>
            </div>
            <p className="text-[11px] text-blue-900/60">
              {imp.rows_imported ?? 0}{imp.rows_total ? ` / ${imp.rows_total}` : ""} linhas
              {imp.created_at && ` · ${new Date(imp.created_at).toLocaleString()}`}
            </p>
            {imp.error_message && <p className="text-[11px] text-red-700">{imp.error_message}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => onImport(imp)} disabled={busy === imp.id}
                      className="flex-1 bg-brand-purple text-white rounded-full py-2 text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-60">
                {busy === imp.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Importar
              </button>
              <button onClick={() => onDelete(imp)}
                      className="bg-red-100 text-red-700 rounded-full px-3 py-2 text-xs font-semibold flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GtfsImportScreen;
