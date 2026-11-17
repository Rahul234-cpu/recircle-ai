# ♻️ ReCircle AI
### Give Waste a Value. Give Products a Second Life.

ReCircle AI is a full-stack, AI-assisted circular-economy platform with **two marketplaces**:

1. **Waste selling & collection** — households photograph recyclables, get an AI material classification and an indicative price from admin-managed rates, and book a doorstep pickup. Nearby **verified kabadiwalas** are matched by distance, availability, capacity and rating; the collector weighs the material on-site, the customer confirms, and a digital receipt is issued.
2. **Second-hand marketplace** — users list reusable products with AI help (Reuse / Repair / Donate / Recycle recommendation, price range, description), buyers browse, chat privately, request to buy, and the seller completes the order after handover.

> Final-year B.Tech CSE project · React + Node/Express + MongoDB + Python FastAPI.

---

## Features at a glance

| Area | What's implemented |
|---|---|
| **Roles** | Customer, Kabadiwala (collector), Buyer, Admin — RBAC enforced on the API (`authorize()` middleware + ownership checks in services) and mirrored in the UI (`ProtectedRoute`). |
| **Waste booking workflow** | 15-step flow with a 10-status state machine (`backend/utils/stateMachines.js`). Illegal transitions return `409`. Atomic first-come acceptance, auto-widening of the collector pool, admin manual assignment, customer dispute of weights, receipts, ratings. |
| **Marketplace workflow** | Draft → (Pending Approval) → Available → Reserved → Sold; orders Requested → Accepted → Completed. A purchase request never completes an order by itself. |
| **AI (FastAPI)** | Waste image classification (CLIP zero-shot via Hugging Face, or a labelled demo heuristic), explainable Reuse/Repair/Donate/Recycle engine, price-range model using real comparable sales, description generator (LLM or template), FAQ-grounded support chatbot. All AI calls logged for admin monitoring. |
| **Matching & maps** | MongoDB `2dsphere` + `$geoNear`, Leaflet/OpenStreetMap pickers and maps, "near me" product search and map view. |
| **Privacy** | Collectors see only locality + rounded distance until they accept; listing locations rounded to ~100 m; phone/email masked in chat until an order is accepted; only the last 4 characters of ID numbers stored. |
| **Real-time** | Socket.IO (JWT handshake, per-user rooms); notifications persisted in MongoDB for offline users. |
| **Dashboards** | Customer, collector (calendar, earnings charts, service area & availability editors), buyer (recommendations, recently viewed), admin (stats, growth charts, verification, rates, listings moderation, orders, transactions, complaints, AI activity, rewards, settings). |
| **Impact & rewards** | Measured kg per material and items reused; eco-points per verified kg and per second-hand sale/purchase. **No unverifiable CO₂ claims.** |
| **Security** | bcrypt, JWT, Helmet, CORS allow-list, rate limiting (global/auth/AI), zod validation, Mongo operator stripping, upload MIME + magic-byte + size checks, server-side Razorpay signature verification. |

---

## Tech stack
**Frontend:** React 18, Vite, Tailwind CSS, React Router, Axios, React Hook Form, Recharts, Lucide icons, React-Leaflet, socket.io-client
**Backend:** Node.js, Express, Mongoose, JWT, bcryptjs, Socket.IO, zod, multer, Cloudinary SDK, Nodemailer, Razorpay SDK, express-rate-limit, Helmet
**AI service:** Python, FastAPI, Pydantic, Pillow, httpx (Hugging Face Inference API / OpenAI-compatible LLM — both optional)
**Database:** MongoDB (Atlas in production)
**Testing:** Jest + Supertest + mongodb-memory-server (backend), pytest (AI service)

## Project structure
```
recircle-ai/
├── frontend/          React app (src/components, pages, layouts, dashboards/{customer,collector,buyer,admin,shared}, context, hooks, services, utils)
├── backend/           Express API (config, controllers, middleware, models, routes, services, sockets, validators, utils/seed.js, tests)
├── ai-service/        FastAPI (main.py, routes/, services/, models/, utils/, data/knowledge_base.json, tests/)
└── docs/              architecture.md · database-schema.md · api-documentation.md · setup-guide.md · Postman collection
```

## Quick start
```bash
# 1) AI service
cd ai-service && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cp .env.example .env
uvicorn main:app --reload --port 8000
# 2) Backend (needs MongoDB running)
cd backend && npm install && cp .env.example .env && npm run seed && npm run dev
# 3) Frontend
cd frontend && npm install && npm run dev        # → http://localhost:5173
```
Full instructions, environment variables and Vercel/Render/Atlas deployment: **[docs/setup-guide.md](docs/setup-guide.md)**.

