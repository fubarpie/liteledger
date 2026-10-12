# LiteLedger

Lightweight multi-business bookkeeping: SimpleFIN bank sync, AI auto-categorization,
reconciliation, P&L reports and CPA tax exports.

## Quick start (Docker)

```bash
git clone https://github.com/fubarpie/liteledger.git
cd liteledger
echo 'OPENROUTER_API_KEY=sk-or-...' > .env   # optional, enables AI categorization
docker compose up -d     # pulls ghcr.io/fubarpie/liteledger:latest
# or build locally: docker compose up -d --build
```

Open http://localhost:3000 (change the host port with `PORT` in `.env`).

On first visit you create the **administrator account**, then a short onboarding wizard sets up
your first business. Nothing is preloaded.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Host port published by compose |
| `LITELEDGER_SECRET` | _auto-generated_ | Long random string that encrypts bank-feed credentials. If unset, a key is created in `/data/secret.key` |
| `TRUST_PROXY` | `false` | Set `true` behind a reverse proxy so client IPs and HTTPS are detected |
| `COOKIE_SECURE` | `auto` | `auto`/`true`/`false`: mark the session cookie `Secure` |
| `OPENROUTER_API_KEY` | _empty_ | Enables AI categorization (optional) |
| `OPENROUTER_MODEL` | `google/gemini-2.5-flash` | Any [OpenRouter model id](https://openrouter.ai/models) (Claude, GPT, Llama, Gemini...) |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | Point at any OpenAI-compatible server (Ollama, LM Studio, vLLM) for fully local AI |
| `AI_REQUIRE_KEY` | `true` | Set `false` when using a local server that needs no key |

## Published image

GitHub Actions (`.github/workflows/docker.yml`) builds a multi-arch (amd64/arm64) image and
pushes it to GHCR on every push to `main` and on `v*` tags. Pull requests only build, never push.
After the first run, set the package visibility to **Public** under your GitHub profile → Packages
if you want others to pull it without logging in.

## Data & security

- All data lives in a **SQLite database in the `/data` volume** (`liteledger-data` in the compose file).
  **Back up this volume** (or use *Settings → Download backup*). Removing the volume deletes your books.
- Accounts: the first user is the admin and can add more users. Passwords are scrypt-hashed, sessions
  are HttpOnly cookies, sign-in is rate-limited, and bank-feed credentials are encrypted at rest.
- Reconciled transactions are locked (only category/notes/payee can change) until the reconciliation is deleted.
- Serve over HTTPS (reverse proxy such as Caddy/Traefik) if exposed beyond your LAN, and set `TRUST_PROXY=true`.
- Upgrading from the browser-only version: when creating the first business, use the option to import data
  from this browser (it may contain the old sample data).

## Development

```bash
npm install
npm run dev    # server + Vite on :3000, data in ./data
npm test       # API tests
```
