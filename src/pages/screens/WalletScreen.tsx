import { useState } from "react";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { SideMenu } from "@/components/SideMenu";
import { AlertTriangle, Map, Route, Construction } from "lucide-react";
const mapaImg = "/mapa-transporte.jpg";

interface Props {
  onAbout: () => void;
  onOpenMap: () => void;
  onOpenRoute: () => void;
  onOpenNfcDiagnostic: () => void;
}

const WalletScreen = ({ onAbout, onOpenMap, onOpenRoute, onOpenNfcDiagnostic }: Props) => {
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

  const cardTransition = { type: "spring" as const, stiffness: 260, damping: 30 };

  return (
    <div className="flex-1 flex flex-col bg-slate-100 relative overflow-hidden">
      {/* Top purple header */}
      <header className="bg-brand-purple text-white px-4 pt-4 pb-6 flex items-center justify-between rounded-b-3xl z-30 relative shadow-md">
        <SideMenu
          onBalance={() => setBalance(null)}
          onMap={onOpenMap}
          onRoute={onOpenRoute}
          onAbout={onAbout}
          onNfcDiagnostic={onOpenNfcDiagnostic}
        />
        <div className="flex items-center gap-2">
          <Logo className="w-8 h-8" />
        </div>
        <AlertTriangle className="w-5 h-5 text-brand-yellow" />
      </header>

      {/* Stacked snap-scroll cards */}
      <div
        className="flex-1 overflow-y-auto snap-y snap-mandatory scroll-smooth -mt-4 pb-4"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        <style>{`.stack-scroll::-webkit-scrollbar{display:none}`}</style>

        {/* Card 1: Balance / NFC */}
        <section className="snap-start snap-always min-h-[88vh] flex items-start justify-center px-4 pt-2">
          <motion.button
            onClick={handleTap}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...cardTransition, delay: 0.05 }}
            whileTap={{ scale: 0.98 }}
            className="bg-brand-blue rounded-[2rem] p-6 text-white shadow-elevated text-left flex flex-col items-center w-full h-[85vh] justify-center"
          >
            <p className="text-6xl font-light tracking-tight">
              {balance !== null ? balance.toFixed(2) : "00.00"}
            </p>
            <p className="text-sm opacity-90 mt-1">Saldo</p>

            <div className="relative my-8 w-28 h-28 flex items-center justify-center">
              {reading && (
                <>
                  <span className="absolute w-28 h-28 rounded-full border-2 border-white/60 animate-nfc-wave" />
                  <span className="absolute w-28 h-28 rounded-full border-2 border-white/60 animate-nfc-wave-2" />
                  <span className="absolute w-28 h-28 rounded-full border-2 border-white/60 animate-nfc-wave-3" />
                </>
              )}
              <div
                className={`w-24 h-24 rounded-full bg-white/15 flex items-center justify-center ${
                  reading ? "animate-pulse-soft" : ""
                }`}
              >
                <div className="w-14 h-14 rounded-full bg-brand-yellow shadow-glow" />
              </div>
            </div>

            <p className="text-lg font-semibold">
              {reading ? "Lendo cartão..." : "Encoste para ler"}
            </p>
            <div className="mt-4 bg-blue-900/50 rounded-xl px-4 py-2">
              <p className="text-xs text-center leading-snug">
                Aproxime seu Bilhete Único da parte traseira do celular
              </p>
            </div>
          </motion.button>
        </section>

        {/* Card 2: Map - overlaps previous */}
        <section className="snap-start snap-always min-h-[88vh] flex items-start justify-center px-4 -mt-20 relative z-10">
          <motion.button
            onClick={onOpenMap}
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={cardTransition}
            whileTap={{ scale: 0.98 }}
            className="rounded-[2rem] overflow-hidden shadow-elevated bg-white text-left w-full h-[85vh] flex flex-col"
          >
            <div className="bg-sky-300 text-blue-900 font-bold text-center py-4 flex items-center justify-center gap-2 text-lg">
              <Map className="w-5 h-5" /> Mapa do Transporte
            </div>
            <div className="bg-white p-3 flex-1">
              <img
                src={mapaImg}
                alt="Mapa do transporte metropolitano"
                className="w-full h-full object-cover object-top rounded-2xl"
              />
            </div>
          </motion.button>
        </section>

        {/* Card 3: Route */}
        <section className="snap-start snap-always min-h-[88vh] flex items-start justify-center px-4 -mt-20 relative z-20">
          <motion.button
            onClick={onOpenRoute}
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={cardTransition}
            whileTap={{ scale: 0.98 }}
            className="rounded-[2rem] overflow-hidden shadow-elevated bg-white text-left w-full h-[85vh] flex flex-col"
          >
            <div className="bg-brand-yellow text-blue-900 font-bold text-center py-4 flex items-center justify-center gap-2 text-lg">
              <Route className="w-5 h-5" /> Traçado de Rota
            </div>
            <div className="bg-white flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Construction className="w-12 h-12" />
              <span className="text-base font-medium">em construção</span>
            </div>
          </motion.button>
        </section>
      </div>
    </div>
  );
};

export default WalletScreen;
