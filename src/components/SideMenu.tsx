import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Wallet, Map, Info } from "lucide-react";
import { Logo } from "./Logo";

interface Props {
  onBalance: () => void;
  onMap: () => void;
  onAbout: () => void;
}

export const SideMenu = ({ onBalance, onMap, onAbout }: Props) => (
  <Sheet>
    <SheetTrigger asChild>
      <button aria-label="Abrir menu" className="text-white p-1">
        <Menu className="w-6 h-6" />
      </button>
    </SheetTrigger>
    <SheetContent side="left" className="w-72 p-0 flex flex-col bg-brand-purple text-white border-0">
      <div className="p-6 flex items-center gap-3 border-b border-white/15">
        <Logo className="w-10 h-10" />
        <div>
          <p className="font-bold">APTRANSP</p>
          <p className="text-xs opacity-75">Menu</p>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        <MenuItem icon={<Wallet className="w-5 h-5" />} label="Consulta de saldo" onClick={onBalance} />
        <MenuItem icon={<Map className="w-5 h-5" />} label="Mapa do transporte" onClick={onMap} />
      </nav>
      <div className="p-3 border-t border-white/15">
        <MenuItem icon={<Info className="w-5 h-5" />} label="Sobre" onClick={onAbout} />
      </div>
    </SheetContent>
  </Sheet>
);

const MenuItem = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
  <button
    onClick={() => {
      onClick();
      // close sheet via Escape
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    }}
    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 text-left"
  >
    {icon}
    <span className="font-medium">{label}</span>
  </button>
);
