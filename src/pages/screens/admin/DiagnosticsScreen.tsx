import { useState } from "react";
import { ArrowLeft, Loader2, Play, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { diagnosticsService, type DiagnosticResult } from "@/services/diagnosticsService";

interface Props { onBack: () => void }

const DiagnosticsScreen = ({ onBack }: Props) => {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setResults(await diagnosticsService.runAll());
    setLoading(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <header className="bg-brand-purple text-white px-4 pt-4 pb-3 flex items-center justify-between">
        <button onClick={onBack} aria-label="Voltar" className="p-1"><ArrowLeft className="w-6 h-6" /></button>
        <Logo className="w-8 h-8" />
        <span />
      </header>
      <div className="bg-brand-yellow text-blue-900 text-center text-sm font-bold py-2">Diagnóstico do Sistema</div>

      <div className="flex-1 overflow-y-auto bg-amber-50 p-4 space-y-2">
        <button onClick={run} disabled={loading}
                className="w-full bg-brand-purple text-white rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Executar Testes
        </button>

        {results.map((r) => (
          <div key={r.key} className="bg-white rounded-2xl p-4 space-y-3 shadow-sm min-w-0">
            <div className="flex items-start gap-3">
              <div className="shrink-0"><StatusIcon status={r.status} /></div>
              <p className="flex-1 min-w-0 text-sm font-semibold text-blue-900 break-words">{r.label}</p>
              <span className={`shrink-0 text-[10px] uppercase font-bold ${
                r.status === "ok" ? "text-emerald-700" :
                r.status === "fail" ? "text-red-700" : "text-amber-700"
              }`}>{r.status}</span>
            </div>
            {r.detail && <pre className="text-xs font-sans text-blue-900/60 whitespace-pre-wrap [overflow-wrap:anywhere]">{r.detail}</pre>}
          </div>
        ))}
      </div>
    </div>
  );
};

const StatusIcon = ({ status }: { status: DiagnosticResult["status"] }) => {
  if (status === "ok") return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
  if (status === "fail") return <XCircle className="w-5 h-5 text-red-600" />;
  return <HelpCircle className="w-5 h-5 text-amber-600" />;
};

export default DiagnosticsScreen;
