import { ArrowLeft, Lock } from "lucide-react";

const PrivacyPolicyScreen = ({ onBack }: { onBack: () => void }) => (
  <div className="flex-1 flex flex-col bg-white">
    <header className="bg-brand-purple text-white px-4 py-4 flex items-center gap-3">
      <button onClick={onBack} aria-label="Voltar"><ArrowLeft className="w-6 h-6" /></button>
      <h1 className="font-bold">Política de Privacidade</h1>
    </header>
    <div className="flex-1 px-5 py-6 overflow-y-auto space-y-5 text-sm leading-relaxed">
      <div className="bg-blue-50 rounded-2xl p-4 flex gap-3">
        <Lock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Sua privacidade é nossa prioridade.</p>
          <p className="text-muted-foreground mt-1">
            Não pedimos cadastro, não exigimos e-mail e não armazenamos nenhum dado.
            Tudo o que é lido do seu bilhete é descartado imediatamente após a consulta.
          </p>
        </div>
      </div>

      <div>
        <h2 className="font-bold flex items-center gap-2"><Lock className="w-4 h-4" /> Política de Privacidade (Resumo)</h2>
        <ul className="mt-3 space-y-3">
          <li><b>Armazenamento Zero:</b> Não armazenamos nenhuma informação. Nosso aplicativo funciona de forma volátil: os dados do seu bilhete são lidos, exibidos na tela para sua conferência e descartados imediatamente após o fechamento da consulta.</li>
          <li><b>Sem Cadastro:</b> Você não precisa fornecer e-mail, CPF, telefone ou criar qualquer senha para usar o serviço.</li>
          <li><b>Coleta de Dados:</b> Não coletamos histórico de uso, localização ou dados de identificação do aparelho.</li>
          <li><b>Compartilhamento:</b> Como não guardamos dados, é impossível vendê-los ou compartilhá-los com terceiros.</li>
          <li><b>Contato:</b> Para dúvidas sobre sua privacidade, fale conosco em aptransp@gmail.com.</li>
        </ul>
      </div>

      <p className="italic text-muted-foreground border-l-4 border-primary pl-4">
        "Sua privacidade é nossa prioridade: não pedimos cadastro e não guardamos seus dados.
        Tudo o que é lido é apagado instantaneamente."
      </p>
    </div>
  </div>
);

export default PrivacyPolicyScreen;
