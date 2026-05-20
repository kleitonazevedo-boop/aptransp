import { NFC } from '@awesome-cordova-plugins/nfc';

export async function startNFCScan(onResult: (data: any) => void) {
  try {
    const enabled = await NFC.enabled();

    if (!enabled) {
      onResult({ error: "NFC desativado" });
      return;
    }

    NFC.addTagDiscoveredListener((tag) => {
      const uid = tag.id;

      onResult({
        uid,
        tech: tag.techTypes || [],
        raw: tag
      });
    });

  } catch (err) {
    onResult({ error: "Erro NFC", details: err });
  }
}