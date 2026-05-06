import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export const InstallButton = () => {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-ignore iOS Safari
      window.navigator.standalone === true;
    setInstalled(standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (installed) return null;

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    } else if (isIOS) {
      setShowIOSHint((s) => !s);
    } else {
      setShowIOSHint((s) => !s);
    }
  };

  return (
    <div className="w-full max-w-xs flex flex-col items-center">
      <Button
        onClick={handleClick}
        variant="outline"
        className="mt-4 w-full h-12 rounded-full bg-transparent border-white/60 text-white hover:bg-white/10 hover:text-white"
      >
        <Download className="w-4 h-4 mr-2" /> Instalar app
      </Button>
      {showIOSHint && (
        <p className="text-xs text-white/85 mt-3 text-center leading-relaxed">
          {isIOS
            ? "No iPhone: toque em Compartilhar e depois em \"Adicionar à Tela de Início\"."
            : "No menu do navegador, toque em \"Instalar app\" ou \"Adicionar à tela inicial\"."}
        </p>
      )}
    </div>
  );
};
