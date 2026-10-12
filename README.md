# LiteLedger

Lightweight multi-business bookkeeping: SimpleFIN bank sync, AI auto-categorization,
reconciliation, P&L reports and CPA tax exports.

## Quick start (Docker)

```bash
git clone https://github.com/fubarpie/liteledger.git
cd liteledger
cp .env.example .env     # optional: add GEMINI_API_KEY
docker compose up -d --build
```

Open http://localhost:3000 (change the host port with `PORT` in `.env`).

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Host port published by compose |
| `GEMINI_API_KEY` | _empty_ | Enables AI categorization (optional) |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Gemini model name |

## Data & security notes

- Your ledger data is stored **in your browser's localStorage**, not on the server.
  Use *Settings → Backup* regularly. Data saved under the former app name is migrated automatically.
- The server has **no authentication**. Run it on a trusted network or put it behind a
  reverse proxy with auth (e.g. Caddy/Traefik/Authelia) before exposing it to the internet.

## Development

```bash
npm install
npm run dev
```
