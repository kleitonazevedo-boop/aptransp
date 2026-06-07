# Importação dos arquivos GTFS da SPTRANS

Os arquivos GTFS são grandes (`stop_times.txt` ultrapassa 3M de linhas). A única forma viável é via `psql \copy` rodando localmente.

## Pré-requisitos

- `psql` instalado
- Os arquivos `.txt` do GTFS extraídos em `./gtfs/`
- Connection string do seu Supabase (`Project Settings → Database → Connection string → URI`)

## Comando

```bash
export PG="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres"

# Ordem importa por causa das chaves de junção lógica.
psql "$PG" -c "\copy public.gtfs_agency        FROM './gtfs/agency.txt'         CSV HEADER"
psql "$PG" -c "\copy public.gtfs_calendar      FROM './gtfs/calendar.txt'       CSV HEADER"
psql "$PG" -c "\copy public.gtfs_routes        FROM './gtfs/routes.txt'         CSV HEADER"
psql "$PG" -c "\copy public.gtfs_stops         FROM './gtfs/stops.txt'          CSV HEADER"
psql "$PG" -c "\copy public.gtfs_shapes        FROM './gtfs/shapes.txt'         CSV HEADER"
psql "$PG" -c "\copy public.gtfs_trips         FROM './gtfs/trips.txt'          CSV HEADER"
psql "$PG" -c "\copy public.gtfs_stop_times    FROM './gtfs/stop_times.txt'     CSV HEADER"
psql "$PG" -c "\copy public.gtfs_frequencies   FROM './gtfs/frequencies.txt'    CSV HEADER"
psql "$PG" -c "\copy public.gtfs_fare_attributes FROM './gtfs/fare_attributes.txt' CSV HEADER"
psql "$PG" -c "\copy public.gtfs_fare_rules    FROM './gtfs/fare_rules.txt'     CSV HEADER"
```

`stop_times` pode levar 5–15 minutos. Aguarde sem interromper.

## Reimportação

Para recarregar do zero:
```sql
truncate public.gtfs_stop_times, public.gtfs_frequencies, public.gtfs_trips,
         public.gtfs_shapes, public.gtfs_stops, public.gtfs_routes,
         public.gtfs_calendar, public.gtfs_fare_rules, public.gtfs_fare_attributes,
         public.gtfs_agency cascade;
```
