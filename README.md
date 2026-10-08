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

# APTRANSP — Documentação técnica do Mini Servidor (Homelab)

**Data de referência:** 08/10/2026  
**Projeto:** APTRANSP — Transporte Público de São Paulo  
**Repositório:** https://github.com/kleitonazevedo-boop/aptransp  
**Branch principal:** `main`  
**Situação:** Homelab, API, PostgreSQL e sincronização GTFS operacional. Integração Android validada.

---

## 1. Objetivo do projeto

O APTRANSP é um aplicativo de transporte público desenvolvido para Android, iOS e Web.

O objetivo é disponibilizar:

- Linhas de transporte público próximas à localização do usuário.
- Paradas e estações próximas.
- Consulta de dados de transporte mesmo sem internet.
- Traçado de rotas utilizando Google Maps.
- Endereços favoritos de Casa e Trabalho.
- Gerenciamento de favoritos.
- Atualização dos dados de transporte por sincronização com servidor próprio.

A arquitetura foi projetada para que o aplicativo continue funcionando offline nas consultas locais, utilizando SQLite.

O servidor próprio é utilizado principalmente para armazenar, processar, publicar e distribuir atualizações GTFS.

## 2. Mini servidor utilizado

Foi configurado um mini PC dedicado para hospedar a infraestrutura do APTRANSP.

| Componente | Configuração |
|---|---|
| Equipamento | Mini PC |
| Processador | Intel N150, 1,8 GHz |
| Memória RAM | 16 GB |
| Armazenamento | SSD 120 GB |
| Sistema operacional | UmbrelOS |
| Gerenciamento de contêineres | Docker / Portainer |
| Banco de dados | PostgreSQL 17 |
| API | Node.js / TypeScript |
| Endereço IP na rede local | `192.168.15.124` |
| Porta da API | `3000` |
| Nome da API | `aptransp-api` |
| Banco PostgreSQL | `aptransp` |
| Usuário PostgreSQL | `aptransp_app` |

**Endereço da API:**

`http://192.168.15.124:3000`

O endereço é privado e acessível na rede local. Não há confirmação de exposição pública da API.

### Observação sobre a rede

Durante os testes, o mini PC apresentou uma falha de conectividade Ethernet.

O cabo de rede estava conectado, mas o servidor não respondia. O cabo foi testado em outro computador e funcionou normalmente.

Após reiniciar o mini PC, a conexão foi restabelecida.

Isso indica um problema de conectividade do equipamento ou sistema operacional, mas a causa exata não foi identificada.

**Melhoria recomendada:** configurar uma reserva de DHCP no roteador para manter o IP `192.168.15.124` e investigar logs de rede caso o problema volte a ocorrer.

## 3. Infraestrutura Docker

O ambiente utiliza Docker no UmbrelOS para executar os serviços necessários ao APTRANSP.

Componentes principais:

**PostgreSQL 17**

Responsável por armazenar os dados GTFS importados.

**aptransp-api**

Aplicação Node.js responsável por:

- Receber importações GTFS.
- Consultar o PostgreSQL.
- Publicar versões GTFS.
- Gerar snapshots SQLite.
- Disponibilizar arquivos para download.
- Fornecer endpoints de sincronização.
- Disponibilizar endpoints de diagnóstico.

O repositório possui o arquivo:

`docker-compose.server.yml`

Esse arquivo faz parte da infraestrutura de implantação do servidor.

A configuração exata de volumes, nomes de contêineres, políticas de reinício e variáveis Docker deve ser consultada no arquivo e na instalação atual do Portainer.

Não foram registrados nesta documentação os valores de senhas ou credenciais.

## 4. Banco PostgreSQL

**Banco:** `aptransp`  
**Usuário:** `aptransp_app`

O PostgreSQL funciona como a origem central dos dados GTFS.

Os dados são importados a partir dos arquivos GTFS e posteriormente utilizados na geração de snapshots SQLite.

