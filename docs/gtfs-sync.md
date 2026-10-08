# Sincronização da base GTFS

O aplicativo consulta paradas e linhas no SQLite local. A rede é usada para consultar
`GET /api/v1/gtfs/sync/latest` e obter um snapshot SQLite apenas quando a versão local
não está instalada ou está desatualizada.

## API

A API procura snapshots em `GTFS_SNAPSHOT_DIR` (no container, o volume persistente
`/app/data/gtfs`). Ela aceita:

- `gtfs-<versão>.sqlite`, produzido pelo processo existente do homelab;
- `aptransp_gtfs_<versão>.db`, produzido pela importação de pacote da API.

A API compara a versão publicada em `gtfs_versions` com os arquivos encontrados e
serve a mais recente pelo timestamp da versão. Se a tabela não tiver versão publicada,
a API encontra o arquivo SQLite mais recente pelo nome e calcula SHA-256 e contagens
diretamente no arquivo. A rota de download transmite o arquivo sem incluí-lo no repositório.

A importação de pacote da API continua publicando o ZIP existente e agora também
gera um snapshot SQLite. Os endpoints ZIP legados permanecem disponíveis.

## Ambientes da API

O endereço é centralizado em `VITE_APTRANSP_API_URL` e o ambiente em
`VITE_APTRANSP_ENV` (`local` ou `production`). A URL é compilada no bundle WebView,
que é o mesmo conteúdo usado pelo Capacitor no iOS e Android.

Para testar no homelab, copie `.env.local.example` para `.env.local`; o endereço
local não é inserido em código da aplicação. Builds Android debug permitem HTTP
somente para `192.168.15.124`; a configuração base e builds release Android exigem
HTTPS. No iOS, o workflow adiciona em tempo de build uma exceção ATS somente para o
IP privado configurado quando o ambiente é `local`, além da mensagem de permissão
de rede local. Builds `production` removem a exceção e exigem HTTPS.

No GitHub Actions, configure as variáveis do repositório `APTRANSP_ENVIRONMENT` e
`APTRANSP_API_URL`. Para este teste, use `local` e
`http://192.168.15.124:3000`. Para produção, troque ambas para `production` e
uma URL pública HTTPS. O workflow mapeia os valores para as variáveis Vite no build
e verifica que o endereço configurado entrou nos arquivos compilados.

## Instalação no dispositivo

Cada versão é baixada para um banco SQLite separado e somente leitura. Após verificar
integridade, tamanho, SHA-256 e tabelas essenciais, a aplicação altera em uma única
gravação a versão ativa em `gtfs_sync_metadata`. Perfil, favoritos, histórico e demais
dados locais permanecem no banco principal. Uma falha antes da ativação mantém a versão
anterior selecionada.
