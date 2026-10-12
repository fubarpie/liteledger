# LiteLedger

Lightweight multi-business bookkeeping: SimpleFIN bank sync, AI auto-categorization,
reconciliation, P&L reports and CPA tax exports.

## Quick start (Docker)

```bash
git clone https://github.com/fubarpie/liteledger.git
cd liteledger
cp .env.example .env     # optional: add OPENROUTER_API_KEY
docker compose up -d     # pulls ghcr.io/fubarpie/liteledger:latest
# or build locally: docker compose up -d --build
```

Open http://localhost:3000 (change the host port with `PORT` in `.env`).

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Host port published by compose |
| `OPENROUTER_API_KEY` | _empty_ | Enables AI categorization (optional) |
| `OPENROUTER_MODEL` | `google/gemini-2.5-flash` | Any [OpenRouter model id](https://openrouter.ai/models) (Claude, GPT, Llama, Gemini...) |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | Point at any OpenAI-compatible server (Ollama, LM Studio, vLLM) for fully local AI |
| `AI_REQUIRE_KEY` | `true` | Set `false` when using a local server that needs no key |

## Published image

GitHub Actions (`.github/workflows/docker.yml`) builds a multi-arch (amd64/arm64) image and
pushes it to GHCR on every push to `main` and on `v*` tags. Pull requests only build, never push.
After the first run, set the package visibility to **Public** under your GitHub profile → Packages
if you want others to pull it without logging in.

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