### Arquivos GTFS utilizados

- `agency.txt`
- `calendar.txt`
- `routes.txt`
- `shapes.txt`
- `stops.txt`
- `stop_times.txt`
- `trips.txt`
- `frequencies.txt`
- `fare_attributes.txt`
- `fare_rules.txt`

Os arquivos contêm informações de linhas, paradas, horários, trajetos e tarifas.

O processo de importação GTFS foi concluído com sucesso no servidor.

## 5. Arquitetura de sincronização

A arquitetura validada funciona da seguinte maneira:

```text
ARQUIVOS GTFS
      |
      v
APTRANSP API (Node.js)
      |
      v
POSTGRESQL 17 — UMBREL
      |
      v
GERAÇÃO DO SNAPSHOT SQLITE
      |
      v
PUBLICAÇÃO DA VERSÃO GTFS
      |
      v
ENDPOINTS HTTP DA API
      |
      v
DOWNLOAD NATIVO — CAPACITOR
      |
      v
SQLITE LOCAL ANDROID / iOS
      |
      v
CONSULTAS OFFLINE
```

### Princípios importantes

1. PostgreSQL é a origem central dos dados GTFS.
2. O aplicativo não consulta o PostgreSQL diretamente.
3. A API publica snapshots SQLite versionados.
4. O aplicativo baixa e instala o snapshot.
5. As consultas de linhas e paradas são executadas localmente.
6. A indisponibilidade do servidor não deve impedir consultas aos dados já instalados.
7. O Google Maps é uma dependência separada, utilizada nas funcionalidades online.

**Essa arquitetura foi implementada e testada. Não deve ser substituída por consultas remotas a cada pesquisa de linha ou parada.**

## 6. Estrutura SQLite no aplicativo

O aplicativo utiliza bancos SQLite locais com responsabilidades separadas.

### Banco principal

`aptransp.db`

Utilizado para os dados operacionais e informações locais do aplicativo.

### Banco GTFS

Snapshots versionados, por exemplo:

`aptransp_gtfs_20261007-181927.db`

Utilizado para consultas locais de transporte.

Essa separação permite atualizar os dados GTFS sem substituir o banco principal.

A arquitetura utiliza Capacitor SQLite para acesso nativo no Android/iOS.

O processo de sincronização deve preservar o banco principal, os favoritos e demais dados pessoais locais.

## 7. Versão GTFS validada

A versão instalada e testada foi:

**`20261007-181927`**

| Informação | Valor |
|---|---|
| Versão | `20261007-181927` |
| Publicação | 07/10/2026, 18:36:50 UTC |
| Total de registros | 1.300.747 |
| Arquivo SQLite | 71.663.616 bytes |
| Pacote ZIP | 17.411.247 bytes |

**SHA-256 SQLite:**

`1db1e20a628e62e36dc2413ca1c31f7fdac2f1455b3ab91c2af254054ea12a7a`

**SHA-256 ZIP:**

`e252c53f86604a2d9a91d99c25a942fafb2ed9b07b7a7a36714d15132dd3edbd`

O aplicativo Android conseguiu identificar a versão disponível, realizar a sincronização e apresentar a versão como instalada.

## 8. Endpoints da API

### Health check

`GET /health`

URL:

`http://192.168.15.124:3000/health`

Resposta observada:

```json
{
  "status": "ok",
  "service": "aptransp-api",
  "timestamp": "2026-10-08T14:36:21.865Z"
}
```

### Manifesto de sincronização

`GET /api/v1/gtfs/sync/manifest`

URL:

`http://192.168.15.124:3000/api/v1/gtfs/sync/manifest`

O manifesto retorna:

- Status.
- Versão publicada.
- Data de publicação.
- Total de registros.
- Informações do pacote ZIP.
- Informações do SQLite.
- URLs para download.
- Hashes SHA-256.

### Download do SQLite

