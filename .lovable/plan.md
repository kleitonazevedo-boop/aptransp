# APTRANSP — Reestruturação completa

## Premissas confirmadas
- Backend: Supabase externo `xitbkklflslcgzqskmml` (você roda o SQL e deploya as edge functions)
- GTFS: só schema + função de import nesta rodada
- SPTrans: edge function proxy (token vai como secret no seu projeto Supabase)
- Escopo: Fases A + B + C + D nesta rodada

## Identidade visual
Mantida 100%: roxo `brand-purple`, amarelo `brand-yellow`, azul e branco. Sem mudanças de paleta, tipografia ou logo.

---

## Fase A — Reestruturar `RouteScreen` (frontend puro)

Tela única, sem navegação para sub-telas. Layout idêntico à imagem enviada.

Estrutura do card principal (de cima para baixo):
1. Inputs **Origem** / **Destino** com botão GPS e botão inverter
2. Grid 4 atalhos amarelos: **Traçar rota** · **Casa** · **Trabalho** · **Favoritos**
3. Linha de modos: **A pé · Público · Carro · Bike**
4. Botão roxo "Traçar rota"
5. Área de resultado (renderizada inline conforme o "modo de conteúdo" ativo):
   - `route` → mapa + polyline + resumo + passos + integrações + botão Favoritar
   - `favorites` → lista das 10 últimas favoritas (executar / remover)
   - `nearby-lines` → ônibus próximos (mapa + lista, só ônibus)
   - `nearby-stations` → estações próximas (metrô/CPTM/ViaMobilidade/Monotrilho, sem ônibus)
   - `default` → últimas 5 rotas reais do banco
6. Sempre dentro do mesmo card. Nenhuma navegação para outra rota.

`MapScreen` continua existindo mas seus dois atalhos "Linhas próximas" / "Estações próximas" passam a abrir o `RouteScreen` no modo correspondente em vez de uma tela nova.

---

## Fase B — Auth + perfil

### Telas novas
- `/login` — visual moderno, fundo com imagem de trilho/metrô (placeholder SVG via gradient), logo APTRANSP, e-mail, senha, "Entrar", "Criar conta", "Esqueci minha senha", botão Google desabilitado ("Em breve")
- `/signup` — todos os campos pedidos (nome, nascimento, idade auto-calculada, e-mail, senha, telefone, endereço residencial, endereço de trabalho, cidade, estado, CEP)
- `/forgot-password` e `/reset-password`

### Wiring
- `src/hooks/useAuth.ts` com `onAuthStateChange` + `getUser`
- Guard nas telas internas: sem sessão → `/login`
- Splash detecta sessão e roteia

### Tabela `user_profile`
Linkada a `auth.users(id)` com trigger `on_auth_user_created`. RLS: usuário só lê/edita o próprio. Política `service_role` para edge functions.

---

## Fase C — Histórico e favoritos reais

- Remover mocks "Casa → Trabalho 35 min" etc. do `RouteScreen`
- Tabela `route_history`: gravar a cada rota traçada (origem, destino, modo, distância, tempo, user_id)
- Tabela `favorite_routes` (nova — `favorite_lines` fica para linhas SPTrans): origem, destino, modo, distância, tempo
- Card "Rotas recentes" mostra as 5 últimas do banco
- Botão estrela no resultado da rota grava em `favorite_routes`
- Atalho "Favoritos" mostra as 10 últimas — cada item tem "Executar" (recalcula) e "Remover"

---

## Fase D — SPTrans + linhas/estações próximas + GTFS

### Edge function `sptrans-proxy` (`supabase/functions/sptrans-proxy/index.ts`)
- Mantém cookie de autenticação em memória (lazy refresh em 401)
- Endpoints proxy: `/Linha/Buscar`, `/Posicao/Linha`, `/Previsao/Linha`, `/Parada/Buscar`, `/Corredor`, `/Terminal`
- CORS habilitado
- Lê `SPTRANS_TOKEN` de `Deno.env`

