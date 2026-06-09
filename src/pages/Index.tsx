import { useState } from "react";
import { Helmet } from "react-helmet-async";
import SplashScreen from "./screens/SplashScreen";
import PrivacyConsentScreen from "./screens/PrivacyConsentScreen";
import WalletScreen from "./screens/WalletScreen";
import MapScreen from "./screens/MapScreen";
import RouteScreen from "./screens/RouteScreen";
import NfcDiagnosticScreen from "./screens/NfcDiagnosticScreen";
import AboutScreen from "./screens/AboutScreen";
import PrivacyPolicyScreen from "./screens/PrivacyPolicyScreen";
import TermsScreen from "./screens/TermsScreen";
import ProfileScreen from "./screens/ProfileScreen";
import AdminScreen from "./screens/AdminScreen";
import DiagnosticsScreen from "./screens/admin/DiagnosticsScreen";
import GpsDebugScreen from "./screens/admin/GpsDebugScreen";
import GtfsImportScreen from "./screens/admin/GtfsImportScreen";
import LogsScreen from "./screens/admin/LogsScreen";

type Screen =
  | "splash" | "consent" | "wallet" | "map" | "route"
  | "route-nearby-lines" | "route-nearby-stations"
  | "nfc-diagnostic" | "about" | "privacy" | "terms"
  | "profile" | "admin" | "admin-diag" | "admin-gps" | "admin-gtfs" | "admin-logs";

const CONSENT_KEY = "aptransp_consent_v1";

const Index = () => {
  const [screen, setScreen] = useState<Screen>("splash");

  const handleEnter = () => {
    const accepted = localStorage.getItem(CONSENT_KEY) === "1";
    setScreen(accepted ? "wallet" : "consent");
  };

  const handleAcceptConsent = () => {
    localStorage.setItem(CONSENT_KEY, "1");
    setScreen("wallet");
  };

  return (
    <>
      <Helmet>
        <title>aptransp — Mobilidade urbana inteligente</title>
        <meta name="description" content="Rotas, linhas e estações de transporte público em tempo real. Consulta de saldo do Bilhete Único via NFC." />
        <link rel="canonical" href="https://aptransp.lovable.app/" />
      </Helmet>
      <div className="app-shell">
        {screen === "splash" && <SplashScreen onEnter={handleEnter} />}
        {screen === "consent" && <PrivacyConsentScreen onAccept={handleAcceptConsent} />}
        {screen === "wallet" && (
          <WalletScreen
            onAbout={() => setScreen("about")}
            onOpenMap={() => setScreen("map")}
            onOpenRoute={() => setScreen("route")}
            onOpenNearby={() => setScreen("route-nearby-lines")}
            onOpenNfcDiagnostic={() => setScreen("nfc-diagnostic")}
            onOpenProfile={() => setScreen("profile")}
            onOpenAdmin={() => setScreen("admin")}
          />
        )}
        {screen === "map" && (
          <MapScreen
            onBack={() => setScreen("wallet")}
            onNearbyLines={() => setScreen("route-nearby-lines")}
            onNearbyStations={() => setScreen("route-nearby-stations")}
          />
        )}
        {screen === "route" && <RouteScreen onBack={() => setScreen("wallet")} />}
        {screen === "route-nearby-lines" &&
          <RouteScreen onBack={() => setScreen("wallet")} initialMode="nearby-lines" />}
        {screen === "route-nearby-stations" &&
          <RouteScreen onBack={() => setScreen("wallet")} initialMode="nearby-stations" />}
        {screen === "nfc-diagnostic" && <NfcDiagnosticScreen onBack={() => setScreen("wallet")} />}
        {screen === "about" && (
          <AboutScreen
            onBack={() => setScreen("wallet")}
            onPrivacy={() => setScreen("privacy")}
            onTerms={() => setScreen("terms")}
          />
        )}
        {screen === "privacy" && <PrivacyPolicyScreen onBack={() => setScreen("about")} />}
        {screen === "terms" && <TermsScreen onBack={() => setScreen("about")} />}
        {screen === "profile" && <ProfileScreen onBack={() => setScreen("wallet")} />}
        {screen === "admin" && (
          <AdminScreen
            onBack={() => setScreen("wallet")}
            onDiagnostics={() => setScreen("admin-diag")}
            onGpsDebug={() => setScreen("admin-gps")}
            onGtfs={() => setScreen("admin-gtfs")}
            onLogs={() => setScreen("admin-logs")}
          />
        )}
        {screen === "admin-diag" && <DiagnosticsScreen onBack={() => setScreen("admin")} />}
        {screen === "admin-gps" && <GpsDebugScreen onBack={() => setScreen("admin")} />}
        {screen === "admin-gtfs" && <GtfsImportScreen onBack={() => setScreen("admin")} />}
        {screen === "admin-logs" && <LogsScreen onBack={() => setScreen("admin")} />}
      </div>
    </>
  );
};

export default Index;
