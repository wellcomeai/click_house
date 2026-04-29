# ClickHouse Irkutsk

B2B web platform for construction company management with AI agents.

## Stack

- **Backend**: Python 3.11 + FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL 15
- **Frontend**: React 18 + Vite + TypeScript + shadcn/ui + Tailwind CSS
- **AI**: OpenRouter API (3 specialized agents with tool use)
- **Deploy**: Render.com

## Local Development

### Prerequisites
- Docker & Docker Compose
- Python 3.11+
- Node.js 18+

### Setup

```bash
# 1. Clone and enter
git clone <repo-url>
cd clickhouse-irkutsk

# 2. Start PostgreSQL
docker compose up -d

# 3. Backend setup
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 4. Copy env and configure
cp ../.env.example .env
# Edit .env — set OPENROUTER_API_KEY and ADMIN_PASSWORD

# 5. Run migrations
alembic upgrade head

# 6. Create admin user
python scripts/create_admin.py

# 7. Start backend
uvicorn main:app --reload
# API: http://localhost:8000
# Docs: http://localhost:8000/docs

# 8. Frontend (separate terminal)
cd ../frontend
npm install
npm run dev
# App: http://localhost:5173
```

## Deploy on Render

```bash
# 1. Push to GitHub
git push origin main

# 2. Render Dashboard → New → Blueprint → select repo
# Render reads render.yaml and creates:
#   - PostgreSQL database
#   - Backend web service  
#   - Frontend static site

# 3. Set secrets in Render Dashboard (clickhouse-irkutsk-api → Environment):
#   OPENROUTER_API_KEY = sk-or-v1-...
#   ADMIN_PASSWORD     = your_secure_password
```

## Roles

| Role | Access |
|------|--------|
| admin | Full access + user management |
| manager | Create/manage objects and tasks |
| foreman | Create/assign tasks, see own objects |
| worker | See own tasks only |

## AI Agents

- **task_assistant** — creates and manages tasks
- **object_analyst** — analyzes construction objects, finds issues
- **doc_helper** — generates reports and documents

Available to: admin, manager, foreman (not worker).
