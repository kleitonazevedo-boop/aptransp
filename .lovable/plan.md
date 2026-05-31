# Plano de Implementação

Antes de executar, preciso alinhar pontos críticos porque o pedido tem conflitos com a arquitetura atual do projeto que precisam ser resolvidos para evitar desperdício de créditos.

## 1. Conflitos e decisões necessárias

### A) Supabase: instância nova vs Lovable Cloud
O projeto **já usa Lovable Cloud** (Supabase gerenciado, com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` já injetados automaticamente — não há `.env` editável neste ambiente).

Você pediu para apontar para uma instância externa (`xitbkklflslcgzqskmml.supabase.co`) com uma anon key publicável. Isso significa:
- **Abandonar** a Lovable Cloud atual (perdendo qualquer dado/edge function já existente lá).
- Lovable **não conseguirá** criar tabelas, RLS, migrações nem ler schema dessa instância externa — você teria que rodar todo o SQL manualmente no painel Supabase externo.
- Recomendação: **manter Lovable Cloud** e criar as tabelas (`transport_lines`, `transport_stops`, `favorite_lines`, `user_routes`, `route_history`, etc.) por migração gerenciada. Posso fazer tudo automaticamente.

**Preciso da sua decisão antes de prosseguir.**

### B) Google Maps API
Você pediu `.env` com `VITE_GOOGLE_MAPS_API_KEY`. Neste ambiente **não existe `.env` editável**. O caminho correto no Lovable é o **connector Google Maps Platform**, que:
- injeta `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` para o frontend (Maps JS + Places New no browser);
- expõe um gateway autenticado para Directions/Geocoding (server-side via edge function — a chave server-side **não pode** ser usada direto do browser, senão dá `REQUEST_DENIED`).

Implicações:
- Autocomplete Places no input → browser key + Places API (New) `AutocompleteSuggestion` (não usar a Autocomplete legada).
- Directions e Geocoding → **edge function** que chama o gateway. Não dá para chamar do browser.
- Capacitor APK: a chave de browser é restrita por referrer `*.lovable.app`; **dentro do APK** as chamadas vão falhar com a key gerenciada. Para APK funcionar você precisará de uma key Google própria sem restrição de referrer (ou com restrição por package name Android) — fora do escopo do que Lovable provisiona.

### C) Escopo
O pedido cobre 2 telas grandes + reconfiguração de backend + 7 tabelas + cache + favoritos + histórico + filtros + busca + autocomplete + rotas alternativas + geolocalização + mapa interativo. É facilmente **15–25 arquivos novos** e várias horas de implementação. Sugiro fatiar para entregar incrementalmente e você validar cada fatia antes da próxima (economiza créditos se algo precisar ser refeito).

## 2. Fatiamento proposto

**Fase 1 — Infra (sem UI nova)**
1. Conectar Google Maps Platform connector.
2. Criar migração com as tabelas: `transport_lines`, `transport_stops`, `line_stops`, `transport_locations`, `favorite_lines`, `user_routes`, `route_history` + RLS + grants.
3. Criar `src/services/databaseService.ts` centralizando queries.
4. Criar edge functions: `directions`, `geocoding`, `places-nearby` (chamando o gateway).
5. Criar services frontend: `googleMapsService.ts`, `geocodingService.ts`, `routeService.ts`, `placesService.ts`, `locationService.ts`, `nearbyService.ts`.

**Fase 2 — Tela "Traçado de Rota" (`RouteScreen`)**
- Substituir placeholder "Em construção" por UI funcional preservando header/cores existentes.
- Inputs com Places Autocomplete (New).
- Botão "Minha localização" via `navigator.geolocation`.
- Seletor de modo (caminhada / transporte público / carro / bicicleta).
- Chamada à edge `directions`, render de tempo/distância/integrações/passo a passo.
- Mapa com polyline da rota.
- Salvar em `user_routes` + registrar em `route_history`.
- Cache da última rota em `localStorage`.
- Estados loading/erro/vazio.

**Fase 3 — Tela "Linhas Próximas"**
- Identificar/criar a tela (hoje não existe rota dedicada — preciso saber onde plugar: nova rota `/linhas-proximas`? screen no menu lateral?).
- Geolocalização + watchPosition (>50m).
- Reverse geocoding para mostrar endereço atual.
- Places Nearby (bus/subway/train/transit station, raio 1000m).
- Cruzar com `transport_lines`/`line_stops` no Supabase (inicialmente vazio — precisaremos seed ou aceitar lista vazia até popular).
- Filtros, busca, favoritos, cache 15 min.

## 3. Perguntas bloqueantes

Antes de codar, preciso que você responda:

1. **Supabase**: mantenho a Lovable Cloud atual (recomendado) ou troco para a instância externa `xitbkklflslcgzqskmml` (você roda o SQL manualmente lá)?
2. **Google Maps no APK**: ok usar a key gerenciada do Lovable agora (funciona no preview web; **não** funciona no APK Capacitor sem você fornecer sua própria key Google depois)?
3. **Escopo inicial**: faço apenas a **Fase 1 + Fase 2 (Traçado de Rota)** nesta rodada e deixo Linhas Próximas para a próxima? Ou você quer tudo de uma vez (maior risco/custo)?
4. **Tela "Linhas Próximas"**: ela não existe hoje no projeto. Crio uma nova rota `/linhas-proximas` acessível pelo menu lateral?
5. **Dados de linhas/paradas**: as tabelas `transport_lines`/`line_stops` começarão vazias. Posso popular com um seed mínimo de SP (algumas linhas de exemplo) ou você prefere deixar vazio até integrar SPTrans/EMTU depois?

Responda essas 5 questões e eu sigo direto para implementação na ordem combinada.