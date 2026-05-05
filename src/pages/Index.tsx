import { useState } from "react";
import HomeScreen from "./screens/HomeScreen";
import ReadScreen from "./screens/ReadScreen";
import ResultScreen from "./screens/ResultScreen";
import ErrorScreen, { ErrorKind } from "./screens/ErrorScreen";
import HistoryScreen from "./screens/HistoryScreen";
import AboutScreen from "./screens/AboutScreen";
import { NfcReading, saveReading } from "@/lib/nfc";

export type Screen =
  | { name: "home" }
  | { name: "read" }
  | { name: "result"; reading: NfcReading }
  | { name: "error"; kind: ErrorKind }
  | { name: "history" }
  | { name: "about" };

const Index = () => {
  const [screen, setScreen] = useState<Screen>({ name: "home" });

  const go = (s: Screen) => setScreen(s);

  return (
    <div className="app-shell bg-gradient-soft">
      {screen.name === "home" && (
        <HomeScreen
          onStart={() => go({ name: "read" })}
          onHistory={() => go({ name: "history" })}
          onAbout={() => go({ name: "about" })}
        />
      )}
      {screen.name === "read" && (
        <ReadScreen
          onBack={() => go({ name: "home" })}
          onSuccess={(r) => {
            saveReading(r);
            go({ name: "result", reading: r });
          }}
          onError={(kind) => go({ name: "error", kind })}
        />
      )}
      {screen.name === "result" && (
        <ResultScreen
          reading={screen.reading}
          onNew={() => go({ name: "read" })}
          onHistory={() => go({ name: "history" })}
          onBack={() => go({ name: "home" })}
        />
      )}
      {screen.name === "error" && (
        <ErrorScreen
          kind={screen.kind}
          onRetry={() => go({ name: "read" })}
          onHome={() => go({ name: "home" })}
        />
      )}
      {screen.name === "history" && <HistoryScreen onBack={() => go({ name: "home" })} />}
      {screen.name === "about" && <AboutScreen onBack={() => go({ name: "home" })} />}
    </div>
  );
};

export default Index;
