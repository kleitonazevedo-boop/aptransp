import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Logo } from "@/components/Logo";
import { logger, type SystemLog } from "@/services/loggerService";

interface Props { onBack: () => void }

const LogsScreen = ({ onBack }: Props) => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [filter, setFilter] = useState<string>("all");

  const reload = async () => setLogs(await logger.list(200));
  useEffect(() => { void reload(); }, []);

  const filtered = filter === "all" ? logs : logs.filter((l) => l.source === filter);

  return (
    <div className="flex-1 flex flex-col bg-white">
      <header className="bg-brand-purple text-white px-4 pt-4 pb-3 flex items-center justify-between">
        <button onClick={onBack} aria-label="Voltar" className="p-1"><ArrowLeft className="w-6 h-6" /></button>
        <Logo className="w-8 h-8" />
        <button onClick={reload}><RefreshCw className="w-5 h-5" /></button>
      </header>
      <div className="bg-brand-yellow text-blue-900 text-center text-sm font-bold py-2">Logs do Sistema</div>

      <div className="bg-amber-100 px-3 py-2 flex gap-2 overflow-x-auto">
        {["all", "google", "gps", "supabase", "sptrans", "gtfs", "app"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${
                    filter === s ? "bg-brand-purple text-white" : "bg-white text-blue-900"
                  }`}>{s}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto bg-amber-50 p-3 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-blue-900/60 text-center py-12">Nenhum log.</p>
        ) : filtered.map((l) => (
          <div key={l.id} className="bg-white rounded-xl p-2 text-xs space-y-1">
            <div className="flex justify-between">
              <span className={`font-bold uppercase ${
                l.level === "error" ? "text-red-700" : l.level === "warn" ? "text-amber-700" : "text-blue-700"
              }`}>[{l.level}] {l.source}</span>
              <span className="text-blue-900/50">{l.created_at && new Date(l.created_at).toLocaleString()}</span>
            </div>
            <p className="text-blue-900">{l.message}</p>
            {l.meta && <pre className="text-[10px] text-blue-900/60 overflow-x-auto">{JSON.stringify(l.meta, null, 2)}</pre>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogsScreen;
