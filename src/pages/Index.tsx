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

type Screen =
  | "splash" | "consent" | "wallet" | "map" | "route"
  | "route-nearby-lines" | "route-nearby-stations"
  | "nfc-diagnostic" | "about" | "privacy" | "terms";
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
      </div>
    </>
  );
};

export default Index;