`GET /api/v1/gtfs/sync/sqlite/aptransp_gtfs_:version.db`

Exemplo:

`http://192.168.15.124:3000/api/v1/gtfs/sync/sqlite/aptransp_gtfs_20261007-181927.db`

### Download do pacote GTFS

`GET /api/v1/gtfs/sync/download/:version`

Exemplo:

`http://192.168.15.124:3000/api/v1/gtfs/sync/download/20261007-181927`

### Outros endpoints implementados

O serviço também possui rotas relacionadas a:

- `/api/v1/gtfs/version`
- `/api/v1/gtfs/status`
- `/api/v1/gtfs/import`
- `/api/v1/gtfs/import/package`
- `/api/v1/gtfs/publish`

Os formatos exatos de requisição e autenticação devem ser conferidos na implementação atual antes de realizar operações administrativas.

## 9. Comandos de diagnóstico do servidor

Executar no PowerShell do Windows, desde que o computador esteja na mesma rede do Umbrel.

### Verificar a API

```powershell
Invoke-RestMethod -Uri "http://192.168.15.124:3000/health"
```

### Verificar o manifesto GTFS

```powershell
Invoke-RestMethod `
  -Uri "http://192.168.15.124:3000/api/v1/gtfs/sync/manifest" |
  ConvertTo-Json -Depth 10
