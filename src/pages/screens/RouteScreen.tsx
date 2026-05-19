import { ArrowLeft, Route, Construction } from "lucide-react";
import { Logo } from "@/components/Logo";

const RouteScreen = ({ onBack }: { onBack: () => void }) => (
  <div className="flex-1 flex flex-col bg-white">
    <header className="bg-brand-purple text-white px-4 pt-4 pb-3 flex items-center justify-between">
      <button onClick={onBack} aria-label="Voltar" className="p-1">
        <ArrowLeft className="w-6 h-6" />
      </button>
      <Logo className="w-8 h-8" />
      <Route className="w-5 h-5 text-brand-yellow" />
    </header>
    <div className="bg-brand-purple text-white text-center text-sm font-bold py-2">
      TRAÇADO DE ROTA
    </div>
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-brand-yellow/20 flex items-center justify-center">
        <Construction className="w-10 h-10 text-brand-yellow" />
      </div>
      <h2 className="text-xl font-bold text-foreground">Em construção</h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        Esta funcionalidade está sendo desenvolvida. Em breve você poderá traçar rotas
        no transporte metropolitano.
      </p>
    </div>
  </div>
);

export default RouteScreen;
