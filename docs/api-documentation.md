# REST API Documentation

Base URL: `http://localhost:5000/api` · Auth: `Authorization: Bearer <JWT>` · All responses: `{ success: boolean, ... }`.
Errors: `{ success: false, message, details?: [{ field, message }] }` with 400 (validation), 401, 403, 404, 409 (illegal state change / conflict), 413, 429 (rate limit), 503 (AI service unavailable).
Paginated lists return `{ items, pagination: { page, limit, total, pages } }` and accept `?page=&limit=`.

A ready-to-import Postman collection is in `docs/ReCircle-AI.postman_collection.json` (set the `baseUrl` and `token` variables).

Roles: **C** customer · **K** collector (kabadiwala) · **B** buyer · **A** admin · **P** public.

## Auth
| Method | Path | Role | Body / notes |
|---|---|---|---|
| POST | /auth/register | P | `{ name, email, password, phone?, role: customer\|buyer }` — admin cannot self-register. Returns `{ token, user }` |
| POST | /auth/login | P | `{ email, password }` |
| GET | /auth/me | any | Current user (+ `collectorProfile` for collectors) |
| POST | /auth/logout | any | Stateless; client discards token |
| POST | /auth/change-password | any | `{ currentPassword, newPassword }` |

## Users
| GET | /users/profile | any | |
|---|---|---|---|
| PUT | /users/profile | any | multipart: `name?, phone?, profileImage?` |
| GET | /users/addresses | any | |
| POST | /users/addresses | any | `{ label?, line1, locality?, city, pincode?, coordinates?: [lng,lat], isDefault? }` |
| PUT / DELETE | /users/addresses/:addressId | any | |
| GET | /users/impact | any | Personal measured impact |

## Waste & pickup bookings
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | /waste/categories | P | Active categories with current rate |
| POST | /waste/analyze | C | multipart `image` (+`description`). Stores image, calls AI classifier, maps material → category + rate. Returns `aiAvailable:false` (with image) if AI is down |
| POST | /waste/estimate | any | `{ items:[{categoryId, estimatedWeightKg}], city? }` → indicative price |
| POST | /waste/bookings | C | `{ items:[{categoryId, estimatedWeightKg, analysisId?, userOverrodeAI?}], pickupAddress:{line1, locality?, city, pincode?, coordinates}, preferredDate, preferredTimeSlot, customerNotes? }` → matches & notifies collectors |
| GET | /waste/bookings | C K A | `?status=a,b&scope=requests\|assigned` — collectors see privacy-reduced views for open requests |
| GET | /waste/bookings/:id | party | Includes `allowedActions` for the caller |
| PATCH | /waste/bookings/:id/status | party | `{ status, note? }` validated by the state machine (409 otherwise). Customer: `Cancelled`, `Completed` (confirm), `Arrived` (dispute). Collector: `On The Way`, `Arrived`, `Cancelled`. Admin: `Cancelled` |
| GET | /waste/bookings/:id/receipt | party | Digital receipt (completed only) |

## Collectors
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | /collectors/register | P | multipart: account + `businessName, idProofType, idProofNumber, serviceAreas(JSON), coordinates(JSON), serviceRadiusKm?, availability(JSON)?, acceptedMaterials(JSON)?, idProofImage?` → status `pending` |
| GET | /collectors/nearby | any | `?lng&lat&date?&timeSlot?&materials=slug,slug` → ranked public info (no exact location) |
| GET / PUT | /collectors/me | K | Profile, service area, availability, `isAvailable` |
| GET | /collectors/dashboard | K | Stats + booking calendar |
| GET | /collectors/earnings | K | Monthly totals, recent receipts |
| GET | /collectors/reviews | K | |
| GET | /collectors/requests | K | Open requests where caller is a candidate |
| POST | /collectors/bookings/:id/accept | K (verified) | Atomic — only one collector can win |
| POST | /collectors/bookings/:id/reject | K | `{ reason? }` — when all candidates reject, the pool widens; if none, booking → `Rejected` |
| POST | /collectors/bookings/:id/verify-weight | K (assigned) | `{ items:[{itemId, verifiedWeightKg, finalRatePerKg?}], paymentMethod?, collectorNotes? }` → `Weight Verified` → `Awaiting Customer Confirmation` |

