import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Lock } from "lucide-react";

const PrivacyConsentScreen = ({ onAccept }: { onAccept: () => void }) => {
  const [checked, setChecked] = useState(false);
  return (
    <div className="flex-1 bg-brand-blue flex flex-col items-center justify-center px-6 text-white">
      <Lock className="w-14 h-14 mb-6 opacity-95" />
      <h2 className="text-xl font-bold mb-4 text-center">Sua privacidade é nossa prioridade.</h2>
      <p className="text-sm leading-relaxed text-center opacity-95 max-w-sm">
        Não pedimos cadastro, não exigimos e-mail e não armazenamos nenhum dado.
        Tudo o que é lido do seu bilhete é descartado imediatamente após a consulta.
      </p>

      <label className="flex items-center gap-3 mt-10 cursor-pointer">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => setChecked(!!v)}
          className="border-white data-[state=checked]:bg-white data-[state=checked]:text-blue-900 w-5 h-5"
        />
        <span className="text-sm">Li e concordo</span>
      </label>

      <Button
        disabled={!checked}
        onClick={onAccept}
        className="mt-8 w-full max-w-xs h-14 rounded-full bg-cyan-300 hover:bg-cyan-200 text-blue-900 font-semibold text-lg disabled:opacity-50"
      >
        OK
      </Button>
    </div>
  );
};

export default PrivacyConsentScreen;
