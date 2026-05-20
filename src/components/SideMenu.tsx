import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Wallet, Map, Info, Route, Code2, ChevronDown, Radio, Terminal } from "lucide-react";
import { Logo } from "./Logo";

interface Props {
  onBalance: () => void;
  onMap: () => void;
  onRoute: () => void;
  onAbout: () => void;
  onNfcDiagnostic: () => void;
}

export const SideMenu = ({ onBalance, onMap, onRoute, onAbout, onNfcDiagnostic }: Props) => {
  const [open, setOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const navigate = useNavigate();

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button aria-label="Abrir menu" className="text-white p-1">
          <Menu className="w-6 h-6" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 p-0 flex flex-col bg-brand-purple text-white border-0"
      >
        <div className="p-6 flex items-center gap-3 border-b border-white/15">
          <Logo className="w-10 h-10" />
          <div>
            <p className="font-bold">APTRANSP</p>
            <p className="text-xs opacity-75">Menu</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <MenuItem
            icon={<Wallet className="w-5 h-5" />}
            label="Consulta de saldo"
            onClick={() => {
              onBalance();
              close();
            }}
          />
          <MenuItem
            icon={<Map className="w-5 h-5" />}
            label="Mapa do transporte"
            onClick={() => {
              onMap();
              close();
            }}
          />
          <MenuItem
            icon={<Route className="w-5 h-5" />}
            label="Traçado de Rota"
            onClick={() => {
              onRoute();
              close();
            }}
          />

          {/* Developer expandable */}
          <button
            onClick={() => setDevOpen((v) => !v)}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 text-left"
          >
            <Code2 className="w-5 h-5" />
            <span className="font-medium flex-1">Desenvolvedor</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${devOpen ? "rotate-180" : ""}`}
            />
          </button>
          {devOpen && (
            <div className="pl-6 space-y-1">
              <MenuItem
                icon={<Radio className="w-4 h-4" />}
                label="NFC Diagnostic Mode"
                onClick={() => {
                  onNfcDiagnostic();
                  close();
                }}
                small
              />
              <MenuItem
                icon={<Terminal className="w-4 h-4" />}
                label="NFC Debug"
                onClick={() => {
                  navigate("/nfc-debug");
                  close();
                }}
                small
              />
            </div>
          )}
        </nav>
        <div className="p-3 border-t border-white/15">
          <MenuItem
            icon={<Info className="w-5 h-5" />}
            label="Sobre"
            onClick={() => {
              onAbout();
              close();
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};

const MenuItem = ({
  icon,
  label,
  onClick,
  small,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  small?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 text-left ${
      small ? "text-sm" : ""
    }`}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </button>
);
