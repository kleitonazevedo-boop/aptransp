import { ArrowLeft, BookOpen } from "lucide-react";

const TermsScreen = ({ onBack }: { onBack: () => void }) => (
  <div className="flex-1 flex flex-col bg-white">
    <header className="bg-brand-purple text-white px-4 py-4 flex items-center gap-3">
      <button onClick={onBack} aria-label="Voltar"><ArrowLeft className="w-6 h-6" /></button>
      <h1 className="font-bold">Termos de Uso</h1>
    </header>
    <div className="flex-1 px-5 py-6 overflow-y-auto space-y-5 text-sm leading-relaxed">
      <h2 className="font-bold flex items-center gap-2"><BookOpen className="w-4 h-4" /> Termos de Uso (Resumo)</h2>
      <ul className="space-y-3">
        <li><b>Finalidade:</b> Este é um aplicativo exclusivo para a leitura e consulta de saldo de cartões de transporte (Bilhete Único).</li>
        <li><b>Uso de Terceiros:</b> A leitura depende da tecnologia NFC do seu aparelho e da integridade do chip do seu cartão.</li>
        <li><b>Responsabilidade:</b> O app apenas reflete a informação contida no cartão no momento da leitura. Não realizamos recargas ou alterações de saldo.</li>
        <li><b>Disponibilidade:</b> O serviço é gratuito e oferecido "como está", podendo sofrer instabilidades dependendo da comunicação com os sistemas de transporte.</li>
      </ul>
      <p className="italic text-muted-foreground border-l-4 border-primary pl-4">
        "Sua privacidade é nossa prioridade: não pedimos cadastro e não guardamos seus dados.
        Tudo o que é lido é apagado instantaneamente."
      </p>
    </div>
  </div>
);

export default TermsScreen;
