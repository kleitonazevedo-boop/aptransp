import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/ui/card";
import { ShieldCheck, Info } from "lucide-react";

interface Props {
  onBack: () => void;
}

const items = [
  "Este app não é oficial da SPTrans.",
  "Este app não possui vínculo com SPTrans, Bilhete Único, Ponto Certo ou qualquer órgão público.",
  "A primeira versão demonstra apenas o fluxo de leitura NFC com dados simulados.",
  "O app não tenta burlar proteções, criptografia ou áreas restritas do cartão.",
  "O saldo real só poderá ser exibido se houver autorização, compatibilidade técnica e integração legítima.",
];

const AboutScreen = ({ onBack }: Props) => (
  <div className="flex flex-col flex-1">
    <ScreenHeader title="Sobre o app" onBack={onBack} />
    <div className="screen-padding flex flex-col gap-4">
      <Card className="p-6 rounded-3xl bg-gradient-card text-primary-foreground border-0 shadow-elevated">
        <ShieldCheck className="w-10 h-10 mb-3 opacity-90" />
        <h2 className="text-xl font-bold">Consulta de Saldo NFC</h2>
        <p className="text-sm opacity-85 mt-1">
          Protótipo demonstrativo de leitura NFC para fins educacionais.
        </p>
      </Card>

      <Card className="p-5 rounded-2xl shadow-soft space-y-3">
        {items.map((t, i) => (
          <div key={i} className="flex gap-3">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/85 leading-relaxed">{t}</p>
          </div>
        ))}
      </Card>

      <Card className="p-4 rounded-2xl bg-muted/40 border-dashed">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Esta versão funciona em navegador como protótipo visual. A leitura
          NFC real requer integração nativa Android e autorização adequada.
        </p>
      </Card>

      <p className="text-center text-xs text-muted-foreground mt-2">
        Versão 1.0 • Demonstrativo
      </p>
    </div>
  </div>
);

export default AboutScreen;
