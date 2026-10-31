# Migração para PostgreSQL (fase 2)

O MVP usa o SQLite embutido no Node 22 para rodar sem instalar nada. Para produção com várias instâncias da API, migre para PostgreSQL gerenciado (Neon, Supabase, RDS, Render).

## Diferenças de schema (`server/src/schema.sql`)

| SQLite (MVP) | PostgreSQL |
|---|---|
| `TEXT` para datas, `datetime('now')` | `timestamptz`, `now()` |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `bigint generated always as identity` |
| `TEXT` com JSON (`*_json`) | `jsonb` |
| `json_extract(settings,'$.x')` | `settings->>'x'` |
| `datetime('now','-1 day')` | `now() - interval '1 day'` |
| `INSERT OR IGNORE` | `INSERT ... ON CONFLICT DO NOTHING` |
| `PRAGMA ...` | remover |

## O que muda no código

- `src/db.js`: trocar `DatabaseSync` pelo driver `pg` (exige `npm install pg`), com as mesmas funções `prepare().get/all/run` encapsuladas.
- Distância: instalar PostGIS ou usar `earthdistance` e filtrar a descoberta no banco (hoje é feito em memória sobre até 500 candidatos — suficiente para o MVP).
- Rate limit: mover de memória para Redis quando houver mais de uma instância.
- Tempo real: com várias instâncias, usar Redis pub/sub para repassar eventos entre servidores.
- Fotos: trocar `savePhoto`/`deletePhotoFile`/`photoUrl` em `src/services.js` por S3 ou Cloudflare R2 com URLs assinadas.

## Criptografia em repouso

Ative criptografia de disco no provedor do banco e do armazenamento de fotos. Backups diários com retenção de 7–30 dias.