### `src/services/sptransService.ts`
Singleton com cache TTL (60s para posição, 5min para metadados), rate-limit token-bucket, tratamento de erros padronizado. Nenhum componente chama a função diretamente.

### Modo `nearby-lines` no `RouteScreen`
GPS → busca paradas próximas (raio 800m, GTFS local quando disponível, fallback Google Places transit_station filtrado para `bus_station`) → para cada parada, lista linhas SPTrans + previsão de chegada.

### Modo `nearby-stations` no `RouteScreen`
GPS → Google Places nearby `subway_station|train_station|light_rail_station` → cruza com `gtfs_stops` quando importado. Sem ônibus.

### Tabelas GTFS (schema apenas)
`gtfs_agency`, `gtfs_routes`, `gtfs_stops`, `gtfs_trips`, `gtfs_shapes`, `gtfs_stop_times`, `gtfs_frequencies`, `gtfs_calendar`, `gtfs_fare_attributes`, `gtfs_fare_rules`. Índices em chaves de junção. Sem seed.

### Função de import
Documento `gtfs-import.md` com:
- comando `psql \copy` para cada arquivo
- ordem correta de carga (respeitando FKs)
- script bash opcional

---

## O que você (usuário) precisa fazer

1. **Rodar SQL**: arquivo `supabase-schema-v2.sql` no SQL Editor do Supabase
2. **Configurar secret SPTrans no Supabase** (Dashboard → Project Settings → Edge Functions → Secrets): `SPTRANS_TOKEN=<seu token Olho Vivo>`
3. **Deploy da edge function**: `supabase functions deploy sptrans-proxy --project-ref xitbkklflslcgzqskmml`
4. **Habilitar provedor de e-mail** no Supabase Auth (já vem ligado por padrão); desabilitar "Confirm email" se quiser teste sem confirmação
5. **Importar GTFS** (quando quiser): seguir `gtfs-import.md`

---

## Riscos e limites

- **Edge functions em Supabase externo**: eu gero o código em `supabase/functions/`, mas o deploy depende de você rodar o CLI. Sem deploy, "Linhas próximas" cai no fallback Google Places.
- **GTFS stop_times** tem ~3M linhas — só `\copy` aguenta; UI de import seria inviável.
- **Google Maps key gerenciada** continua quebrando dentro do APK Capacitor (referrer). Sem efeito no preview web.
- **Conta Google login**: deixei como botão desabilitado conforme pedido ("preparado para futuro").

## Arquivos principais a criar/alterar

```text
supabase-schema-v2.sql                       (novo — você roda)
gtfs-import.md                               (novo — instruções)
supabase/functions/sptrans-proxy/index.ts    (novo)
src/hooks/useAuth.ts                         (novo)
src/services/sptransService.ts               (novo)
src/services/profileService.ts               (novo)
src/services/favoritesService.ts             (novo)
src/services/historyService.ts               (novo)
src/services/nearbyService.ts                (refactor)
src/pages/Auth/LoginScreen.tsx               (novo)
src/pages/Auth/SignupScreen.tsx              (novo)
src/pages/Auth/ForgotPasswordScreen.tsx      (novo)
src/pages/Auth/ResetPasswordScreen.tsx       (novo)
src/pages/screens/RouteScreen.tsx            (reescrita grande)
src/pages/screens/MapScreen.tsx              (atalhos redirecionam p/ RouteScreen)
src/pages/screens/LinhasProximasScreen.tsx   (REMOVIDO — vira modo do RouteScreen)
src/pages/Index.tsx                          (rotas: /login /signup /forgot /reset)
src/App.tsx                                  (AuthProvider + guard)
src/integrations/supabase/client.ts          (sem mudança)
```

Próximo passo após você aprovar o plano: começo executando Fase A + gero `supabase-schema-v2.sql` em paralelo, depois Fases B/C/D.
