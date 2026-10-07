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

## URL de produção

Configure a variável de repositório GitHub Actions `APTRANSP_API_URL` com o host
público HTTPS da API. O workflow iOS a injeta como `VITE_APTRANSP_API_URL` no build.
A validação do aplicativo rejeita HTTP em produção e hosts locais/privados.

Para desenvolvimento, use `.env.local` não versionado. O arquivo `.env.example`
documenta a variável sem embutir endereço LAN.

## Instalação no dispositivo

Cada versão é baixada para um banco SQLite separado e somente leitura. Após verificar
integridade, tamanho, SHA-256 e tabelas essenciais, a aplicação altera em uma única
gravação a versão ativa em `gtfs_sync_metadata`. Perfil, favoritos, histórico e demais
dados locais permanecem no banco principal. Uma falha antes da ativação mantém a versão
anterior selecionada.