```

### Verificar conectividade TCP

```powershell
Test-NetConnection 192.168.15.124 -Port 3000
```

### Verificar conectividade de rede

```powershell
ping 192.168.15.124
```

Se a API não responder, verificar:

1. Conectividade Ethernet do mini PC.
2. IP atribuído ao equipamento.
3. Estado do UmbrelOS.
4. Contêineres no Docker/Portainer.
5. Logs do `aptransp-api`.
6. Estado do PostgreSQL.
7. Disponibilidade da porta 3000.

Evitar reiniciar o servidor antes de verificar os logs, quando possível.

## 10. Configuração do aplicativo

O projeto utiliza:

- React.
- TypeScript.
- Vite.
- Tailwind CSS.
- Capacitor.
- SQLite.
- Google Maps JavaScript API.

### Variáveis de ambiente locais

Arquivo:

`.env.local`

Exemplo:

```dotenv
VITE_APTRANSP_API_URL=http://192.168.15.124:3000
VITE_APTRANSP_ENV=local
VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY=SUA_CHAVE_GOOGLE_MAPS
```

O `.env.local` deve permanecer fora do Git.

O arquivo `.env` anteriormente versionado foi removido da árvore atual do repositório.

**Importante:** variáveis `VITE_` são incorporadas ao bundle JavaScript e não constituem armazenamento seguro de segredos. A chave do Google Maps deve possuir restrições apropriadas.

### Compilação Android

```powershell
cd C:\1.Projetos\aptransp
git switch main
git pull origin main
npm ci
npm run build
npx cap sync android
npx cap open android
```

A instalação deve ser realizada sobre o aplicativo existente, preservando os bancos SQLite.

Não desinstalar o aplicativo para atualizar sem antes verificar o impacto nos dados locais.

## 11. GitHub Actions

Foram configurados workflows automatizados de compilação Android e iOS.

### Android

Arquivo:

`.github/workflows/android-build.yml`

Executa testes, validação TypeScript, build Vite, sincronização Capacitor e geração de APK debug.

Execução validada:

https://github.com/kleitonazevedo-boop/aptransp/actions/runs/37835330242

Artefato:

`APTRANSP-Android-debug`

### iOS

Arquivo:

`.github/workflows/ios-build.yml`

Executa validações, compilação, assinatura, exportação e upload ao TestFlight.

Execução validada:

https://github.com/kleitonazevedo-boop/aptransp/actions/runs/37835330253

Artefato:

`APTRANSP-iOS-39`

### Repository secrets

Foram configuradas credenciais para:

- `APTRANSP_API_URL`
- `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`
- `ASC_API_KEY_BASE64`
- `ASC_ISSUER_ID`
- `ASC_KEY_ID`
- `IOS_CERTIFICATE_BASE64`
- `IOS_P12_PASSWORD`
- `IOS_PROVISIONING_PROFILE_BASE64`

Os workflows devem utilizar essas variáveis sem imprimir seus valores.

A variável `APTRANSP_API_URL` é mapeada para `VITE_APTRANSP_API_URL` no build.

**Observação:** uma URL privada `192.168.x.x` somente será acessível pelo aplicativo quando o dispositivo estiver em uma rede com acesso ao servidor, ou por uma solução de acesso remoto configurada.

## 12. Problemas encontrados e corrigidos

### 12.1. Conflitos de merge GitHub

Foi realizada a integração da branch:

`feat/aptransp-server-api`

com a branch:

`main`

Os conflitos principais envolveram:

- `server/src/routes/gtfs.ts`
- `src/database/database.ts`
- `src/repositories/gtfsRepository.ts`
- `src/services/gtfsService.ts`

A resolução priorizou a preservação da arquitetura de sincronização já testada com o Umbrel.

Após a resolução, os testes e builds passaram e o Pull Request foi integrado à `main`.

### 12.2. Permissão GPS Android

Problema:

`User denied Geolocation`

Causas identificadas:

- Uso de `navigator.geolocation` no ambiente nativo.
- Permissões ausentes no AndroidManifest.

Correção:

- Plugin Capacitor Geolocation.
- Solicitação de permissões em tempo de execução.
- Fallback web.
- Tratamento de permissões negadas.

Resultado: o Android passou a solicitar a permissão de localização.

### 12.3. Erro validateDataset

Problema:

`Ue.validateDataset is not a function`

Causa:

O serviço de consultas GTFS utilizava um método ausente no repositório.

Correção:

- Implementação de `validateDataset()`.
- Validação de tabelas e registros.
- Validação dos relacionamentos essenciais.
- Cache por versão GTFS.
- Distinção entre base ausente, incompleta e busca sem resultados.

Resultado: as linhas próximas passaram a aparecer corretamente no Android.

### 12.4. Rolagem vertical

Problema:

A tela Traçado de Rota não permitia acessar os últimos cards.

Correção:

Ajustes de altura, rolagem e espaçamento inferior.

Resultado: rolagem vertical confirmada no Android.

### 12.5. Google Maps

Problema:

O mapa não carregava corretamente no Android.

Foi identificada uma mudança na chave utilizada pelo projeto Google Cloud.

Configurações realizadas:

- Nova chave de API.
- Maps JavaScript API habilitada.
- Atualização do ambiente local.
- Criação da secret no GitHub.
- Atualização dos workflows Android e iOS.
- Inclusão da chave no build Vite.

Resultado: funcionamento do Google Maps confirmado posteriormente no Android.

**Segurança:** a chave foi configurada temporariamente sem restrições de aplicativo para diagnóstico. Recomenda-se restringir seu uso antes da publicação em produção.

## 13. Testes realizados

### Validações técnicas

Foram executados com sucesso:

```bash
npm run test -- --run
npx tsc --noEmit
npm run build
```

Também foi validado:

```bash
cd server
npm run build
```

A API e o manifesto responderam corretamente após a recuperação da rede do mini PC.

### Validações no Android

Confirmado:

- Permissão de localização.
- Instalação do snapshot GTFS.
- Preservação dos dados locais.
- Consulta de linhas próximas.
- Exibição de paradas e distâncias.
- Rolagem vertical.
- Funcionamento do Google Maps após atualização da chave.

**Pendente de validação específica:** funcionamento completo das consultas GTFS em modo avião, com coordenadas previamente disponíveis.

## 14. Situação atual do projeto

O APTRANSP possui uma infraestrutura funcional composta por:

- Mini PC com UmbrelOS.
- PostgreSQL 17.
- API Node.js.
- Publicação GTFS.
- Snapshots SQLite versionados.
- Sincronização Android.
- Consultas locais.
- Google Maps.
- Workflows Android e iOS.

O sistema já demonstrou que consegue distribuir dados GTFS do servidor para o aplicativo e realizar consultas a partir do SQLite instalado.

### Melhorias recomendadas

**Infraestrutura**

- Reserva de IP no roteador.
- Verificação das políticas de reinício automático dos contêineres.
- Backup periódico do PostgreSQL.
- Backup dos snapshots GTFS publicados.
- Monitoramento da saúde da API.
- Investigação da falha de rede do mini PC.
- Planejamento de acesso remoto seguro ao Umbrel.

**Sincronização**

- Validar consultas em modo avião.
- Confirmar verificação SHA-256 do snapshot no Android.
- Testar interrupção de download.
- Testar recuperação após falha de sincronização.
- Garantir que uma atualização com erro preserve o snapshot anterior.
- Verificar se o estado de erro pode provocar fallback indevido para a base GTFS legada.

**Segurança**

- Restringir a chave Google Maps.
- Revogar qualquer chave antiga ainda válida que tenha sido exposta no histórico Git.
- Revisar autenticação dos endpoints administrativos.
- Não expor PostgreSQL diretamente à internet.
- Não publicar credenciais em arquivos versionados.

## 15. Referências importantes

**GitHub:**  
https://github.com/kleitonazevedo-boop/aptransp

**Pull Request de integração:**  
https://github.com/kleitonazevedo-boop/aptransp/pull/2

**Commit de integração GTFS:**  
`cfd39d5`

**Commit de correção de localização:**  
`9bfb91a`

**Commit de correção GTFS:**  
`a9a26a1`

**Commit dos workflows Google Maps:**  
`0b1d5ab521ab53a97ee9fb00b375633fd85a39be`

**Endereço local do servidor:**  
`http://192.168.15.124:3000`

