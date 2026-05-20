import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const SplashScreen = ({ onEnter }: { onEnter: () => void }) => (
  <div className="flex-1 bg-brand-blue flex flex-col items-center justify-center px-8 text-white">
    <p className="text-sm tracking-widest opacity-90 mb-10">BEM VINDO</p>
    <div className="flex items-center gap-4 mb-16">
      <Logo className="w-20 h-20" />
      <h1 className="text-3xl font-bold tracking-wide">APTRANSP</h1>
    </div>
    <Button
      onClick={onEnter}
      className="w-full max-w-xs h-14 rounded-full bg-cyan-300 hover:bg-cyan-200 text-blue-900 font-semibold text-lg shadow-elevated"
    >
      Entrar
    </Button>
  </div>
);

export default SplashScreen;
