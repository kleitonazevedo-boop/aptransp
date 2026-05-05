import { useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { clearHistory, formatDate, getHistory, NfcReading } from "@/lib/nfc";
import { Trash2, Inbox } from "lucide-react";

interface Props {
  onBack: () => void;
}

const statusVariant = (s: NfcReading["status"]): "default" | "secondary" | "destructive" => {
  if (s === "Cartão detectado") return "default";
  if (s === "Leitura parcial") return "secondary";
  return "destructive";
};

const HistoryScreen = ({ onBack }: Props) => {
  const [items, setItems] = useState<NfcReading[]>(getHistory());

  const handleClear = () => {
    clearHistory();
    setItems([]);
  };

  return (
    <div className="flex flex-col flex-1">
      <ScreenHeader
        title="Histórico de leituras"
        onBack={onBack}
        right={
          items.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <Trash2 className="w-4 h-4 mr-1" /> Limpar
            </Button>
          )
        }
      />
      <div className="screen-padding flex flex-col gap-3 flex-1">
        {items.length === 0 && (
          <Card className="p-8 rounded-3xl text-center mt-12">
            <Inbox className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-foreground font-medium">
              Nenhuma leitura registrada ainda.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Suas leituras simuladas aparecerão aqui.
            </p>
          </Card>
        )}
        {items.map((r) => (
          <Card key={r.id} className="p-4 rounded-2xl shadow-sm">
            <div className="flex items-start justify-between gap-2 mb-2">
              <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(r.timestamp)}
              </span>
            </div>
            <p className="font-mono text-sm text-foreground">{r.uid}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {r.technologies.join(", ")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {r.compatibility} • Saldo: {r.balance}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default HistoryScreen;