**Versão GTFS validada:**  
`20261007-181927`

---

# Contexto para iniciar um novo chat

Estou desenvolvendo o aplicativo APTRANSP, disponível para Android e iOS, utilizando React, TypeScript, Vite, Capacitor e SQLite local.

Configurei um mini servidor Intel N150 com 16 GB RAM, SSD 120 GB e UmbrelOS, utilizando Docker/Portainer, PostgreSQL 17 e API Node.js.

O servidor utiliza o IP local `192.168.15.124` e disponibiliza a API `aptransp-api` na porta 3000.

O PostgreSQL possui o banco `aptransp`, utilizado como origem central dos dados GTFS.

A arquitetura de sincronização já foi implementada e testada:

PostgreSQL → API Node.js → snapshot SQLite versionado → download Capacitor → SQLite local Android/iOS.

A versão GTFS `20261007-181927`, contendo 1.300.747 registros, foi publicada no Umbrel e instalada com sucesso no Android.

O aplicativo utiliza `aptransp.db` para dados operacionais e snapshots `aptransp_gtfs_<versão>.db` para dados de transporte.

As consultas de linhas e paradas próximas utilizam SQLite local. O Google Maps é utilizado nas funcionalidades online.

Foram corrigidos os problemas de geolocalização nativa, validação GTFS, rolagem da tela e configuração da chave Google Maps.

Os builds Android e iOS estão automatizados no GitHub Actions. O iOS utiliza TestFlight.

**Premissa fundamental:** preservar integralmente a arquitetura de banco de dados, API, sincronização e snapshots SQLite já implementada e validada. Não substituir consultas locais por consultas online nem modificar o funcionamento do Umbrel sem necessidade.

Próximas prioridades: validar modo avião, robustez da sincronização, segurança da API, backup do PostgreSQL e melhorias de estabilidade do mini servidor.

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
