# ReCircle AI — System Architecture

## 1. High-level view

```
┌────────────────────────┐        HTTPS (REST + JWT)        ┌──────────────────────────┐   HTTP (internal key)   ┌───────────────────────────┐
│  React + Vite frontend │ ───────────────────────────────▶ │  Node.js / Express API   │ ──────────────────────▶ │  Python FastAPI AI service│
│  (Vercel)              │ ◀──── Socket.IO (notifications) ─│  (Render)                │ ◀────────────────────── │  (Render)                 │
└────────────────────────┘                                  └──────────┬───────────────┘                         └─────────────┬─────────────┘
          │  Leaflet + OSM tiles                                       │ Mongoose                                              │ optional
          ▼                                                            ▼                                                       ▼
   OpenStreetMap tile CDN                                  MongoDB Atlas (16+ collections)              Hugging Face Inference API (CLIP zero-shot)
                                                           Cloudinary (images, optional)                OpenAI-compatible LLM (descriptions/chat, optional)
                                                           SMTP via Nodemailer (optional)
                                                           Razorpay test mode (optional)
```

* **Frontend** never talks to the AI service or to third-party secrets directly. All AI calls go through `/api/ai/*` on the backend, which authenticates the user, forwards to the AI service with a shared `AI_SERVICE_KEY`, and logs every call in the `AIAnalysis` collection.
* **Backend** owns all business rules: booking/order state machines, collector matching, price calculation from admin-managed rates, rewards, notifications and privacy masking.
* **AI service** is stateless. It receives images (base64) and structured context, and returns predictions. The backend sends it the data it needs (e.g. comparable sold prices) so the AI service never touches the database.

## 2. Demo mode vs. live mode (honest labelling)

| Capability | Live mode (env configured) | Demo mode (no credentials) |
|---|---|---|
| Waste image classification | CLIP zero-shot via Hugging Face (`HF_API_TOKEN`) | Colour/texture heuristic + keyword hints from filename/description. Confidence is capped at 0.6 and the response carries `provider: "demo-heuristic"` and a `limitations` note shown in the UI. |
| Reuse / Recycle / Repair / Donate | Rule engine + optional LLM explanation | Transparent rule engine (always on). Every rule that fired is returned in `factors[]`. |
| Product price range | Depreciation model blended with comparable sold listings from the DB | Same — no external service needed. |
| Description generator | OpenAI-compatible chat model (`LLM_API_KEY`) | Template generator using the seller's fields. |
| Chatbot | Retrieval over `knowledge_base.json` + optional LLM phrasing | Retrieval only (returns best-matching FAQ answers with sources). |
| Images | Cloudinary | Saved to `backend/uploads/` and served at `/uploads`. |
| Email | SMTP via Nodemailer | Logged to console. |
| Payments | Razorpay test mode with server-side HMAC signature verification | “Cash/UPI on handover”, recorded by the seller. |

## 3. Backend layering

```
routes/        → URL + middleware chain (auth, role, validation, upload)
controllers/   → thin HTTP adapters: parse req, call services, shape response
services/      → business logic (bookingService, orderService, matchingService, rewardService, notificationService, aiClient, storageService, paymentService, emailService)
models/        → Mongoose schemas with validation + indexes
middleware/    → auth (JWT), authorize(roles), validate(zod), upload (multer), rateLimit, error handler
sockets/       → Socket.IO server with JWT handshake; one room per user (`user:<id>`) and per role (`role:admin`)
utils/         → ApiError, asyncHandler, pagination, privacy masking, geo helpers, state machines
```

## 4. State machines

### Pickup booking

```
Pending ──accept(collector)──▶ Accepted ─┐
   │  └──assign(admin)────────▶ Collector Assigned ─┤
   │                                               ▼
   ├──all candidates reject──▶ Rejected        On The Way ──▶ Arrived ──verify-weight──▶ Weight Verified ──(auto)──▶ Awaiting Customer Confirmation
   └──cancel(customer/admin)─▶ Cancelled                          ▲                                                     │      │
                                                                  └───────────── dispute(customer) ─────────────────────┘      └─confirm(customer)─▶ Completed
```

Transitions are declared once in `backend/utils/stateMachines.js` with **who** may perform each one. The controller asks the machine `canTransition(from, to, actorRole)` — any other change returns HTTP 409.

### Marketplace order

```
Requested ──accept(seller)──▶ Accepted ──confirm-handover(seller)──▶ Completed
    │  └──reject(seller)──▶ Rejected        │
    └──cancel(buyer)──────▶ Cancelled ◀─────┘ cancel(buyer|seller)
```

Product status follows: `Available → Reserved` (order accepted) → `Sold` (order completed) or back to `Available` (order cancelled).

## 5. Collector matching

1. `$geoNear` on `Collector.location` (2dsphere) within the platform matching radius (default 15 km, admin setting) **and** within each collector's own `serviceRadiusKm`.
2. Filter: `verificationStatus = approved`, `isAvailable = true`, works on the requested weekday and time slot, active bookings on that date `< dailyCapacity`, accepts at least one of the requested materials.
3. Score = `0.45·(1 − d/R) + 0.35·(rating/5) + 0.20·(1 − load/capacity)`; top N (default 5) become `candidateCollectors` and are notified.
4. Before acceptance collectors see only: material summary, estimated weight, date/slot, locality name, and distance rounded to 0.5 km. Exact address, phone and coordinates are released only to the assigned collector.

## 6. Security

JWT (Bearer), bcrypt (12 rounds), Helmet, CORS allow-list, `express-rate-limit` (global + stricter on auth/AI), zod validation on every write endpoint, multer MIME + size limits, ownership checks in services, server-side Razorpay signature verification, contact-detail masking in messages until an order is accepted, `express-mongo-sanitize`-style key stripping, centralised error handler that never leaks stack traces in production.

## 7. Development milestones

| Phase | Output |
|---|---|
| 1 Planning | This document, schema, API contract |
| 2 UI | Landing + public pages, auth pages, 4 dashboards, marketplace + booking UIs |
| 3 Backend | Express app, Mongo models, auth/RBAC, all REST endpoints, workflows |
| 4 AI | FastAPI: classify, recommend, price, describe, chat |
| 5 Integration | Axios services, uploads, Leaflet maps, Socket.IO notifications |
| 6 Testing | Jest + Supertest + mongodb-memory-server; pytest for AI service |
| 7 Deployment | Vercel / Render / Atlas guide in `setup-guide.md` |
