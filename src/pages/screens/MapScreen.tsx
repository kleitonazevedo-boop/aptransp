import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Logo } from "@/components/Logo";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import mapaImg from "/mapa-transporte.png";

const MapScreen = ({ onBack }: { onBack: () => void }) => (
  <div className="flex-1 flex flex-col bg-white">
    <header className="bg-brand-purple text-white px-4 pt-4 pb-3 flex items-center justify-between">
      <button onClick={onBack} aria-label="Voltar" className="p-1">
        <ArrowLeft className="w-6 h-6" />
      </button>
      <Logo className="w-8 h-8" />
      <AlertTriangle className="w-5 h-5 text-brand-yellow" />
    </header>
    <button
      onClick={onBack}
      className="bg-brand-purple text-white text-center text-sm font-bold py-2 leading-tight"
    >
      MAPA METROPOLITANO SOBRE TRILHOS<br />SÃO PAULO
    </button>
    <div className="flex-1 overflow-hidden bg-slate-50">
      <TransformWrapper initialScale={1} minScale={1} maxScale={6} doubleClick={{ mode: "toggle" }}>
        <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
          <img src={mapaImg} alt="Mapa metropolitano" className="max-w-full max-h-full select-none" draggable={false} />
        </TransformComponent>
      </TransformWrapper>
    </div>
    <p className="text-center text-xs text-muted-foreground py-2">
      Use pinça ou duplo toque para zoom
    </p>
  </div>
);

export default MapScreen;
