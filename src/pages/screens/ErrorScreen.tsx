import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SignalZero, WifiOff, XCircle, Lock } from "lucide-react";

export type ErrorKind = "no-nfc" | "nfc-off" | "incompatible" | "protected";

const CONFIG: Record<
  ErrorKind,
  { title: string; desc: string; icon: React.ReactNode; tint: string }
> = {
  "no-nfc": {
    title: "Aparelho sem NFC",
    desc: "Este aparelho não possui NFC ou o recurso não está disponível para o navegador/app atual.",
    icon: <SignalZero className="w-8 h-8" />,
    tint: "text-destructive bg-destructive/10",
  },
  "nfc-off": {
    title: "NFC desligado",
    desc: "Ative o NFC nas configurações do Android e tente novamente.",
    icon: <WifiOff className="w-8 h-8" />,
    tint: "text-warning bg-warning/10",
  },
  incompatible: {
    title: "Cartão não compatível",
    desc: "O cartão detectado não é compatível com esta leitura básica.",
    icon: <XCircle className="w-8 h-8" />,
    tint: "text-destructive bg-destructive/10",
  },
  protected: {
    title: "Leitura protegida",
    desc: "Algumas áreas do cartão são protegidas e não podem ser lidas sem autorização.",
    icon: <Lock className="w-8 h-8" />,
    tint: "text-warning bg-warning/10",
  },
};

interface Props {
  kind: ErrorKind;
  onRetry: () => void;
  onHome: () => void;
}

const ErrorScreen = ({ kind, onRetry, onHome }: Props) => {
  const c = CONFIG[kind];
  return (
    <div className="flex flex-col flex-1">
      <ScreenHeader title="Não foi possível ler" onBack={onHome} />
      <div className="screen-padding flex flex-col gap-5 flex-1">
        <Card className="p-6 rounded-3xl shadow-soft text-center animate-fade-in-up">
          <div
            className={`w-20 h-20 rounded-full ${c.tint} flex items-center justify-center mx-auto mb-4`}
          >
            {c.icon}
          </div>
          <h2 className="text-xl font-bold text-foreground">{c.title}</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {c.desc}
          </p>
        </Card>

        <div className="mt-auto space-y-2">
          <Button
            onClick={onRetry}
            size="lg"
            className="w-full h-14 rounded-2xl bg-gradient-primary font-semibold"
          >
            Tentar novamente
          </Button>
          <Button
            onClick={onHome}
            variant="outline"
            size="lg"
            className="w-full h-14 rounded-2xl"
          >
            Voltar ao início
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ErrorScreen;
