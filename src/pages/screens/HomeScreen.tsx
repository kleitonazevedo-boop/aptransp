import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Nfc, History, Info, Smartphone } from "lucide-react";

interface Props {
  onStart: () => void;
  onHistory: () => void;
  onAbout: () => void;
}

const HomeScreen = ({ onStart, onHistory, onAbout }: Props) => (
  <div className="flex flex-col flex-1">
    <div className="screen-padding flex flex-col gap-6 flex-1">
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-soft">
            <Nfc className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">Leitor NFC</span>
        </div>
        <button
          onClick={onAbout}
          className="text-sm text-muted-foreground hover:text-foreground transition"
        >
          Sobre
        </button>
      </div>

      <div className="mt-2 animate-fade-in-up">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          Leitor Bilhete NFC
        </h1>
        <p className="text-muted-foreground mt-2 leading-relaxed">
          Consulte informações técnicas do seu cartão por aproximação NFC.
        </p>
      </div>

      <Card className="p-6 bg-gradient-card text-primary-foreground border-0 shadow-elevated rounded-3xl">
        <div className="flex items-start gap-4">
          <Smartphone className="w-8 h-8 shrink-0 opacity-90" />
          <div>
            <p className="font-semibold text-base">
              Aproxime seu Bilhete Único da parte traseira do celular
            </p>
            <p className="text-sm opacity-80 mt-1">
              Mantenha o cartão estável durante a leitura.
            </p>
          </div>
        </div>
      </Card>

      <Button
        onClick={onStart}
        size="lg"
        className="h-16 text-base font-semibold rounded-2xl shadow-soft bg-gradient-primary hover:opacity-95"
      >
        <Nfc className="w-5 h-5 mr-2" />
        Iniciar leitura
      </Button>

      <Card className="p-4 rounded-2xl border-warning/30 bg-warning/5">
        <p className="text-sm text-foreground/80 leading-relaxed">
          <span className="font-semibold text-warning">Aviso:</span> esta versão
          usa dados simulados para demonstrar o fluxo de leitura NFC.
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3 mt-auto">
        <button
          onClick={onHistory}
          className="p-4 rounded-2xl border border-border bg-card hover:bg-muted/50 transition flex flex-col items-start gap-2 shadow-sm"
        >
          <History className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium">Histórico</span>
        </button>
        <button
          onClick={onAbout}
          className="p-4 rounded-2xl border border-border bg-card hover:bg-muted/50 transition flex flex-col items-start gap-2 shadow-sm"
        >
          <Info className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium">Sobre o app</span>
        </button>
      </div>
    </div>
  </div>
);

export default HomeScreen;
