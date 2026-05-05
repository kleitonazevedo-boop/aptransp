import { useEffect, useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { NfcAnimation } from "@/components/NfcAnimation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { generateReading, NfcReading } from "@/lib/nfc";
import { ErrorKind } from "./ErrorScreen";
import { CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  onBack: () => void;
  onSuccess: (r: NfcReading) => void;
  onError: (k: ErrorKind) => void;
}

const STEPS = [
  "Procurando cartão…",
  "Cartão detectado…",
  "Validando compatibilidade…",
];

const ReadScreen = ({ onBack, onSuccess, onError }: Props) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 1400);
    const t2 = setTimeout(() => setStep(2), 2800);
    const t3 = setTimeout(() => onSuccess(generateReading()), 4400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onSuccess]);

  return (
    <div className="flex flex-col flex-1">
      <ScreenHeader title="Lendo cartão" onBack={onBack} />
      <div className="screen-padding flex flex-col gap-6 flex-1">
        <p className="text-muted-foreground text-center">
          Mantenha o cartão encostado na parte traseira do celular.
        </p>

        <NfcAnimation />

        <Card className="p-5 rounded-2xl shadow-soft">
          <div className="space-y-3">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <div key={s} className="flex items-center gap-3">
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  ) : active ? (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-muted" />
                  )}
                  <span
                    className={`text-sm ${
                      active
                        ? "text-foreground font-medium"
                        : done
                        ? "text-muted-foreground"
                        : "text-muted-foreground/60"
                    }`}
                  >
                    {s}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="mt-auto">
          <p className="text-xs text-muted-foreground mb-2 text-center">
            Simular cenário de erro:
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => onError("no-nfc")}>
              Sem NFC
            </Button>
            <Button variant="outline" size="sm" onClick={() => onError("nfc-off")}>
              NFC desligado
            </Button>
            <Button variant="outline" size="sm" onClick={() => onError("incompatible")}>
              Não compatível
            </Button>
            <Button variant="outline" size="sm" onClick={() => onError("protected")}>
              Leitura protegida
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReadScreen;
