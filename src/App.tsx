import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import "@/services/connectivityService";
import type { NfcData } from "@/services/nfcService";
import { gtfsService } from "@/services/gtfsService";
import Index from "./pages/Index.tsx";
import NfcDebug from "./pages/NfcDebug.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    void gtfsService.checkRemoteVersion().catch(() => {
      // A indisponibilidade da rede nunca bloqueia a base SQLite local.
    });
  }, []);

  // NFC bridge (mantido)
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent;
      const raw = custom.detail ?? Object.fromEntries(
        ["uid", "tech", "timestamp", "mifareType", "mifareSize", "sectorCount", "blockCount", "authResults", "blocks", "rawBlocks", "readOnly", "error"]
          .map((key) => [key, (event as unknown as Record<string, unknown>)[key]])
          .filter(([, value]) => value !== undefined),
      );
      let data: NfcData | unknown = raw;
      try { if (typeof raw === "string") data = JSON.parse(raw); }
      catch (err) { console.error("Falha ao parsear nfcResult:", err, raw); return; }
      console.log("NFC RECEBIDO:", data);
      window.dispatchEvent(new CustomEvent("nfc:update", { detail: data }));
    };
    window.addEventListener("nfcResult", handler);
    return () => window.removeEventListener("nfcResult", handler);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/nfc-debug" element={<NfcDebug />} />
              <Route path="/" element={<Index />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
