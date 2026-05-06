import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

interface Props {
  onBack: () => void;
  onPrivacy: () => void;
  onTerms: () => void;
}

const AboutScreen = ({ onBack, onPrivacy, onTerms }: Props) => (
  <div className="flex-1 flex flex-col bg-white">
    <header className="bg-brand-purple text-white px-4 py-4 flex items-center gap-3">
      <button onClick={onBack} aria-label="Voltar"><ArrowLeft className="w-6 h-6" /></button>
      <h1 className="font-bold">Sobre</h1>
    </header>
    <div className="flex-1 px-6 py-8 flex flex-col items-center text-center overflow-y-auto">
      <Logo className="w-20 h-20 mb-3" />
      <h2 className="text-2xl font-bold">APTRANSP</h2>
      <p className="text-sm text-muted-foreground">Versão 1.0.0</p>
      <p className="text-sm mt-4 font-medium">Desenvolvido por Azevedo's Corp</p>
      <p className="text-sm text-muted-foreground mt-4 leading-relaxed max-w-sm">
        Facilitando seu dia a dia no transporte público das grandes cidades, um jeito simples e
        compacto para consultar saldo do bilhete único e o mapa do transporte metropolitano.
      </p>

      <h3 className="font-semibold mt-8 mb-2">Links Úteis</h3>
      <div className="flex flex-col gap-2 text-primary text-sm">
        <button onClick={onPrivacy} className="underline">Política de Privacidade</button>
        <button onClick={onTerms} className="underline">Termos de Uso</button>
        <button className="underline">Central de Ajuda</button>
      </div>

      <p className="text-xs text-muted-foreground mt-10">
        © 2026 Azevedo's Corp. Todos os direitos reservados.
      </p>
    </div>
  </div>
);

export default AboutScreen;