## Demo accounts (local development only)
Created by `npm run seed`. All seeded records are flagged `isDemo: true` and shown with a **"Demo data"** badge in the UI.

| Role | Email | Password |
|---|---|---|
| Admin | admin@recircle.ai | Admin@1234 |
| Customer | priya@demo.recircle.ai · rahul@demo.recircle.ai · ananya@demo.recircle.ai | Demo@1234 |
| Kabadiwala (verified) | ramesh@demo.recircle.ai · salim@demo.recircle.ai · lakshmi@demo.recircle.ai | Demo@1234 |
| Kabadiwala (pending verification) | vijay@demo.recircle.ai | Demo@1234 |
| Buyer | arjun@demo.recircle.ai · meera@demo.recircle.ai · kiran@demo.recircle.ai | Demo@1234 |

Seed contents: 12 waste categories with rates, 10 product categories, 10 pickup bookings across all key statuses, 15 product listings (4 sold, 1 reserved, 2 open requests), transactions, receipts, reviews, eco-reward ledger, notifications, a chat thread, a complaint and AI log entries. Demo product images are simple illustrations in `frontend/public/demo/` — replace them with real photos for a live deployment.

## Suggested demo script (≈10 min)
1. **Customer (Priya):** Sell Waste → upload a photo → see AI material + confidence + "Demo AI" label → enter kg → live estimate → pick address/date/slot → see matched collectors → confirm.
2. **Collector (Ramesh)** in another browser: real-time notification → Nearby Requests (no exact address) → Accept (address & phone unlock) → Start trip → Arrived → Verify weight.
3. **Customer:** notification → review verified amount → Confirm → receipt + eco-points; rate the collector.
4. **Customer:** Sell Used Products → Analyse my item (Reuse/Repair/Donate/Recycle with reasons) → Suggest price → Generate description → Publish.
5. **Buyer (Arjun):** browse with filters/map → message seller (try typing a phone number — it gets masked) → Request to buy.
6. **Customer:** Accept (product reserved) → Confirm handover → order completed, product sold.
7. **Admin:** verify Vijay's application, update a scrap rate (versioned), moderate a listing, view analytics & AI activity.

## AI: what is real and what is demo
| Module | With credentials | Without credentials (default) |
|---|---|---|
| Waste image classification | CLIP zero-shot through Hugging Face (`HF_API_TOKEN`) | **Demo heuristic** (colour/texture statistics + filename/description keywords). Confidence capped at 60%, response marked `is_demo`, UI shows a "Demo AI" badge and the limitation text. It is *not* a trained model. |
| Reuse / Repair / Donate / Recycle | Rule engine + LLM-written explanation | Transparent weighted rule engine (always real; every factor shown to the user) |
| Price range | Depreciation model blended with ReCircle's own sold-listing comparables | Same (no external dependency) |
| Description | LLM | Template generator from the seller's fields |
| Chatbot | TF-IDF retrieval over the project FAQ + LLM phrasing restricted to retrieved text | Retrieval only — returns the matching FAQ answer with its source |

## Testing
* `cd backend && npm test` — unit tests (state machines, matching score, payment signature, privacy masking, upload magic bytes) and API tests (auth, RBAC, full booking lifecycle incl. privacy and race-to-accept, rejection cascade, uploads, marketplace create/edit/ownership, full order lifecycle, admin verification and rate versioning, error handling). The AI client is mocked.
* `cd ai-service && pytest -q` — classifier (demo mode), recommender, pricing, description, chatbot retrieval.
* API exploration: import `docs/ReCircle-AI.postman_collection.json`.

## Known limitations / next steps
* The demo classifier is a heuristic; for production accuracy, configure CLIP or fine-tune a model (e.g. on TrashNet/TACO) and serve it from the AI service.
* Environmental impact intentionally reports only measured kilograms and items reused; adding CO₂e needs a documented methodology and region-specific emission factors.
* Online payment is implemented for marketplace orders in Razorpay **test mode**; scrap payouts are recorded as cash/UPI/bank transfer made directly by the collector.
* JWTs are stateless (logout = client discards token); add refresh tokens/token revocation for production.
* Email verification of new accounts and password reset by email are not implemented yet.

## Documentation
[Architecture](docs/architecture.md) · [Database schema](docs/database-schema.md) · [API reference](docs/api-documentation.md) · [Setup & deployment](docs/setup-guide.md)
