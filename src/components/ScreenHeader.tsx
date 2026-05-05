import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export const ScreenHeader = ({ title, onBack, right }: Props) => (
  <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border">
    <div className="flex items-center justify-between px-4 h-14">
      <div className="flex items-center gap-2">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      </div>
      {right}
    </div>
  </header>
);
