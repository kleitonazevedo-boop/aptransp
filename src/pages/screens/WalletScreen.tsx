import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/Logo";
import { SideMenu } from "@/components/SideMenu";
import RouteScreen from "./RouteScreen";
import {
  AlertTriangle,
  Map as MapIcon,
  Route as RouteIcon,
  CreditCard,
  Bell,
  Star,
  Bus,
  Train,
  Home,
  Briefcase,
  MapPin,
  Crosshair,
  ArrowLeftRight,
  ChevronRight,
} from "lucide-react";
const mapaImg = "/mapa-transporte.jpg";

interface Props {
  onAbout: () => void;
  onOpenMap: () => void;
  onOpenRoute: () => void;
  onOpenNearby: () => void;
  onOpenNfcDiagnostic: () => void;
  onOpenProfile: () => void;
  onOpenAdmin: () => void;
}

type CardId = "balance" | "map" | "route" | "alerts" | "favorites";

interface CardMeta {
  title: string;
  bar: string;
  body: string;
  icon: JSX.Element;
}

const WalletScreen = ({ onAbout, onOpenMap, onOpenRoute, onOpenNearby, onOpenNfcDiagnostic, onOpenProfile, onOpenAdmin }: Props) => {
  const [balance, setBalance] = useState<number | null>(null);
  const [reading, setReading] = useState(false);
  const [active, setActive] = useState<CardId | null>(null);

  // Route inputs
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");

  // Tabs
  const [alertTab, setAlertTab] = useState<"todos" | "interdicoes" | "atrasos">("todos");
  const [favTab, setFavTab] = useState<"linhas" | "rotas">("linhas");

  const handleTap = () => {
    if (reading) return;
    setReading(true);
    setTimeout(() => {
      const val = Math.round((Math.random() * 50 + 5) * 100) / 100;
      setBalance(val);
      setReading(false);
    }, 1800);
  };

  const handleGps = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setOrigin(`Lat ${pos.coords.latitude.toFixed(4)}, Lng ${pos.coords.longitude.toFixed(4)}`),
      () => setOrigin("Localização indisponível"),
    );
  };

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const order: CardId[] = ["balance", "map", "route", "alerts", "favorites"];
  const activeIndex = active ? order.indexOf(active) : -1;

  const cardMeta: Record<CardId, CardMeta> = {
    balance: {
      title: "Saldo do Cartão",
      bar: "bg-brand-blue text-white",
      body: "bg-brand-blue",
      icon: <CreditCard className="w-5 h-5" />,
    },
    map: {
      title: "Mapa do Transporte",
      bar: "bg-sky-300 text-blue-900",
      body: "bg-sky-100",
      icon: <MapIcon className="w-5 h-5" />,
    },
    route: {
      title: "Traçado de Rota",
      bar: "bg-brand-yellow text-blue-900",
      body: "bg-amber-300",
      icon: <RouteIcon className="w-5 h-5" />,
    },
    alerts: {
      title: "Alertas",
      bar: "bg-red-500 text-white",
      body: "bg-red-200",
      icon: <Bell className="w-5 h-5" />,
    },
    favorites: {
      title: "Favoritos",
      bar: "bg-green-300 text-emerald-900",
      body: "bg-green-100",
      icon: <Star className="w-5 h-5" />,
    },
  };

  const spring = { type: "spring" as const, stiffness: 320, damping: 34 };

  const renderContent = (id: CardId) => {
    if (id === "balance") {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); handleTap(); }}
          className="w-full h-full flex flex-col items-center justify-center text-white px-6 pb-[240px]"
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
        <div className="w-full h-full flex flex-col p-4 gap-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <p className="text-center text-blue-900 font-semibold text-sm mb-1">Mapa do Transporte Metropolitano</p>
            <p className="text-center text-blue-900/60 text-[10px] mb-2">Metropolitan Transport Network</p>
            <img src={mapaImg} alt="Preview do mapa" className="w-full h-32 object-cover rounded-xl" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <ActionTile icon={<MapIcon className="w-5 h-5" />} label="Abrir mapa" onClick={onOpenMap} tone="sky" />
            <ActionTile icon={<Bus className="w-5 h-5" />} label="Linhas próximas" onClick={onOpenNearby} tone="sky" />
            <ActionTile icon={<Train className="w-5 h-5" />} label="Estações próximas" onClick={onOpenNearby} tone="sky" />
            <ActionTile icon={<Star className="w-5 h-5" />} label="Favoritos" onClick={() => {}} tone="sky" />
          </div>
        </div>
      );
    }

    if (id === "route") {
      return (
        <div className="w-full h-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <RouteScreen embedded />
        </div>
      );
    }

    if (id === "alerts") {
      const items = [
        { type: "interdicoes", title: "Interdição na Av. Paulista", sub: "Desvio de itinerário", time: "Hoje, 08:15" },
        { type: "atrasos", title: "Atrasos na Linha 123", sub: "Tráfego intenso", time: "Hoje, 07:45" },
        { type: "interdicoes", title: "Greve programada", sub: "Atenção aos horários", time: "Amanhã" },
      ].filter((i) => alertTab === "todos" || i.type === alertTab);
      return (
        <div className="w-full h-full flex flex-col p-4 gap-3" onClick={(e) => e.stopPropagation()}>
          <Tabs
            tabs={[
              { id: "todos", label: "Todos" },
              { id: "interdicoes", label: "Interdições" },
              { id: "atrasos", label: "Atrasos" },
            ]}
            active={alertTab}
            onChange={(v) => setAlertTab(v as typeof alertTab)}
            tone="purple"
          />
          <div className="flex-1 overflow-auto space-y-2">
            {items.map((it, i) => (
              <div key={i} className="bg-white/80 rounded-2xl p-3 flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-purple-900">{it.title}</p>
                  <p className="text-xs text-purple-900/70">{it.sub}</p>
                </div>
                <span className="text-[10px] text-purple-900/60">{it.time}</span>
              </div>
            ))}
          </div>
          <button className="w-full bg-purple-700 text-white rounded-full py-3 text-sm font-semibold shadow-md">
            Ver todos os alertas
          </button>
        </div>
      );
    }

    // favorites
    const linhas = [
      { name: "Linha 123", sub: "Terminal → Centro" },
      { name: "Linha 456", sub: "Terminal → Bairro" },
    ];
    const rotas = [
      { name: "Casa → Trabalho", sub: "Via Av. Paulista" },
      { name: "Centro → Shopping", sub: "Via Metrô" },
    ];
    const list = favTab === "linhas" ? linhas : rotas;
    return (
      <div className="w-full h-full flex flex-col p-4 gap-3" onClick={(e) => e.stopPropagation()}>
        <Tabs
          tabs={[
            { id: "linhas", label: "Linhas" },
            { id: "rotas", label: "Rotas" },
          ]}
          active={favTab}
          onChange={(v) => setFavTab(v as typeof favTab)}
          tone="green"
        />
        <div className="flex-1 overflow-auto space-y-2">
          {list.map((it, i) => (
            <div key={i} className="bg-white/80 rounded-2xl p-3 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-900">{it.name}</p>
                <p className="text-xs text-emerald-900/70">{it.sub}</p>
              </div>
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            </div>
          ))}
        </div>
        <button className="w-full bg-emerald-700 text-white rounded-full py-3 text-sm font-semibold shadow-md">
          Gerenciar favoritos
        </button>
      </div>
    );
  };

  const CARD_HEADER_HEIGHT = 56;
  const STACK_START = `calc(100% - ${(order.length - 1) * CARD_HEADER_HEIGHT}px)`;

  return (
    <div className="flex-1 flex flex-col bg-brand-purple relative overflow-hidden">
      <header className="bg-brand-purple text-white px-4 pt-4 pb-6 flex items-center justify-between z-30 relative">
        <SideMenu
          onBalance={() => { setBalance(null); setActive("balance"); }}
          onMap={() => setActive("map")}
          onRoute={() => setActive("route")}
          onAlerts={() => setActive("alerts")}
          onFavorites={() => setActive("favorites")}
          onAbout={onAbout}
          onNfcDiagnostic={onOpenNfcDiagnostic}
        />
        <div className="flex items-center gap-2"><Logo className="w-8 h-8" /></div>
        <AlertTriangle className="w-5 h-5 text-brand-yellow" />
      </header>

      <div className="flex-1 relative px-0 pb-0 -mt-4">
        {order.map((id, index) => {
          const isActive = id === active;
          const meta = cardMeta[id];
          const isInitial = active === null;
          const positionFromActive = activeIndex >= 0 ? index - activeIndex : 0;

          let top: number | string = 0;
          let height: number | string = "100%";
          let zIndex = 10 + index;

          if (isInitial) {
            if (id === "balance") {
              top = 0;
              height = "100%";
              zIndex = 30;
            } else {
              top = `calc(${STACK_START} + ${(index - 1) * CARD_HEADER_HEIGHT}px)`;
              height = "100%";
              zIndex = 30 + index;
            }
          } else if (isActive) {
            top = 0;
            height = "100%";
            zIndex = 50;
          } else if (positionFromActive > 0) {
            top = `calc(100% - ${(order.length - index) * CARD_HEADER_HEIGHT}px)`;
            height = "100%";
            zIndex = 30 + positionFromActive;
          } else {
            top = index * 12;
            height = "100%";
            zIndex = 10 + index;
          }

          return (
            <motion.div
              key={id}
              onClick={() => setActive(isActive ? null : id)}
              initial={false}
              animate={{ top, height, scale: 1 }}
              transition={spring}
              style={{ zIndex }}
              className={`absolute -left-px -right-px rounded-t-3xl overflow-hidden shadow-elevated cursor-pointer ${meta.body}`}
            >

              <div className={`${meta.bar} font-bold flex items-center justify-center gap-2 py-4 text-base`}>
                {meta.icon}
                <span>{meta.title}</span>
              </div>
              <AnimatePresence>
                {(isActive || (isInitial && id === "balance")) && (
                  <motion.div
                    key="content"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, delay: 0.1 }}
                    className={`absolute inset-0 top-[56px] ${meta.body}`}
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

const ActionTile = ({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: JSX.Element;
  label: string;
  onClick: () => void;
  tone: "sky" | "amber";
}) => {
  const toneClass = tone === "sky" ? "bg-sky-200 text-blue-900" : "bg-amber-200 text-amber-900";
  return (
    <button
      onClick={onClick}
      className={`${toneClass} rounded-2xl p-2 flex flex-col items-center justify-center gap-1 aspect-square shadow-sm`}
    >
      {icon}
      <span className="text-[10px] font-semibold text-center leading-tight">{label}</span>
    </button>
  );
};

const Tabs = ({
  tabs,
  active,
  onChange,
  tone,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  tone: "purple" | "green";
}) => {
  const activeClass = tone === "purple" ? "bg-purple-700 text-white" : "bg-emerald-700 text-white";
  const inactiveClass = tone === "purple" ? "text-purple-900" : "text-emerald-900";
  return (
    <div className="bg-white/70 rounded-full p-1 flex gap-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex-1 py-2 rounded-full text-xs font-semibold transition-colors ${active === t.id ? activeClass : inactiveClass}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
};

const RecentRoute = ({ name, time }: { name: string; time: string }) => (
  <div className="flex items-center justify-between py-2 border-b border-amber-100 last:border-0">
    <span className="text-xs font-medium text-blue-900">{name}</span>
    <span className="text-xs text-blue-900/60 flex items-center gap-1">
      {time}
      <ChevronRight className="w-3 h-3" />
    </span>
  </div>
);

export default WalletScreen;
