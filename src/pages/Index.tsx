import { useState } from "react";
import SplashScreen from "./screens/SplashScreen";
import PrivacyConsentScreen from "./screens/PrivacyConsentScreen";
import WalletScreen from "./screens/WalletScreen";
import MapScreen from "./screens/MapScreen";
import AboutScreen from "./screens/AboutScreen";
import PrivacyPolicyScreen from "./screens/PrivacyPolicyScreen";
import TermsScreen from "./screens/TermsScreen";

type Screen = "splash" | "consent" | "wallet" | "map" | "about" | "privacy" | "terms";
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
    <div className="app-shell">
      {screen === "splash" && <SplashScreen onEnter={handleEnter} />}
      {screen === "consent" && <PrivacyConsentScreen onAccept={handleAcceptConsent} />}
      {screen === "wallet" && (
        <WalletScreen onAbout={() => setScreen("about")} onOpenMap={() => setScreen("map")} />
      )}
      {screen === "map" && <MapScreen onBack={() => setScreen("wallet")} />}
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
  );
};

export default Index;
