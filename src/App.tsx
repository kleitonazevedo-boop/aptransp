import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import type { NfcData } from "@/services/nfcService";
import Index from "./pages/Index.tsx";
import NfcDebug from "./pages/NfcDebug.tsx";
import NotFound from "./pages/NotFound.tsx";
import LoginScreen from "./pages/Auth/LoginScreen";
import SignupScreen from "./pages/Auth/SignupScreen";
import ForgotPasswordScreen from "./pages/Auth/ForgotPasswordScreen";
import ResetPasswordScreen from "./pages/Auth/ResetPasswordScreen";

const queryClient = new QueryClient();

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
};

const App = () => {
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
              <Route path="/login" element={<LoginScreen />} />
              <Route path="/signup" element={<SignupScreen />} />
              <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
              <Route path="/reset-password" element={<ResetPasswordScreen />} />
              <Route path="/nfc-debug" element={<NfcDebug />} />
              <Route path="/" element={<RequireAuth><Index /></RequireAuth>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
