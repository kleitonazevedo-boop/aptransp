import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NfcReading } from "@/lib/nfc";
import { CheckCircle2, AlertTriangle, Lock, History, Nfc } from "lucide-react";

interface Props {
  reading: NfcReading;
  onNew: () => void;
  onHistory: () => void;
  onBack: () => void;
}

const statusIcon = (s: NfcReading["status"]) => {
  if (s === "Cartão detectado") return <CheckCircle2 className="w-6 h-6 text-success" />;
  if (s === "Leitura parcial") return <AlertTriangle className="w-6 h-6 text-warning" />;
  return <Lock className="w-6 h-6 text-warning" />;
};

const ResultScreen = ({ reading, onNew, onHistory, onBack }: Props) => (
  <div className="flex flex-col flex-1">
    <ScreenHeader title="Resultado da leitura" onBack={onBack} />
    <div className="screen-padding flex flex-col gap-4 flex-1">
      <Card className="p-6 rounded-3xl shadow-elevated bg-gradient-card text-primary-foreground border-0 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-primary-foreground/15 flex items-center justify-center">
            {statusIcon(reading.status)}
          </div>
          <div>
            <p className="text-xs opacity-80 uppercase tracking-wider">Status</p>
            <p className="text-lg font-semibold">{reading.status}</p>
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <Field label="UID do cartão" value={reading.uid} mono />
          <Field
            label="Tecnologias detectadas"
            value={reading.technologies.join(", ")}
          />
          <Field label="Compatibilidade" value={reading.compatibility} />
        </div>
      </Card>

      <Card className="p-4 rounded-2xl border-primary/20 bg-primary/5">
        <p className="text-sm text-foreground/85 leading-relaxed">
          <span className="font-semibold text-primary">Saldo:</span> indisponível
          nesta versão.
        </p>
        <p className="text-xs text-muted-foreground mt-1.5">
          Saldo disponível apenas se a leitura for autorizada e compatível.
        </p>
      </Card>

      <Card className="p-3 rounded-2xl border-dashed">
        <Badge variant="secondary" className="text-[10px]">DEMONSTRAÇÃO</Badge>
        <p className="text-xs text-muted-foreground mt-2">
          Dados simulados para demonstrar o fluxo NFC. Este app não acessa
          dados reais do cartão.
        </p>
      </Card>

      <div className="mt-auto space-y-2">
        <Button
          onClick={onNew}
          size="lg"
          className="w-full h-14 rounded-2xl bg-gradient-primary font-semibold"
        >
          <Nfc className="w-5 h-5 mr-2" /> Nova leitura
        </Button>
        <Button
          onClick={onHistory}
          variant="outline"
          size="lg"
          className="w-full h-14 rounded-2xl"
        >
          <History className="w-5 h-5 mr-2" /> Ver histórico
        </Button>
      </div>
    </div>
  </div>
);

const Field = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="border-t border-primary-foreground/15 pt-2">
    <p className="text-xs opacity-75 uppercase tracking-wider">{label}</p>
    <p className={`mt-0.5 ${mono ? "font-mono text-sm" : "text-sm"}`}>{value}</p>
  </div>
);

export default ResultScreen;