## Marketplace
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | /products | P | `?q&category&condition&minPrice&maxPrice&city&lng&lat&radiusKm&sort=newest\|price_asc\|price_desc\|popular&page&limit` (Available only) |
| GET | /products/:id | P (optional auth) | Owners/admins can view non-public statuses; adds `isFavourite`, `myActiveOrder`, `similar` |
| GET | /products/categories | P | With live counts |
| GET | /products/map | P | `?lng&lat&radiusKm` map points |
| POST | /products | C | multipart `images[1–6]` + fields; `publish=true` → Available (or Pending Approval if admin requires) |
| PUT | /products/:id | C (owner) | multipart; `keepImages` (JSON array of URLs) controls removals |
| DELETE | /products/:id | C (owner) / A | Soft delete → `Removed` (not allowed while Reserved) |
| GET | /products/my-listings | C | With pending request counts |
| GET | /products/recommended · /products/recently-viewed | any | Buyer dashboard feeds |

## Orders & payments
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | /orders | C B | `{ productId, offeredPrice?, message?, paymentMethod: cash\|upi\|razorpay }` → `Requested` |
| GET | /orders | any | `?as=buyer\|seller&status=` |
| GET | /orders/:id | party | `myRole`, `allowedActions` |
| PATCH | /orders/:id/status | party | Seller: `Accepted {agreedPrice?}` (reserves product), `Rejected`, `Completed {handoverNote?}` (creates transaction, product → Sold). Buyer: `Cancelled`. |
| GET | /orders/payment-config | any | Whether Razorpay test mode is enabled |
| POST | /orders/:id/pay | buyer | Creates Razorpay order (accepted orders only) |
| POST | /orders/:id/verify-payment | buyer | `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }` — HMAC-SHA256 verified server-side |

## AI (proxied to the FastAPI service; every call logged in `aianalyses`)
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | /ai/health | P | Which providers are active |
| POST | /ai/classify | C | Same as `/waste/analyze` |
| POST | /ai/recommend | any | multipart `image?` + `title, description, category?, condition?, ageMonths?, isWorking?` → `{ action, reason, factors[], scores, suggested_category, estimated_condition, confidence }` |
| POST | /ai/price-estimate | any | `{ category, condition, brand?, ageMonths?, originalPrice?, title? }` — backend adds comparable sold listings → `{ min, max, suggested, factors[] }` |
| POST | /ai/generate-description | any | `{ title, category?, brand?, condition?, ageMonths?, features?[], notes? }` |
| POST | /ai/chat | P (optional auth) | `{ message, history?[] }` → `{ answer, sources[], suggestions[] }` |

## Misc
| GET | /notifications · PATCH /notifications/:id/read · PATCH /notifications/read-all | any |
|---|---|---|
| GET | /messages (conversations) · GET /messages/:key · POST /messages `{ productId, recipientId, body }` | any — contact info masked until an order is accepted |
| GET | /favourites · POST /favourites/:productId (toggle) | any |
| POST | /reviews `{ bookingId \| orderId, rating, comment? }` · GET /reviews/user/:userId | party / P |
| POST / GET | /complaints | any |
| GET | /transactions · /rewards | any |
| GET | /impact | P — platform totals |
| GET | /dashboard/customer · /dashboard/buyer | C · B,C |
| POST | /contact | P |

## Admin (`/admin/*`, role A)
`GET /dashboard` · `GET /analytics` · `GET /ai-activity` · `GET /users` · `PATCH /users/:id {isActive?, role?}` · `GET /collectors?status=` · `PATCH /collectors/:id/verify {decision, note?}` · CRUD `/waste-categories` · CRUD `/product-categories` · CRUD `/scrap-rates` (PUT creates a new version) · `GET /bookings` · `POST /bookings/:id/assign {collectorUserId}` · `GET /products` · `PATCH /products/:id/status {status, reason?}` · `GET /orders` · `GET /transactions?type=` · `GET /complaints` · `PATCH /complaints/:id` · `GET/POST /rewards` · `GET/PUT /settings`

## Socket.IO events
Connect with `io(url, { auth: { token } })`. Server joins the socket to `user:<id>` and `role:<role>`.
* `notification` — persisted notification document (booking, order, message, review, verification events)
* `message` — new chat message
* `admin.alert` — to admins: new collector application, unmatched booking, pending listing, new complaint
