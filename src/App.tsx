import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { NfcData } from "@/services/nfcService";
import Index from "./pages/Index.tsx";
import NfcDebug from "./pages/NfcDebug.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => {
  // Listener global: recebe "nfcResult" do bridge nativo (Android/Capacitor)
  // e republica como "nfc:update" para que qualquer tela/contexto consuma.
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent;
      const raw = custom.detail ?? Object.fromEntries(
        ["uid", "tech", "timestamp", "mifareType", "mifareSize", "sectorCount", "blockCount", "authResults", "blocks", "rawBlocks", "readOnly", "error"]
          .map((key) => [key, (event as unknown as Record<string, unknown>)[key]])
          .filter(([, value]) => value !== undefined),
      );
      // Android envia via triggerJSEvent como STRING JSON — fazer parse defensivo
      let data: NfcData | unknown = raw;
      try {
        if (typeof raw === "string") data = JSON.parse(raw);
      } catch (err) {
        console.error("Falha ao parsear nfcResult:", err, raw);
        return;
      }
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
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/nfc-debug" element={<NfcDebug />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};


export default App;
