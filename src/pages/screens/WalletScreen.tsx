import { useState } from "react";
import { Logo } from "@/components/Logo";
import { SideMenu } from "@/components/SideMenu";
import { AlertTriangle, Map } from "lucide-react";
import mapaImg from "/mapa-transporte.png";

interface Props {
  onAbout: () => void;
  onOpenMap: () => void;
}

const WalletScreen = ({ onAbout, onOpenMap }: Props) => {
  const [balance, setBalance] = useState<number | null>(null);
  const [reading, setReading] = useState(false);

  const handleTap = () => {
    if (reading) return;
    setReading(true);
    setTimeout(() => {
      const val = Math.round((Math.random() * 50 + 5) * 100) / 100;
      setBalance(val);
      setReading(false);
    }, 1800);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-100">
      {/* Top purple header */}
      <header className="bg-brand-purple text-white px-4 pt-4 pb-8 flex items-center justify-between rounded-b-3xl">
        <SideMenu onBalance={() => setBalance(null)} onMap={onOpenMap} onAbout={onAbout} />
        <div className="flex items-center gap-2">
          <Logo className="w-8 h-8" />
        </div>
        <AlertTriangle className="w-5 h-5 text-brand-yellow" />
      </header>

      {/* Wallet stack */}
      <div className="px-4 -mt-4 flex-1 flex flex-col gap-3">
        {/* Blue card - balance */}
        <button
          onClick={handleTap}
          className="bg-brand-blue rounded-3xl p-6 text-white shadow-elevated text-left flex flex-col items-center"
        >
          <p className="text-5xl font-light tracking-tight">
            {balance !== null ? balance.toFixed(2) : "00.00"}
          </p>
          <p className="text-sm opacity-90 mt-1">Saldo</p>

          {/* NFC contact icon with yellow dot */}
          <div className="relative my-5 w-24 h-24 flex items-center justify-center">
            {reading && (
              <>
                <span className="absolute w-24 h-24 rounded-full border-2 border-white/60 animate-nfc-wave" />
                <span className="absolute w-24 h-24 rounded-full border-2 border-white/60 animate-nfc-wave-2" />
                <span className="absolute w-24 h-24 rounded-full border-2 border-white/60 animate-nfc-wave-3" />
              </>
            )}
            <div className={`w-20 h-20 rounded-full bg-white/15 flex items-center justify-center ${reading ? "animate-pulse-soft" : ""}`}>
              <div className="w-12 h-12 rounded-full bg-brand-yellow shadow-glow" />
            </div>
          </div>

          <p className="text-base font-semibold">
            {reading ? "Lendo cartão..." : "Encoste para ler"}
          </p>
          <div className="mt-3 bg-blue-900/50 rounded-lg px-3 py-2">
            <p className="text-xs text-center leading-snug">
              Aproxime seu Bilhete Único da parte traseira do celular
            </p>
          </div>
        </button>

        {/* Map card */}
        <button
          onClick={onOpenMap}
          className="rounded-3xl overflow-hidden shadow-elevated bg-white text-left mb-4"
        >
          <div className="bg-sky-300 text-blue-900 font-bold text-center py-3 flex items-center justify-center gap-2">
            <Map className="w-5 h-5" /> Mapa do Transporte
          </div>
          <div className="bg-white p-2">
            <img src={mapaImg} alt="Mapa do transporte metropolitano" className="w-full h-24 object-cover object-top rounded-lg" />
          </div>
        </button>
      </div>
    </div>
  );
};

export default WalletScreen;
