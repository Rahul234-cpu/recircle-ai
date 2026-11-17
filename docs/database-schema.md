# Database Schema (MongoDB + Mongoose)

All collections have `createdAt` / `updatedAt` timestamps. Seeded records carry `isDemo: true` where the schema has that field, and demo users use the `@demo.recircle.ai` email domain.

## Relationship overview

```
User 1──1 Collector (role = collector)
User 1──* PickupBooking (customerId)      Collector-User 1──* PickupBooking (collectorId)
PickupBooking 1──* WasteItem ──* WasteCategory ──* ScrapRate (versioned)
User 1──* Product (sellerId) 1──* Order (buyer, seller)
PickupBooking 1──1 Transaction(type=scrap_collection)   Order 1──1 Transaction(type=marketplace_sale)
Review → (booking | order), reviewer, reviewee
Notification, Message, Favourite, Complaint, EcoReward, AIAnalysis → User
ProductCategory (slug referenced by Product.category), PlatformSetting (key/value)
```

## Collections

| # | Collection | Key fields | Indexes / validation |
|---|---|---|---|
| 1 | **users** | name, email, phone, passwordHash (bcrypt, `select:false`), role (`customer/collector/buyer/admin`), profileImage, addresses[{label,line1,locality,city,state,pincode,location(Point),isDefault}], isVerified, isActive, ecoPoints, sellerRating{average,count}, customerRating, recentlyViewed[] | unique email; role index; Indian mobile regex; 6-digit pincode |
| 2 | **collectors** | userId (unique), businessName, address, vehicleType, idProofType, idProofLast4 (only last 4 stored), idProofImage, serviceAreas[{name,pincode}], location(Point), serviceRadiusKm, availability{days[],timeSlots[],dailyCapacity}, isAvailable, acceptedMaterials[], verificationStatus (`pending/approved/rejected`), verifiedBy, averageRating, ratingCount, completedCollections, totalKgCollected, totalPaidToCustomers, estimatedMargin | **2dsphere** on location; verificationStatus index |
| 3 | **wastecategories** | name, slug, materialType (`paper/cardboard/plastic/metal/glass/e-waste/textile/mixed`), description, recyclable, recyclingInfo, handlingTips, icon, isActive, sortOrder | unique name & slug |
| 4 | **scraprates** | category→WasteCategory, city (`All` default), pricePerKg, resalePricePerKg (reference for margin), unit, isActive, effectiveFrom, updatedBy | (category, city, isActive). Updates insert a new version and archive the old one. |
| 5 | **wasteitems** | owner, booking, category, images[], aiAnalysis→AIAnalysis, predictedMaterial, aiConfidence, userOverrodeAI, estimatedWeightKg, ratePerKg (snapshot), estimatedPrice, verifiedWeightKg, finalRatePerKg, finalPrice | owner, booking indexes |
| 6 | **pickupbookings** | bookingRef, customerId, collectorId, collectorProfile, wasteItems[], materialSummary[], pickupAddress{line1,locality,city,pincode,contactName,contactPhone,location(Point)}, preferredDate, preferredTimeSlot, estimatedWeight, verifiedWeight, estimatedPrice, finalPrice, status (10-value enum), statusHistory[{status,by,role,note,at}], candidateCollectors[{collector,distanceKm,score,notifiedAt}], rejectedBy[], paymentStatus, paymentMethod, receipt{number,issuedAt}, transaction, customerRated, collectorRated, completedAt | **2dsphere** on pickupAddress.location; (candidateCollectors.collector, status); (collectorId, preferredDate, status) |
| 7 | **products** | sellerId, title, description, category (slug), images[1–6], brand, condition (`New/Like New/Good/Fair/Needs Repair`), ageMonths, features[], originalPrice, sellingPrice, AIRecommendedPrice{min,max,suggested,method}, aiRecommendation{action,reason,confidence,userOverrode}, location(Point, rounded ≈100 m), locationLabel, status (7-value enum), views, favouritesCount, soldAt | **2dsphere** location; **text** (title×5, brand×3, description); (status, category, sellingPrice) |
| 8 | **orders** | orderRef, product, buyer, seller, offeredPrice, agreedPrice, message, status (`Requested/Accepted/Rejected/Completed/Cancelled`), statusHistory[], paymentMethod (`cash/upi/razorpay`), paymentStatus, razorpayOrderId, razorpayPaymentId, transaction, buyerRated | product, buyer, seller, status |
| 9 | **transactions** | transactionId, type (`scrap_collection/marketplace_sale`), bookingId \| orderId (one required), buyerId (payer), sellerId (payee), amount, paymentMethod, paymentStatus, gatewayRef, lineItems[], receiptNumber | type, buyerId, sellerId |
| 10 | **reviews** | reviewer, reviewee, targetType (`collector/customer/seller`), booking \| order, product, rating 1–5, comment | unique (reviewer, booking) and (reviewer, order) partial indexes |
| 11 | **notifications** | user, type, title, message, link, data, readAt | (user, readAt, createdAt) |
| 12 | **messages** | conversationKey (`productId:userA:userB`), product, sender, recipient, body, wasMasked, readAt | conversationKey, recipient |
| 13 | **favourites** | user, product | unique (user, product) |
| 14 | **complaints** | complaintRef, user, category, subject, description, relatedId, status (`open/in_progress/resolved/closed`), adminResponse, resolvedBy | user, status |
| 15 | **ecorewards** | user, points (±), type (`earn/redeem/adjust`), reason, refType, refId, awardedBy | user |
| 16 | **aianalyses** | user, type (`classify/recommend/price/describe/chat`), provider, input (base64 stripped), output, confidence, latencyMs, success, error, imageUrl | user, type |
| + | **productcategories** | name, slug, icon, description, isActive, sortOrder | unique slug |
| + | **platformsettings** | key, value, updatedBy | unique key |

## Separate transaction workflows

* **Scrap collection** — created only when the customer confirms a booking in `Awaiting Customer Confirmation`. Payer = collector, payee = customer; line items carry verified kg × agreed rate.
* **Marketplace sale** — created only when the seller confirms handover of an `Accepted` order. Payer = buyer, payee = seller. Online payments must pass server-side Razorpay signature verification first.
