import { useEffect, useMemo, useState } from "react";
import {
  ShieldAlert,
  Fingerprint as FingerprintIcon,
  FileSearch,
  Download,
  Binary,
  Hash,
  ScanLine,
  Activity,
  AlertTriangle,
  Lock,
} from "lucide-react";
import {
  buildForensicReport,
  reportToText,
  type DiffEntry,
  type ForensicReport as ForensicReportType,
  type NfcPayload,
  type Snapshot,
} from "@/lib/forensic";
import { fileStamp, triggerDownload } from "@/lib/nfcExport";

type Props = {
  parsed: NfcPayload | null;
  snapshots: Snapshot[];
  diff: DiffEntry[] | null;
};

const Badge = ({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) => {
  const map: Record<string, string> = {
    slate: "border-slate-600 text-slate-300",
    cyan: "border-cyan-500 text-cyan-300",
    emerald: "border-emerald-500 text-emerald-300",
    yellow: "border-yellow-500 text-yellow-300",
    red: "border-red-500 text-red-300",
    fuchsia: "border-fuchsia-500 text-fuchsia-300",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${map[tone] ?? map.slate}`}
    >
      {children}
    </span>
  );
};

const riskTone = (risk: string) =>
  risk === "LOW" ? "emerald" : risk === "MEDIUM" ? "yellow" : risk === "HIGH" ? "red" : "red";

export const ForensicReport = ({ parsed, snapshots, diff }: Props) => {
  const [report, setReport] = useState<ForensicReportType | null>(null);
  const [loading, setLoading] = useState(false);

  // recompute whenever inputs change
  useEffect(() => {
    let cancelled = false;
    if (!parsed) {
      setReport(null);
      return;
    }
    setLoading(true);
    buildForensicReport(parsed, snapshots, diff)
      .then((r) => {
        if (cancelled) return;
        setReport(r);
        console.log("FORENSIC REPORT GENERATED", r);
      })
      .catch((e) => console.error("FORENSIC REPORT ERROR", e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [parsed, snapshots, diff]);

  const handleExportJson = async () => {
    if (!report) return;
    await triggerDownload(
      `forensic_report_${fileStamp()}.json`,
      JSON.stringify(report, null, 2),
      "application/json",
      {
        fileCreated: "EXPORT FILE CREATED",
        shareOpened: "EXPORT SHARE OPENED",
        error: "EXPORT ERROR",
      },
    );
  };

  const handleExportTxt = async () => {
    if (!report) return;
    await triggerDownload(
      `forensic_report_${fileStamp()}.txt`,
      reportToText(report),
      "text/plain",
      {
        fileCreated: "EXPORT FILE CREATED",
        shareOpened: "EXPORT SHARE OPENED",
        error: "EXPORT ERROR",
      },
    );
  };

  const handleExportFullAnalysis = async () => {
    if (!report) return;
    const payload = {
      ...report,
      rawSnapshots: snapshots,
    };
    await triggerDownload(
      `forensic_full_analysis_${fileStamp()}.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
  };

  const sectorMap = useMemo(() => {
    if (!report) return [];
    const bySector = new Map<number, { authenticated: boolean; blocks: number; trailer: boolean }>();
    report.authResults.forEach((r) => {
      bySector.set(r.sector, {
        authenticated: r.authenticated,
        blocks: r.blocks?.length ?? 0,
        trailer: !!r.blocks?.some((b) => report.parsedBlocks.find((p) => p.block === b.block)?.isTrailer),
      });
    });
    return Array.from(bySector.entries()).sort((a, b) => a[0] - b[0]);
  }, [report]);

  if (!parsed) {
    return (
      <section className="rounded-lg border border-emerald-500/60 bg-slate-900 p-4">
        <h2 className="font-mono text-sm font-bold text-emerald-300 flex items-center gap-2">
          <FileSearch className="w-4 h-4" /> FORENSIC ANALYZER
          <Badge tone="slate">IDLE</Badge>
        </h2>
        <p className="mt-2 font-mono text-[11px] text-slate-500">
          Aguardando dump NFC para análise forense.
        </p>
      </section>
    );
  }

  if (loading || !report) {
    return (
      <section className="rounded-lg border border-emerald-500/60 bg-slate-900 p-4">
        <h2 className="font-mono text-sm font-bold text-emerald-300 flex items-center gap-2">
          <FileSearch className="w-4 h-4" /> FORENSIC ANALYZER
          <Badge tone="cyan">ANALYZING…</Badge>
        </h2>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-emerald-500/60 bg-slate-900 p-4 space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="font-mono text-sm font-bold text-emerald-300 flex items-center gap-2">
          <FileSearch className="w-4 h-4" /> FORENSIC REPORT
        </h2>
        <Badge tone="emerald">READY</Badge>
        <Badge tone="red">READ ONLY</Badge>
        <Badge tone={riskTone(report.security.risk)}>RISK: {report.security.risk}</Badge>
        <Badge tone="cyan">SCORE {report.security.score}/100</Badge>
      </header>

      {/* Export bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={handleExportJson}
          className="flex items-center justify-center gap-2 rounded-lg border border-cyan-500 bg-cyan-900/40 px-3 py-2 font-mono text-[11px] font-bold text-cyan-100 active:scale-[0.98]"
        >
          <Download className="w-4 h-4" /> EXPORT FORENSIC REPORT
        </button>
        <button
          type="button"
          onClick={handleExportTxt}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-500 bg-slate-800/60 px-3 py-2 font-mono text-[11px] font-bold text-slate-100 active:scale-[0.98]"
        >
          <Download className="w-4 h-4" /> EXPORT REPORT (TXT)
        </button>
        <button
          type="button"
          onClick={handleExportFullAnalysis}
          className="flex items-center justify-center gap-2 rounded-lg border border-fuchsia-500 bg-fuchsia-900/40 px-3 py-2 font-mono text-[11px] font-bold text-fuchsia-100 active:scale-[0.98]"
        >
          <Download className="w-4 h-4" /> EXPORT FULL ANALYSIS
        </button>
      </div>

      {/* CARD INFO */}
      <div className="rounded border border-slate-700 bg-slate-950 p-3 font-mono text-[11px] space-y-1">
        <div className="text-[10px] text-slate-400 uppercase">Card Info</div>
        <div className="text-emerald-300">UID: {report.cardInfo.uid}</div>
        <div className="text-cyan-200">Type: {report.cardInfo.type}</div>
        <div className="text-slate-300">
          Sectors {report.cardInfo.sectorCount ?? "-"} · Blocks {report.cardInfo.blockCount ?? "-"} · Size {report.cardInfo.mifareSize ?? "-"}
        </div>
        <div className="text-slate-400">Tech: {report.cardInfo.tech.join(", ") || "-"}</div>
      </div>

      {/* SECURITY */}
      <div className="rounded border border-red-500/40 bg-red-950/10 p-3 font-mono text-[11px]">
        <div className="flex items-center gap-2 text-red-300 font-bold">
          <ShieldAlert className="w-3.5 h-3.5" /> SECURITY ANALYSIS
          <Badge tone={riskTone(report.security.risk)}>{report.security.risk}</Badge>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full ${report.security.score >= 80 ? "bg-emerald-500" : report.security.score >= 55 ? "bg-yellow-500" : "bg-red-500"}`}
            style={{ width: `${report.security.score}%` }}
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
          <div className="text-slate-300">Open: {report.security.openSectors.length}</div>
          <div className="text-yellow-200">Default keys: {report.security.defaultKeySectors.length}</div>
          <div className="text-red-200">Permissive ACL: {report.security.writableSectorsSuspect.length}</div>
          <div className="text-fuchsia-200">Weak keys: {report.security.weakKeys}</div>
        </div>
        {report.security.findings.length > 0 && (
          <ul className="mt-2 space-y-1">
            {report.security.findings.map((f, i) => (
              <li key={i} className="flex items-start gap-1 text-[10px] text-slate-300">
                <AlertTriangle className="w-3 h-3 text-yellow-400 mt-0.5 shrink-0" /> {f}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* FINGERPRINT */}
      <div className="rounded border border-fuchsia-500/40 bg-slate-950 p-3 font-mono text-[10px] space-y-1">
        <div className="flex items-center gap-2 text-fuchsia-300 font-bold text-[11px]">
          <FingerprintIcon className="w-3.5 h-3.5" /> FINGERPRINT
        </div>
        <div className="text-slate-400">Dump SHA-256</div>
        <div className="break-all text-emerald-300">{report.fingerprint.dumpHash}</div>
        <div className="text-slate-400 mt-1">Card signature</div>
        <div className="break-all text-cyan-300">{report.fingerprint.cardSignature}</div>
        <div className="text-slate-400 mt-1">Snapshot SHA-256</div>
        <div className="break-all text-yellow-300">{report.fingerprint.snapshotHash}</div>
      </div>

      {/* SECTOR MAP */}
      <div className="rounded border border-slate-700 bg-slate-950 p-3 font-mono">
        <div className="text-[11px] text-cyan-300 font-bold flex items-center gap-2">
          <Lock className="w-3.5 h-3.5" /> SECTOR MAP
        </div>
        <div className="mt-2 grid grid-cols-6 sm:grid-cols-8 gap-1">
          {sectorMap.map(([sector, info]) => (
            <div
              key={sector}
              className={`rounded border text-center px-1 py-1 text-[9px] ${
                info.authenticated
                  ? "border-emerald-500/50 bg-emerald-950/30 text-emerald-300"
                  : "border-red-500/50 bg-red-950/30 text-red-300"
              }`}
              title={`Sector ${sector} · ${info.blocks} blocks`}
            >
              S{sector}
              <div className="text-[8px] opacity-70">{info.blocks}b</div>
            </div>
          ))}
        </div>
      </div>

      {/* ENTROPY */}
      <div className="rounded border border-cyan-500/40 bg-slate-950 p-3 font-mono text-[11px]">
        <div className="text-cyan-300 font-bold flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" /> ENTROPY ANALYSIS
          <Badge tone="cyan">{report.entropy.overall.toFixed(2)} bits/byte</Badge>
        </div>
        <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
          {report.entropy.perBlock.map((e) => (
            <div key={e.block} className="flex items-center gap-2 text-[10px]">
              <span className="text-slate-400 w-16 shrink-0">B{e.block} S{e.sector}</span>
              <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${e.entropy < 1 ? "bg-slate-600" : e.entropy < 4 ? "bg-yellow-500" : "bg-emerald-500"}`}
                  style={{ width: `${(e.entropy / 8) * 100}%` }}
                />
              </div>
              <span className="text-slate-300 w-10 text-right">{e.entropy.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ASCII INSPECTOR */}
      <div className="rounded border border-yellow-500/40 bg-slate-950 p-3 font-mono text-[11px]">
        <div className="text-yellow-300 font-bold flex items-center gap-2">
          <ScanLine className="w-3.5 h-3.5" /> ASCII INSPECTOR
          <Badge tone="yellow">{report.asciiHits.length} hits</Badge>
        </div>
        {report.asciiHits.length === 0 ? (
          <p className="mt-2 text-[10px] text-slate-500">Nenhuma string legível detectada.</p>
        ) : (
          <ul className="mt-2 space-y-0.5 max-h-32 overflow-y-auto">
            {report.asciiHits.map((h, i) => (
              <li key={i} className="text-[10px] text-yellow-200">
                <span className="text-slate-500">S{h.sector} B{h.block}:</span>{" "}
                <span className="text-emerald-300">"{h.text}"</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* VALUE CANDIDATES */}
      <div className="rounded border border-fuchsia-500/40 bg-slate-950 p-3 font-mono text-[11px]">
        <div className="text-fuchsia-300 font-bold flex items-center gap-2">
          <Hash className="w-3.5 h-3.5" /> TIMELINE / COUNTER CANDIDATES
          <Badge tone="fuchsia">{report.valueCandidates.length}</Badge>
        </div>
        {report.valueCandidates.length === 0 ? (
          <p className="mt-2 text-[10px] text-slate-500">Nenhum candidato a timestamp/counter.</p>
        ) : (
          <ul className="mt-2 space-y-0.5 max-h-32 overflow-y-auto">
            {report.valueCandidates.map((c, i) => (
              <li key={i} className="text-[10px]">
                <span className="text-slate-500">S{c.sector} B{c.block}</span>{" "}
                <span className="text-fuchsia-200">[{c.kind}]</span>{" "}
                <span className="text-emerald-300">{c.value}</span>{" "}
                <span className="text-slate-400">— {c.note}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* RAW DUMP */}
      <div className="rounded border border-slate-700 bg-slate-950 p-3 font-mono text-[10px]">
        <div className="text-emerald-300 font-bold flex items-center gap-2 text-[11px]">
          <Binary className="w-3.5 h-3.5" /> RAW DUMP
          <Badge tone="emerald">{report.parsedBlocks.length} blocks</Badge>
        </div>
        <div className="mt-2 max-h-64 overflow-y-auto space-y-0.5">
          {report.parsedBlocks.map((b) => (
            <div
              key={b.block}
              className={`flex flex-wrap gap-2 px-1 py-0.5 rounded ${b.isTrailer ? "bg-yellow-950/20" : ""}`}
            >
              <span className="text-slate-500 w-14">S{b.sector} B{b.block}</span>
              <span className={`flex-1 break-all ${b.isTrailer ? "text-yellow-200" : "text-emerald-300"}`}>
                {b.hex}
              </span>
              <span className="text-slate-500 w-20 text-right truncate">{b.ascii}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ForensicReport;
