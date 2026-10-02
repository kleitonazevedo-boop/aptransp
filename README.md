# APTRANSP

Crie um aplicativo mobile-first em React para consulta NFC do Bilhete Único de São Paulo.

IMPORTANTE: esta primeira versão deve ser um protótipo funcional/simulado para Android, com fluxo de leitura NFC demonstrativo. O app NÃO deve se apresentar como oficial da SPTrans, NÃO deve copiar marca, logotipo, nome visual ou identidade do app Ponto Certo, e NÃO deve tentar burlar proteções, criptografia ou mecanismos de segurança do cartão. Qualquer informação de saldo deve aparecer apenas como mensagem explicativa/simulada, deixando claro que saldo real depende de autorização, compatibilidade técnica e acesso legítimo.

Objetivo da V1:
Construir uma interface mobile-first moderna, simples e confiável, em português do Brasil, para demonstrar o fluxo de consulta NFC de um Bilhete Único, com dados simulados e histórico local.

Tecnologia:
- React.
- Layout mobile-first, otimizado para Android.
- Interface responsiva em tela estreita.
- Pode usar componentes React, CSS moderno e armazenamento local via localStorage para histórico.
- Como ambiente web/React não acessa NFC nativo Android de forma completa, implementar a leitura como fluxo simulado/demonstrativo, preparado visualmente para futura integração nativa.

Design:
- Visual limpo, moderno e confiável.
- Cores principais: azul, branco e cinza.
- Botões grandes, adequados para uso com polegar.
- Cards arredondados com sombra leve.
- Tipografia clara.
- Não copiar identidade visual, ícones, logotipo, cores exatas ou layout proprietário de apps existentes como Ponto Certo.
- Aparência inspirada genericamente em apps de transporte e mobilidade urbana.

Estrutura de telas:

1. Tela inicial
- Título: “Leitor Bilhete NFC”.
- Subtítulo ou texto de apoio: “Consulte informações técnicas do seu cartão por aproximação NFC.”
- Instrução principal: “Aproxime seu Bilhete Único da parte traseira do celular”.
- Botão grande: “Iniciar leitura”.
- Card informativo discreto: “Esta versão usa dados simulados para demonstrar o fluxo.”
- Acesso para Histórico.
- Acesso para Sobre o app.

2. Tela de leitura
- Título: “Lendo cartão”.
- Instrução: “Mantenha o cartão encostado na parte traseira do celular.”
- Criar animação de um cartão aproximando de um celular, com ondas NFC ou pulso visual.
- Mostrar estado de progresso: “Procurando cartão…”, depois “Cartão detectado…”, depois “Validando compatibilidade…”.
- Simular o resultado após alguns segundos.
- Pode haver botões ou opções de simulação para casos de erro: aparelho sem NFC, NFC desligado, cartão não compatível, leitura protegida.

3. Tela de resultado
Mostrar em um card principal:
- Status do cartão, por exemplo: “Cartão detectado”.
- UID do cartão, usando dado simulado como “04:A1:B2:C3:D4:E5:80”.
- Tecnologias NFC detectadas, por exemplo: “NfcA, IsoDep, MIFARE Classic (simulado)”.
- Compatibilidade do aparelho, por exemplo: “Compatível com leitura NFC básica”.
- Mensagem obrigatória: “Saldo disponível apenas se a leitura for autorizada e compatível”.
- Campo de saldo deve ser opcional/simulado e não prometer leitura real, por exemplo: “Saldo: indisponível nesta versão”.
- Botão “Nova leitura”.
- Botão “Ver histórico”.

4. Tela de erro
Criar tela/estado de erro com cards claros para estes cenários:
- Aparelho sem NFC: “Este aparelho não possui NFC ou o recurso não está disponível para o navegador/app atual.”
- NFC desligado: “Ative o NFC nas configurações do Android e tente novamente.”
- Cartão não compatível: “O cartão detectado não é compatível com esta leitura básica.”
- Leitura protegida: “Algumas áreas do cartão são protegidas e não podem ser lidas sem autorização.”
Cada erro deve ter:
- Ícone ou ilustração simples.
- Explicação curta.
- Botão “Tentar novamente”.
- Botão “Voltar ao início”.

5. Histórico local
- Tela “Histórico de leituras”.
- Usar localStorage para salvar leituras simuladas.
- Exibir data/hora, status, UID simulado, tecnologias detectadas e resultado.
- Botão para limpar histórico.
- Estado vazio: “Nenhuma leitura registrada ainda.”

6. Tela Sobre o app
Texto em português do Brasil explicando:
- “Este app não é oficial da SPTrans.”
- “Este app não possui vínculo com SPTrans, Bilhete Único, Ponto Certo ou qualquer órgão público.”
- “A primeira versão demonstra apenas o fluxo de leitura NFC com dados simulados.”
- “O app não tenta burlar proteções, criptografia ou áreas restritas do cartão.”
- “O saldo real só poderá ser exibido se houver autorização, compatibilidade técnica e integração legítima.”
- Incluir linguagem simples, transparente e confiável.

Fluxo esperado:
- Usuário abre a tela inicial.
- Clica em “Iniciar leitura”.
- Vai para a tela de leitura com animação.
- O app simula uma leitura bem-sucedida ou permite escolher um erro de teste.
- Em sucesso, exibe a tela de resultado.
- A leitura é salva no histórico local.
- Usuário pode fazer nova leitura, ver histórico ou acessar Sobre.

Dados simulados:
Criar uma função que gere leituras simuladas com:
- status: “Cartão detectado”, “Leitura parcial”, “Protegido”.
- uid aleatório em formato hexadecimal separado por dois-pontos.
- tecnologias: lista como NfcA, IsoDep, Ndef, MIFARE Classic, dependendo do cenário.
- compatibilidade: “Compatível com leitura NFC básica”, “Compatibilidade parcial” ou “Não compatível”.
- saldo: sempre “Indisponível nesta versão” ou mensagem equivalente.

Requisitos de usabilidade:
- Interface muito simples para pessoa leiga.
- Botões grandes e fáceis de tocar.
- Feedback visual em cada etapa.
- Mensagens claras, sem termos técnicos excessivos.
- Rodar bem como protótipo mobile em navegador.

Entregável esperado:
- Aplicativo React completo e navegável.
- Todas as telas funcionando.
- Histórico local usando localStorage.
- Animação visual de NFC.
- Dados simulados.
- Sem uso de marcas oficiais ou APIs reais da SPTrans.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://aptransp.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b0f28e47-9555-4c31-99e5-88d60bf8193f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
