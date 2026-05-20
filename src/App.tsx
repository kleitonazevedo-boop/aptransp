import { useEffect } from "react";

function App() {
  useEffect(() => {
    const handler = (event: any) => {
      const data = event.detail;

      console.log("NFC RECEBIDO:", data);

      // salva globalmente ou repassa para contexto/tela
      window.dispatchEvent(new CustomEvent("nfc:update", { detail: data }));
    };

    window.addEventListener("nfcResult", handler);

    return () => {
      window.removeEventListener("nfcResult", handler);
    };
  }, []);

  return <div>{/* seu app normal aqui */}</div>;
}

export default App;
