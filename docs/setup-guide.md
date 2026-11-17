# Setup & Deployment Guide

## 1. Prerequisites
* Node.js 18+ (20 LTS recommended) and npm
* Python 3.10+ (3.12 recommended)
* MongoDB 6+ running locally **or** a free MongoDB Atlas cluster
* Optional accounts: Cloudinary, Hugging Face, an OpenAI-compatible LLM key, SMTP mailbox, Razorpay (test mode)

## 2. Run locally (three terminals)

### Terminal 1 — AI service
```bash
cd ai-service
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # set AI_SERVICE_KEY (same value as backend)
uvicorn main:app --reload --port 8000
# check: http://localhost:8000/health   docs: http://localhost:8000/docs
pytest -q                                              # 15 unit tests
```

### Terminal 2 — Backend
```bash
cd backend
npm install
cp .env.example .env              # set MONGODB_URI, JWT_SECRET, AI_SERVICE_KEY
npm run seed                      # demo data (wipes the database!)
npm run dev                       # http://localhost:5000/api/health
npm test                          # Jest + Supertest + in-memory MongoDB
```
> `npm test` downloads a MongoDB binary the first time (mongodb-memory-server). It needs internet access once.

### Terminal 3 — Frontend
```bash
cd frontend
npm install
cp .env.example .env              # leave VITE_API_URL empty for local dev (Vite proxies /api)
npm run dev                       # http://localhost:5173
```

Log in with the demo accounts listed in the root README (the login page also has one-click demo buttons in development builds).

## 3. Environment variables

| Service | Variable | Required | Purpose |
|---|---|---|---|
| backend | `MONGODB_URI` | ✔ | Mongo connection string |
| backend | `JWT_SECRET` | ✔ | Long random string (`openssl rand -hex 32`) |
| backend | `AI_SERVICE_URL`, `AI_SERVICE_KEY` | ✔ | Where the FastAPI service runs + shared secret |
| backend | `CLIENT_URL`, `CORS_ORIGINS` | ✔ in prod | Allowed frontend origins (comma-separated) |
| backend | `PUBLIC_API_URL` | ✔ in prod | Public backend URL, used for locally stored image URLs |
| backend | `CLOUDINARY_*` | optional | Image hosting. Without it images are stored in `backend/uploads/` |
| backend | `SMTP_*`, `EMAIL_FROM` | optional | Real emails. Without it emails are printed to the console |
| backend | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | optional | Test-mode online payments. Without it only cash/UPI on handover |
| ai-service | `AI_SERVICE_KEY` | ✔ | Must match backend |
| ai-service | `HF_API_TOKEN`, `HF_INFERENCE_URL` | optional | CLIP zero-shot waste classification. Without it: labelled demo heuristic |
| ai-service | `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | optional | Descriptions + chatbot phrasing. Without it: templates + FAQ retrieval |
| frontend | `VITE_API_URL` | ✔ in prod | Backend origin, e.g. `https://recircle-api.onrender.com` |
| frontend | `VITE_SOCKET_URL` | optional | Defaults to `VITE_API_URL` |

Never commit `.env` files — they are in `.gitignore`.

## 4. External services

**Cloudinary** — create a free account → Dashboard → copy cloud name, API key, API secret into backend `.env`. Restart the backend; `/api/health` shows `storage: cloudinary`.

**Hugging Face (vision)** — huggingface.co → Settings → Access Tokens → create a *read* token → `HF_API_TOKEN`. The default `HF_INFERENCE_URL` points to `openai/clip-vit-base-patch32` zero-shot classification. If Hugging Face changes its inference endpoint, update the URL; on any failure the service falls back to the demo heuristic and says so in the response.

**LLM** — any OpenAI-compatible endpoint works (`/chat/completions`). Set `LLM_API_KEY`, and `LLM_BASE_URL`/`LLM_MODEL` if not OpenAI.

**SMTP** — e.g. a Gmail app password (`smtp.gmail.com`, port 587) or Mailtrap for testing.

**Razorpay (test mode)** — dashboard.razorpay.com → switch to Test Mode → Settings → API Keys. Use test cards from Razorpay docs. Payment success is accepted only after the backend verifies `HMAC_SHA256(order_id|payment_id, key_secret)`.

## 5. Deployment

### MongoDB Atlas
1. Create a free M0 cluster, a database user, and allow network access from `0.0.0.0/0` (or Render's egress IPs).
2. Copy the `mongodb+srv://…` string into the backend `MONGODB_URI` (add `/recircle_ai` as the database name).
3. Optionally run the seed once from your machine with that URI: `MONGODB_URI=… npm run seed`.

### AI service → Render (Web Service)
* Root directory: `ai-service` · Runtime: Python (or Docker using the included `Dockerfile`)
* Build: `pip install -r requirements.txt` · Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
* Env: `AI_SERVICE_KEY`, optional `HF_API_TOKEN`, `LLM_API_KEY`

### Backend → Render (Web Service)
* Root directory: `backend` · Build: `npm install` · Start: `npm start`
* Env: everything from `backend/.env.example` with production values; `AI_SERVICE_URL=https://<your-ai-service>.onrender.com`, `CLIENT_URL` / `CORS_ORIGINS=https://<your-app>.vercel.app`, `PUBLIC_API_URL=https://<your-backend>.onrender.com`, `NODE_ENV=production`
* Render's free disk is ephemeral — **configure Cloudinary in production** so uploaded images persist.
* WebSockets work on Render out of the box.

### Frontend → Vercel
* Import the repo, root directory `frontend`, framework preset **Vite**.
* Env: `VITE_API_URL=https://<your-backend>.onrender.com`
* `vercel.json` already rewrites all routes to `index.html` for client-side routing.

### Post-deploy checklist
- [ ] `GET <backend>/api/health` → `status: ok`
- [ ] `GET <backend>/api/ai/health` → AI service reachable
- [ ] Log in as admin, open **Settings** → integrations panel shows expected providers
- [ ] Create a booking as a customer and accept it as a collector in another browser — the customer gets a real-time notification
- [ ] Change the default demo passwords (or don't seed demo users in production)
