import { Smartphone } from "lucide-react";

export const NfcAnimation = () => {
  return (
    <div className="relative w-full h-64 flex items-center justify-center overflow-hidden">
      {/* NFC waves */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`absolute -left-12 -top-12 w-24 h-24 rounded-full border-2 border-primary ${
              i === 0 ? "animate-nfc-wave" : i === 1 ? "animate-nfc-wave-2" : "animate-nfc-wave-3"
            }`}
          />
        ))}
      </div>

      {/* Phone */}
      <div className="relative z-10 w-32 h-52 rounded-3xl bg-gradient-to-br from-primary-deep to-primary shadow-elevated flex items-center justify-center border-4 border-foreground/10">
        <Smartphone className="w-10 h-10 text-primary-foreground/80" />
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-foreground/20" />
      </div>

      {/* Card */}
      <div className="absolute z-20 right-4 top-1/2 -translate-y-1/2 animate-card-tap">
        <div className="w-28 h-40 rounded-2xl bg-gradient-card shadow-glow border border-primary-glow/40 p-3 flex flex-col justify-between rotate-[-8deg]">
          <div className="flex justify-between items-start">
            <div className="w-6 h-5 rounded-sm bg-warning/80" />
            <div className="text-[8px] font-bold text-primary-foreground/90">NFC</div>
          </div>
          <div className="space-y-1">
            <div className="h-1 w-full bg-primary-foreground/30 rounded" />
            <div className="h-1 w-2/3 bg-primary-foreground/30 rounded" />
            <div className="text-[9px] text-primary-foreground/80 font-medium tracking-wider">
              BILHETE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
