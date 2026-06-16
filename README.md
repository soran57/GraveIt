# GraveIt ⚰

**A pixel-art digital cemetery. Stake your eternal internet grave.**

GraveIt is an open-world, multiplayer canvas where anyone can claim a plot on an infinite grid, carve an epitaph, upload an image, and leave their mark on the internet — forever.

![GraveIt Screenshot](public/logo.png)

---

## ✨ Features

- 🗺️ **Infinite scrollable cemetery grid** — pan, zoom, explore
- ⚰️ **Stake your plot** — choose a tombstone style, size (1×1, 2×2, 3×3), custom color, and epitaph
- 🖼️ **Upload an image** to your grave (JPG, PNG, GIF, WEBP, up to 5MB)
- 🔐 **Google OAuth** authentication
- 👁️ **View counter** with Redis write-behind (rate-limited per visitor)
- 🌗 **Dark / Light theme** toggle
- 📋 **Keeper Ledger** — view and manage all your plots

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite + Tailwind v4 |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL 16 |
| Cache | Redis 7 (viewport cache, session cache, write-behind views) |
| Auth | Google OAuth 2.0 + JWT (HttpOnly cookie) |
| Infra | Docker Compose |

---

## 🚀 Quick Start

**Prerequisites:** Node.js 20+, Docker & Docker Compose

### 1. Clone & install dependencies
```bash
git clone https://github.com/soran57/graveit.git
cd graveit
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

Edit `.env`:
| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | ✅ **Required** | Long random secret for JWT signing |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth Client Secret |
| `APP_URL` | Optional | Public URL (default: `http://localhost:3000`) |
| `DATABASE_URL` | Optional | PostgreSQL DSN (default: docker config) |
| `REDIS_URL` | Optional | Redis URL (default: docker config) |
| `PORT` | Optional | Server port (default: `3000`) |
| `POSTGRES_PASSWORD` | Optional | Password for production database container setup |

> **Note:** If `GOOGLE_CLIENT_ID` is not set, the app falls back to a **sandbox login** (dev only). This is disabled in production.

### 3. Start infrastructure
```bash
docker compose up -d
```
This starts PostgreSQL 16 (port 5432) and Redis 7 (port 6379).

### 4. Run the app
```bash
npm run dev
```

App will be available at **http://localhost:3000** 🪦

The server auto-creates the database schema on first run.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                    Browser                      │
│  React SPA (Vite)  +  Canvas2D Renderer         │
└───────────────────────┬─────────────────────────┘
                        │ HTTP / Cookies
┌───────────────────────▼─────────────────────────┐
│            Express Server (server/)             │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │ Auth Routes  │  │      API Routes          │  │
│  │ /auth/google │  │  GET  /api/graves        │  │
│  │ /auth/me     │  │  POST /api/graves/confirm│  │
│  │ /auth/logout │  │  GET  /api/graves/mine   │  │
│  └─────────────┘  │  DELETE /api/graves/:id  │  │
│                   │  POST /api/upload         │  │
│                   │  POST /api/graves/:id/visit│  │
│                   │  GET  /health             │  │
│                   └──────────────────────────┘  │
└──────┬───────────────────────────┬──────────────┘
       │                           │
┌──────▼───────┐         ┌─────────▼──────────────┐
│  PostgreSQL  │         │         Redis           │
│  - users     │         │  - Viewport cache       │
│  - graves    │         │  - Session cache        │
│              │         │  - View counter buffer  │
│              │         │  - OAuth state (CSRF)   │
└──────────────┘         └────────────────────────┘
```

---

## 🔌 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/auth/me` | — | Get current session user |
| GET | `/api/auth/google/login` | — | Start Google OAuth flow |
| GET | `/api/auth/google/callback` | — | OAuth callback (handled by server) |
| POST | `/api/auth/logout` | — | Clear session cookie |
| GET | `/api/graves` | — | Fetch graves in viewport (`min_x`, `max_x`, `min_y`, `max_y`) |
| POST | `/api/graves/confirm` | ✅ | Stake a new grave plot |
| GET | `/api/graves/mine` | ✅ | Get all graves owned by authenticated user |
| DELETE | `/api/graves/:id` | ✅ | Delete your own grave |
| POST | `/api/graves/:id/visit` | — | Increment view counter (rate limited) |
| POST | `/api/upload` | ✅ | Upload grave image (raw binary, max 5MB) |
| GET | `/health` | — | Health check (DB + Redis status) |

---

## 🚢 Production Deployment

GraveIt is optimized for VPS deployment using Docker Compose and Caddy (as a reverse proxy with auto TLS).

1. **Setup Caddy**: Use the provided [Caddyfile](Caddyfile) to proxy requests from `graveit.rip` (or your domain) to the Node app on port `3000`.
2. **Build and Run (Prod)**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
   This will build the application image from the multi-stage [Dockerfile](Dockerfile) and run isolated, production-tuned containers for Node, Postgres, and Redis.

---

## 📄 License

Proprietary and Confidential. See [LICENSE](LICENSE) for details. All rights reserved.

---

## 🪦 Pages

| Path | Description |
|------|-------------|
| `/` | Main cemetery canvas |
| `/terms` | Terms of Service |
| `/privacy` | Privacy Policy |
| `/refund` | Refund Policy |
| `/pricing` | Pricing |
| `/health` | Server health check |
