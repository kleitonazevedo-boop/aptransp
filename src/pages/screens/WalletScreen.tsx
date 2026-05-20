import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/Logo";
import { SideMenu } from "@/components/SideMenu";
import { AlertTriangle, Map, Route, Construction, CreditCard } from "lucide-react";
const mapaImg = "/mapa-transporte.jpg";

interface Props {
  onAbout: () => void;
  onOpenMap: () => void;
  onOpenRoute: () => void;
  onOpenNfcDiagnostic: () => void;
}

type CardId = "balance" | "map" | "route";

const WalletScreen = ({ onAbout, onOpenMap, onOpenRoute, onOpenNfcDiagnostic }: Props) => {
  const [balance, setBalance] = useState<number | null>(null);
  const [reading, setReading] = useState(false);
  const [active, setActive] = useState<CardId>("balance");

  const handleTap = () => {
    if (reading) return;
    setReading(true);
    setTimeout(() => {
      const val = Math.round((Math.random() * 50 + 5) * 100) / 100;
      setBalance(val);
      setReading(false);
    }, 1800);
  };

  const order: CardId[] = ["balance", "map", "route"];
  const activeIndex = order.indexOf(active);

  const cardMeta: Record<CardId, { title: string; bar: string; icon: JSX.Element }> = {
    balance: {
      title: "Saldo do Cartão",
      bar: "bg-brand-blue text-white",
      icon: <CreditCard className="w-5 h-5" />,
    },
    map: {
      title: "Mapa do Transporte",
      bar: "bg-sky-300 text-blue-900",
      icon: <Map className="w-5 h-5" />,
    },
    route: {
      title: "Traçado de Rota",
      bar: "bg-brand-yellow text-blue-900",
      icon: <Route className="w-5 h-5" />,
    },
  };

  const spring = { type: "spring" as const, stiffness: 320, damping: 34 };

  const renderContent = (id: CardId) => {
    if (id === "balance") {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); handleTap(); }}
          className="w-full h-full flex flex-col items-center justify-center text-white px-6"
        >
          <p className="text-6xl font-light tracking-tight">
            {balance !== null ? balance.toFixed(2) : "00.00"}
          </p>
          <p className="text-sm opacity-90 mt-1">Saldo</p>
          <div className="relative my-6 w-28 h-28 flex items-center justify-center">
            {reading && (
              <>
                <span className="absolute w-28 h-28 rounded-full border-2 border-white/60 animate-nfc-wave" />
                <span className="absolute w-28 h-28 rounded-full border-2 border-white/60 animate-nfc-wave-2" />
                <span className="absolute w-28 h-28 rounded-full border-2 border-white/60 animate-nfc-wave-3" />
              </>
            )}
            <div className={`w-24 h-24 rounded-full bg-white/15 flex items-center justify-center ${reading ? "animate-pulse-soft" : ""}`}>
              <div className="w-14 h-14 rounded-full bg-brand-yellow shadow-glow" />
            </div>
          </div>
          <p className="text-lg font-semibold">{reading ? "Lendo cartão..." : "Encoste para ler"}</p>
          <div className="mt-3 bg-blue-900/50 rounded-xl px-4 py-2">
            <p className="text-xs text-center leading-snug">
              Aproxime seu Bilhete Único da parte traseira do celular
            </p>
          </div>
        </button>
      );
    }
    if (id === "map") {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); onOpenMap(); }}
          className="w-full h-full p-3 bg-white"
        >
          <img src={mapaImg} alt="Mapa do transporte" className="w-full h-full object-cover object-top rounded-2xl" />
        </button>
      );
    }
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onOpenRoute(); }}
        className="w-full h-full bg-white flex flex-col items-center justify-center gap-3 text-muted-foreground"
      >
        <Construction className="w-12 h-12" />
        <span className="text-base font-medium">em construção</span>
      </button>
    );
  };

  const COLLAPSED_PEEK = 64; // px visible per collapsed card at bottom

  return (
    <div className="flex-1 flex flex-col bg-slate-100 relative overflow-hidden">
      <header className="bg-brand-purple text-white px-4 pt-4 pb-6 flex items-center justify-between rounded-b-3xl z-30 relative shadow-md">
        <SideMenu
          onBalance={() => { setBalance(null); setActive("balance"); }}
          onMap={onOpenMap}
          onRoute={onOpenRoute}
          onAbout={onAbout}
          onNfcDiagnostic={onOpenNfcDiagnostic}
        />
        <div className="flex items-center gap-2"><Logo className="w-8 h-8" /></div>
        <AlertTriangle className="w-5 h-5 text-brand-yellow" />
      </header>

      {/* Stacked card deck */}
      <div className="flex-1 relative px-3 -mt-4">
        {order.map((id, index) => {
          const isActive = id === active;
          const meta = cardMeta[id];
          const positionFromActive = index - activeIndex;

          // Active card fills the deck. Cards below the active peek from the bottom.
          // Cards above the active (already visited) tuck near the top.
          let top = 0;
          let zIndex = 10;

          if (positionFromActive === 0) {
            top = 0;
            zIndex = 30;
          } else if (positionFromActive > 0) {
            // peeks at bottom — stack downward
            top = `calc(100% - ${(order.length - index) * COLLAPSED_PEEK}px)` as unknown as number;
            zIndex = 20 + positionFromActive;
          } else {
            // collapsed above (visited)
            top = (index * 18) as number;
            zIndex = 5 + index;
          }

          return (
            <motion.div
              key={id}
              onClick={() => !isActive && setActive(id)}
              initial={false}
              animate={{
                top: top as any,
                height: isActive ? "calc(100% - 24px)" : `${COLLAPSED_PEEK + 24}px`,
                scale: isActive ? 1 : 0.98,
              }}
              transition={spring}
              style={{ zIndex }}
              className={`absolute left-3 right-3 rounded-[2rem] overflow-hidden shadow-elevated bg-white ${isActive ? "" : "cursor-pointer"}`}
              whileTap={isActive ? undefined : { scale: 0.96 }}
            >
              <div className={`${meta.bar} font-bold flex items-center justify-center gap-2 py-4 text-lg`}>
                {meta.icon}
                <span>{meta.title}</span>
              </div>
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    key="content"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, delay: 0.1 }}
                    className={`absolute inset-0 top-[56px] ${id === "balance" ? "bg-brand-blue" : "bg-white"}`}
                  >
                    {renderContent(id)}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default WalletScreen;
