import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Menu, Wallet, Map, Info, Route, Code2, ChevronDown, Radio, Terminal,
  Bell, Star, User as UserIcon, ShieldAlert, LogOut,
} from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

interface Props {
  onBalance: () => void;
  onMap: () => void;
  onRoute: () => void;
  onAlerts: () => void;
  onFavorites: () => void;
  onAbout: () => void;
  onNfcDiagnostic: () => void;
  onProfile: () => void;
  onAdmin: () => void;
}

export const SideMenu = ({
  onBalance, onMap, onRoute, onAlerts, onFavorites, onAbout, onNfcDiagnostic,
  onProfile, onAdmin,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { isAdmin } = useUserRole();

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Abrir menu" className="h-11 w-11 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"><Menu className="w-6 h-6" /></Button>
      </SheetTrigger>
      <SheetContent side="left" className="app-side-menu w-72 p-0 flex flex-col bg-brand-purple text-white border-0">
        <div className="p-6 flex items-center gap-3 border-b border-white/15">
          <Logo className="w-10 h-10" />
          <div>
            <p className="font-bold">APTRANSP</p>
            <p className="text-xs opacity-75 truncate max-w-[180px]">{user?.email ?? "Menu"}</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <MenuItem icon={<UserIcon className="w-5 h-5" />} label="Meu Perfil" onClick={() => { onProfile(); close(); }} />
          <MenuItem icon={<Wallet className="w-5 h-5" />} label="Consulta de saldo" onClick={() => { onBalance(); close(); }} />
          <MenuItem icon={<Map className="w-5 h-5" />} label="Mapa do transporte" onClick={() => { onMap(); close(); }} />
          <MenuItem icon={<Route className="w-5 h-5" />} label="Traçado de Rota" onClick={() => { onRoute(); close(); }} />
          <MenuItem icon={<Bell className="w-5 h-5" />} label="Alertas" onClick={() => { onAlerts(); close(); }} />
          <MenuItem icon={<Star className="w-5 h-5" />} label="Favoritos" onClick={() => { onFavorites(); close(); }} />

          {isAdmin && (
            <MenuItem icon={<ShieldAlert className="w-5 h-5" />} label="Administrador" onClick={() => { onAdmin(); close(); }} />
          )}

          <button onClick={() => setDevOpen((v) => !v)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 text-left">
            <Code2 className="w-5 h-5" />
            <span className="font-medium flex-1">Desenvolvedor</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${devOpen ? "rotate-180" : ""}`} />
          </button>
          {devOpen && (
            <div className="pl-6 space-y-1">
              <MenuItem icon={<Radio className="w-4 h-4" />} label="NFC Diagnostic Mode" onClick={() => { onNfcDiagnostic(); close(); }} small />
              <MenuItem icon={<Terminal className="w-4 h-4" />} label="NFC Debug" onClick={() => { navigate("/nfc-debug"); close(); }} small />
            </div>
          )}
        </nav>
        <div className="p-3 border-t border-white/15 space-y-1">
          <MenuItem icon={<Info className="w-5 h-5" />} label="Sobre" onClick={() => { onAbout(); close(); }} />
          <MenuItem icon={<LogOut className="w-5 h-5" />} label="Sair" onClick={async () => { await signOut(); close(); }} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

const MenuItem = ({ icon, label, onClick, small }:
  { icon: React.ReactNode; label: string; onClick: () => void; small?: boolean }) => (
  <button onClick={onClick}
          className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 text-left ${small ? "text-sm" : ""}`}>
    {icon}<span className="font-medium">{label}</span>
  </button>
);
