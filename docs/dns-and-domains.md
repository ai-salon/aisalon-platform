# DNS & Domain Configuration

## Domain Registrar
**Squarespace** — aisalon.xyz is registered here.
Squarespace is used only as the registrar. DNS is managed by Cloudflare.

## DNS Provider
**Cloudflare** (free plan)
- Squarespace nameservers are pointed to Cloudflare
- Cloudflare handles all DNS records
- CNAME flattening at the apex (`@`) is why Cloudflare is used instead of Squarespace DNS directly (Squarespace doesn't support dynamic CNAME at root)

## Services & Domains

| Domain | Service | Provider |
|--------|---------|----------|
| `aisalon.xyz` | Frontend (Next.js) | Railway |
| `www.aisalon.xyz` | Frontend (Next.js) | Railway |
| `aisalon-platform-production.up.railway.app` | Backend (FastAPI) | Railway (default domain) |

## Cloudflare DNS Records

| Name | Type | Content | Proxied |
|------|------|---------|---------|
| `@` | CNAME | `fuhsdqcn.up.railway.app` | Yes (orange cloud) |
| `www` | CNAME | *(www Railway CNAME from Railway UI)* | Yes |
| `_railway-verify` | TXT | `railway-verify=0ed31faae57...` (full value in Railway UI) | N/A |

## Railway Services

| Service | Railway Domain | Custom Domain |
|---------|---------------|---------------|
| Frontend | `fuhsdqcn.up.railway.app` | `aisalon.xyz`, `www.aisalon.xyz` |
| Backend | `aisalon-platform-production.up.railway.app` | none |
| PostgreSQL | internal only | none |

## Environment Variables

### Backend (Railway)
| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `SECRET_KEY` | (secret — set in Railway) |
| `FRONTEND_URL` | `https://aisalon.xyz` |
| `ENVIRONMENT` | `production` |
| `ADMIN_PASSWORD` | (secret — set in Railway) |
| `BASE_PASSWORD` | (secret — set in Railway) |

### Frontend (Railway)
| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://aisalon-platform-production.up.railway.app` |
| `AUTH_SECRET` | (secret — set in Railway) |
| `AUTH_URL` | `https://aisalon.xyz` |

## Previous Setup (replaced)
`aisalon.xyz` previously pointed to GitHub Pages (`aisalon.github.io`) via 4 A records.
These were removed when migrating to Railway.
