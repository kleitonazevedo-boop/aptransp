// Shared Capacitor-safe export helpers for NFC forensic modules.
// Uses @capacitor/filesystem + @capacitor/share on native (Android APK),
// falls back to browser download in web preview.

export const isNativePlatform = (): boolean => {
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  return !!w.Capacitor?.isNativePlatform?.();
};

export type ExportLabels = {
  fileCreated: string;
  shareOpened: string;
  error: string;
};

const DEFAULT_LABELS: ExportLabels = {
  fileCreated: "EXPORT FILE CREATED",
  shareOpened: "EXPORT SHARE OPENED",
  error: "EXPORT ERROR",
};

export const triggerDownload = async (
  filename: string,
  content: string,
  mime: string = "application/json",
  labels: ExportLabels = DEFAULT_LABELS,
): Promise<void> => {
  try {
    if (isNativePlatform()) {
      const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
      const { Share } = await import("@capacitor/share");

      await Filesystem.writeFile({
        path: filename,
        directory: Directory.Documents,
        data: content,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      console.log(labels.fileCreated, filename);

      const fileInfo = await Filesystem.getUri({
        directory: Directory.Documents,
        path: filename,
      });

      // IMPORTANT: Android Share Sheet uses `title` as the visible filename when
      // sharing via apps like Drive / Gmail. Use the real filename here so the
      // saved file keeps its forensic timestamped name instead of a generic label.
      await Share.share({
        title: filename,
        text: filename,
        url: fileInfo.uri,
        dialogTitle: `Salvar / compartilhar ${filename}`,
      });
      console.log(labels.shareOpened, filename);
      return;
    }

    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(labels.fileCreated, filename);
  } catch (error) {
    console.error(labels.error, error);
  }
};

export const fileStamp = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};
