import { useEffect, useState } from "react";
import { ArrowLeft, Upload, Loader2, Trash2, RefreshCw, Database, CloudDownload, CheckCircle2, AlertTriangle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { gtfsService, GTFS_FILES, type GtfsImport, type GtfsSyncMetadata, type GtfsSyncManifest } from "@/services/gtfsService";
import { logger } from "@/services/loggerService";

interface Props { onBack: () => void }

const GtfsImportScreen = ({ onBack }: Props) => {
  const [imports, setImports] = useState<GtfsImport[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncMeta, setSyncMeta] = useState<GtfsSyncMetadata | null>(null);
  const [remoteManifest, setRemoteManifest] = useState<GtfsSyncManifest | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncStage, setSyncStage] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<boolean | null>(null);

  const reload = async () => {
    setImports(await gtfsService.listImports());
    setCounts(await gtfsService.counts());
    setSyncMeta(await gtfsService.getSyncMetadata());
  };

  useEffect(() => { void reload(); }, []);

  const checkSync = async () => {
    setError(null);
    setSyncBusy(true);
    setSyncStage("Verificando versão publicada…");
    try {
      const result = await gtfsService.checkRemoteVersion();
      setRemoteManifest(result.manifest);
      setUpdateAvailable(result.updateAvailable);
      setSyncMeta(await gtfsService.getSyncMetadata());
      setSyncStage(result.updateAvailable ? "Nova versão disponível" : "GTFS local já está atualizado");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setSyncStage(null);
    } finally {
      setSyncBusy(false);
    }
  };

  const runSync = async () => {
    setError(null);
    setSyncBusy(true);
    setSyncStage("Iniciando sincronização…");
    try {
      const result = await gtfsService.syncPublishedPackage((stage, detail) => {
        const labels: Record<string, string> = {
          downloading: "Baixando pacote GTFS",
          validating: "Validando integridade",
          extracting: "Descompactando pacote",
          importing: "Atualizando banco local",
          ready: "Sincronização concluída",
        };
        setSyncStage(`${labels[stage] ?? stage}${detail ? ` — ${detail}` : ""}`);
      });
      setUpdateAvailable(false);
      setSyncStage(result.updated ? `Versão ${result.version} instalada` : "GTFS local já está atualizado");
      await reload();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`Falha na sincronização: ${message}`);
      setSyncStage(null);
      await reload();
    } finally {
      setSyncBusy(false);
    }
  };

  const onSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setError(null);
    for (const f of files) {
      if (!(GTFS_FILES as readonly string[]).includes(f.name)) {
        setError(`Arquivo inválido: ${f.name}`);
        continue;
      }
      setBusy(f.name);
      setProgress({ done: 0, total: 0 });
      const r = await gtfsService.importFile(f, (done, total) => setProgress({ done, total }));
      if (!r || r.status === "error") {
        setError(`Falha ao importar ${f.name}${r?.error_message ? `: ${r.error_message}` : ""}`);
        void logger.error("gtfs", "Import falhou", { file: f.name, error: r?.error_message });
      } else {
        void logger.info("gtfs", "Import OK (local)", { file: f.name, rows: r.rows_imported });
      }
      setBusy(null);
      setProgress(null);
      await reload();
    }
    e.target.value = "";
  };

  const onDelete = async (imp: GtfsImport) => {
    if (!confirm(`Remover registro de ${imp.filename}?`)) return;
    await gtfsService.deleteImport(imp.id);
    await reload();
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <header className="bg-brand-purple text-white px-4 pt-4 pb-3 flex items-center justify-between">
        <button onClick={onBack} aria-label="Voltar" className="p-1"><ArrowLeft className="w-6 h-6" /></button>
        <Logo className="w-8 h-8" />
        <Database className="w-5 h-5 text-brand-yellow" />
      </header>
      <div className="bg-brand-yellow text-blue-900 text-center text-sm font-bold py-2">Importação SPTrans (GTFS) — Local</div>

      <div className="flex-1 overflow-y-auto bg-amber-50 p-4 space-y-3">
        <div className="bg-white rounded-2xl p-4 space-y-3 border border-purple-100">
          <div className="flex items-center gap-2">
            <CloudDownload className="w-5 h-5 text-brand-purple" />
            <div>
              <p className="text-sm font-bold text-blue-900">Sincronização GTFS</p>
              <p className="text-[11px] text-blue-900/60">Servidor → banco SQLite deste dispositivo</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-purple-50 rounded-xl p-2">
              <p className="text-blue-900/60">Versão local</p>
              <p className="font-bold text-blue-900 break-all">{syncMeta?.version ?? "Não sincronizada"}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-2">
              <p className="text-blue-900/60">Versão publicada</p>
              <p className="font-bold text-blue-900 break-all">{remoteManifest?.version ?? "Não verificada"}</p>
            </div>
          </div>

          {syncStage && (
            <div className="flex items-start gap-2 text-xs text-blue-900 bg-blue-50 rounded-xl p-3">
              {syncBusy ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> :
                updateAvailable === false ? <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" /> :
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />}
              <span>{syncStage}</span>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={checkSync} disabled={syncBusy}
              className="flex-1 bg-purple-100 text-brand-purple rounded-xl px-3 py-2.5 text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1">
              <RefreshCw className={`w-3.5 h-3.5 ${syncBusy ? "animate-spin" : ""}`} />
              Verificar atualização
            </button>
            <button onClick={runSync} disabled={syncBusy || updateAvailable === false}
              className="flex-1 bg-brand-purple text-white rounded-xl px-3 py-2.5 text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-1">
              <CloudDownload className="w-3.5 h-3.5" />
              Sincronizar agora
            </button>
          </div>

          {syncMeta?.last_synced_at && (
            <p className="text-[10px] text-blue-900/50">Última sincronização: {syncMeta.last_synced_at}</p>
          )}
        </div>

        <label className="block bg-white border-2 border-dashed border-amber-300 rounded-2xl p-6 text-center cursor-pointer">
          <Upload className="w-6 h-6 text-amber-700 mx-auto mb-1" />
          <p className="text-sm font-semibold text-blue-900">Selecionar arquivos GTFS</p>
          <p className="text-[11px] text-blue-900/60">Gravados direto no banco local aptransp.db</p>
          <p className="text-[10px] text-blue-900/50 mt-1">{GTFS_FILES.join(", ")}</p>
          <input type="file" multiple accept=".txt" className="hidden" onChange={onSelect} disabled={!!busy} />
        </label>

        {busy && (
          <div className="bg-white rounded-2xl p-3 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-brand-purple" />
            <p className="text-xs text-blue-900">
              Importando {busy}
              {progress?.total ? ` — ${progress.done}/${progress.total} linhas` : "…"}
            </p>
          </div>
        )}

        {error && <div className="bg-red-100 text-red-800 text-xs rounded-xl p-3">{error}</div>}

        <div className="bg-white rounded-2xl p-3">
          <p className="text-xs font-bold text-blue-900 mb-1">Registros no banco local</p>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(counts).map(([t, n]) => (
              <p key={t} className="text-[11px] text-blue-900/70">{t.replace("gtfs_", "")}: <b>{n}</b></p>
            ))}
          </div>
        </div>

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
              {imp.created_at && ` · ${imp.created_at}`}
            </p>
            {imp.error_message && <p className="text-[11px] text-red-700">{imp.error_message}</p>}
            <button onClick={() => onDelete(imp)}
                    className="bg-red-100 text-red-700 rounded-full px-3 py-2 text-xs font-semibold flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Excluir registro
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GtfsImportScreen;
