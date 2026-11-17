/* eslint-disable no-console */
/**
 * Demo data seeder. ALL records created here carry isDemo: true (where the schema supports it)
 * and demo users use the @demo.recircle.ai domain, so they are easy to tell apart from real data.
 *
 *   npm run seed            → wipe + seed
 *   npm run seed -- --keep  → seed only if the database is empty
 */
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');
const models = require('../models');
const { BOOKING_STATUS: B, PRODUCT_STATUS: P, ORDER_STATUS: O } = require('../config/constants');
const { makeRef } = require('./ids');

const {
  User, Collector, WasteCategory, ScrapRate, WasteItem, PickupBooking, Product, Order, Transaction, Review,
  Notification, Message, Favourite, Complaint, EcoReward, AIAnalysis, ProductCategory, PlatformSetting,
} = models;

const DEMO_PASSWORD = 'Demo@1234';
const ADMIN_PASSWORD = 'Admin@1234';

// Bengaluru localities [lng, lat]
const LOC = {
  indiranagar: [77.6412, 12.9719],
  koramangala: [77.6245, 12.9352],
  hsr: [77.6387, 12.9116],
  jayanagar: [77.5838, 12.9299],
  btm: [77.6101, 12.9166],
  malleshwaram: [77.5713, 13.0031],
  whitefield: [77.75, 12.9698],
  domlur: [77.6387, 12.9606],
};

const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(10, 0, 0, 0); return d; };
const daysAgo = (n) => daysFromNow(-n);

async function makeUser(data, password = DEMO_PASSWORD) {
  const u = new User({ ...data, isVerified: true, isDemo: true });
  await u.setPassword(password);
  return u.save();
}

async function run() {
  await connectDB();
  const keep = process.argv.includes('--keep');
  if (keep && (await User.countDocuments()) > 0) {
    console.log('[seed] database not empty, skipping (--keep)');
    return;
  }

  console.log('[seed] clearing collections…');
  await Promise.all(Object.values(models).map((m) => m.deleteMany && m.deleteMany({})));
  await Promise.all(Object.values(models).map((m) => m.syncIndexes && m.syncIndexes()));

  // ------------------------------------------------------------------ settings & categories
  await PlatformSetting.create({ key: 'listingRequiresApproval', value: false });

  const wasteCats = await WasteCategory.insertMany([
    { name: 'Newspaper', slug: 'newspaper', materialType: 'paper', icon: 'Newspaper', sortOrder: 1, description: 'Old newspapers and magazines', recyclingInfo: 'Pulped and turned into recycled paper and board.', handlingTips: 'Keep dry and tie in bundles.' },
    { name: 'Cardboard', slug: 'cardboard', materialType: 'cardboard', icon: 'Package', sortOrder: 2, description: 'Cartons and corrugated boxes', recyclingInfo: 'Recycled into new corrugated board.', handlingTips: 'Flatten boxes, remove tape where possible.' },
    { name: 'Books & Office Paper', slug: 'office-paper', materialType: 'paper', icon: 'BookOpen', sortOrder: 3, description: 'Notebooks, printouts, old books', recyclingInfo: 'High-grade paper fibre; good books can be donated instead.', handlingTips: 'Remove plastic covers and binders.' },
    { name: 'PET Plastic Bottles', slug: 'pet-bottles', materialType: 'plastic', icon: 'CupSoda', sortOrder: 4, description: 'Water and soft-drink bottles', recyclingInfo: 'Shredded into flakes for polyester fibre and new bottles.', handlingTips: 'Rinse, crush and keep caps separately.' },
    { name: 'Hard Plastic', slug: 'hard-plastic', materialType: 'plastic', icon: 'Box', sortOrder: 5, description: 'Buckets, tubs, containers', recyclingInfo: 'Ground and re-moulded into plastic products.', handlingTips: 'Empty and clean containers.' },
    { name: 'Iron & Steel', slug: 'iron', materialType: 'metal', icon: 'Wrench', sortOrder: 6, description: 'Iron rods, steel utensils, almirahs', recyclingInfo: 'Melted in furnaces; steel is endlessly recyclable.', handlingTips: 'Separate from aluminium and copper.' },
    { name: 'Aluminium', slug: 'aluminium', materialType: 'metal', icon: 'Cylinder', sortOrder: 7, description: 'Cans, utensils, window frames', recyclingInfo: 'Remelted using a fraction of the energy of new aluminium.', handlingTips: 'Crush cans to save space.' },
    { name: 'Copper & Brass', slug: 'copper-brass', materialType: 'metal', icon: 'Cable', sortOrder: 8, description: 'Wires, taps, brass vessels', recyclingInfo: 'High-value metals, fully recyclable.', handlingTips: 'Strip insulation if you can do it safely.' },
    { name: 'Glass Bottles', slug: 'glass', materialType: 'glass', icon: 'Wine', sortOrder: 9, description: 'Bottles and jars', recyclingInfo: 'Crushed into cullet and remelted.', handlingTips: 'Do not break; pack carefully.' },
    { name: 'E-Waste', slug: 'e-waste', materialType: 'e-waste', icon: 'Cpu', sortOrder: 10, description: 'Phones, chargers, PCBs, small electronics', recyclingInfo: 'Must go to authorised e-waste recyclers for safe metal recovery.', handlingTips: 'Remove batteries and wipe personal data first.' },
    { name: 'Old Appliances', slug: 'appliances', materialType: 'e-waste', icon: 'Refrigerator', sortOrder: 11, description: 'Non-working fridges, washing machines, ACs', recyclingInfo: 'Dismantled for metal, plastic and refrigerant recovery.', handlingTips: 'Mention size so the collector brings the right vehicle.' },
    { name: 'Textiles', slug: 'textiles', materialType: 'textile', icon: 'Shirt', sortOrder: 12, description: 'Worn-out clothes and fabric', recyclingInfo: 'Shredded into fibre for insulation and rags.', handlingTips: 'Wearable clothes are better donated.' },
  ]);
  const cat = Object.fromEntries(wasteCats.map((c) => [c.slug, c]));

  // Indicative demo rates (₹/kg) — admins should replace these with current local rates.
  const rateTable = {
    newspaper: [14, 18], cardboard: [10, 13], 'office-paper': [12, 15], 'pet-bottles': [12, 18], 'hard-plastic': [8, 12],
    iron: [28, 34], aluminium: [110, 130], 'copper-brass': [420, 480], glass: [2, 3], 'e-waste': [30, 45], appliances: [18, 25], textiles: [5, 8],
  };
  await ScrapRate.insertMany(Object.entries(rateTable).map(([slug, [price, resale]]) => ({
    category: cat[slug]._id, city: 'All', pricePerKg: price, resalePricePerKg: resale,
  })));

  await ProductCategory.insertMany([
    ['Furniture', 'Sofa'], ['Laptops', 'Laptop'], ['Mobile Phones', 'Smartphone'], ['Bicycles', 'Bike'], ['Electronics', 'Tv'],
    ['Home Appliances', 'Refrigerator'], ['Books', 'BookOpen'], ['Clothing', 'Shirt'], ['Kitchen', 'CookingPot'], ['Other', 'Package'],
  ].map(([name, icon], i) => ({ name, slug: name.toLowerCase().replace(/\s+/g, '-'), icon, sortOrder: i })));

  // ------------------------------------------------------------------ users
  const admin = await makeUser({ name: 'Platform Admin', email: 'admin@recircle.ai', phone: '9000000001', role: 'admin' }, ADMIN_PASSWORD);

  const addr = (label, line1, locality, coords, pincode) => ({ label, line1, locality, city: 'Bengaluru', state: 'Karnataka', pincode, location: { type: 'Point', coordinates: coords }, isDefault: true });
  const priya = await makeUser({ name: 'Priya Sharma', email: 'priya@demo.recircle.ai', phone: '9876500001', role: 'customer', addresses: [addr('Home', '221, 12th Main, HAL 2nd Stage', 'Indiranagar', LOC.indiranagar, '560038')] });
  const rahul = await makeUser({ name: 'Rahul Verma', email: 'rahul@demo.recircle.ai', phone: '9876500002', role: 'customer', addresses: [addr('Home', 'Flat 4B, Sobha Apartments, 5th Block', 'Koramangala', LOC.koramangala, '560095')] });
  const ananya = await makeUser({ name: 'Ananya Iyer', email: 'ananya@demo.recircle.ai', phone: '9876500003', role: 'customer', addresses: [addr('Home', '17, 27th Main, Sector 2', 'HSR Layout', LOC.hsr, '560102')] });
  const customers = [priya, rahul, ananya];

  const arjun = await makeUser({ name: 'Arjun Mehta', email: 'arjun@demo.recircle.ai', phone: '9876500011', role: 'buyer', addresses: [addr('Home', '45, 9th Block', 'Jayanagar', LOC.jayanagar, '560069')] });
  const meera = await makeUser({ name: 'Meera Nair', email: 'meera@demo.recircle.ai', phone: '9876500012', role: 'buyer', addresses: [addr('Home', '8, 2nd Stage', 'BTM Layout', LOC.btm, '560076')] });
  const kiran = await makeUser({ name: 'Kiran Rao', email: 'kiran@demo.recircle.ai', phone: '9876500013', role: 'buyer', addresses: [addr('Home', '3, 15th Cross', 'Malleshwaram', LOC.malleshwaram, '560003')] });
  const buyers = [arjun, meera, kiran];

  const allDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const allSlots = ['08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00', '18:00-20:00'];
  const collectorDefs = [
    { name: 'Ramesh Kumar', email: 'ramesh@demo.recircle.ai', phone: '9876500021', business: 'Ramesh Kabadi Services', loc: LOC.domlur, areas: [['Indiranagar', '560038'], ['Domlur', '560071'], ['Koramangala', '560095']], vehicle: 'auto', rating: 4.7 },
    { name: 'Salim Khan', email: 'salim@demo.recircle.ai', phone: '9876500022', business: 'Salim Scrap & Recyclers', loc: LOC.btm, areas: [['BTM Layout', '560076'], ['HSR Layout', '560102'], ['Koramangala', '560095']], vehicle: 'mini-truck', rating: 4.5 },
    { name: 'Lakshmi Devi', email: 'lakshmi@demo.recircle.ai', phone: '9876500023', business: 'Lakshmi Green Collectors', loc: LOC.jayanagar, areas: [['Jayanagar', '560069'], ['BTM Layout', '560076'], ['Basavanagudi', '560004']], vehicle: 'cycle-cart', rating: 4.8 },
  ];
  const collectorUsers = [];
  const collectorProfiles = [];
  for (const d of collectorDefs) {
    // eslint-disable-next-line no-await-in-loop
    const u = await makeUser({ name: d.name, email: d.email, phone: d.phone, role: 'collector' });
    // eslint-disable-next-line no-await-in-loop
    const p = await Collector.create({
      userId: u._id, businessName: d.business, vehicleType: d.vehicle, idProofType: 'aadhaar', idProofLast4: String(1000 + collectorUsers.length * 1111).slice(-4),
      serviceAreas: d.areas.map(([name, pincode]) => ({ name, pincode })), location: { type: 'Point', coordinates: d.loc }, serviceRadiusKm: 10,
      availability: { days: allDays, timeSlots: allSlots, dailyCapacity: 8 }, verificationStatus: 'approved', verifiedAt: daysAgo(60), verifiedBy: admin._id,
      averageRating: d.rating, address: `${d.areas[0][0]}, Bengaluru`, isDemo: true,
    });
    collectorUsers.push(u);
    collectorProfiles.push(p);
  }
  // A pending applicant so the admin verification workflow can be demonstrated.
  const vijay = await makeUser({ name: 'Vijay Patil', email: 'vijay@demo.recircle.ai', phone: '9876500024', role: 'collector' });
  await Collector.create({
    userId: vijay._id, businessName: 'Vijay Scrap Traders', vehicleType: 'two-wheeler', idProofType: 'voter-id', idProofLast4: 'K921',
    serviceAreas: [{ name: 'Whitefield', pincode: '560066' }], location: { type: 'Point', coordinates: LOC.whitefield }, serviceRadiusKm: 8,
    availability: { days: ['mon', 'wed', 'fri', 'sat'], timeSlots: ['10:00-12:00', '14:00-16:00'], dailyCapacity: 5 }, verificationStatus: 'pending', isDemo: true,
  });

  // ------------------------------------------------------------------ waste bookings (10)
  const bookingDefs = [
    { c: priya, col: null, status: B.PENDING, date: daysFromNow(2), slot: '10:00-12:00', items: [['newspaper', 12], ['cardboard', 6]], cand: [0, 1] },
    { c: rahul, col: null, status: B.PENDING, date: daysFromNow(1), slot: '14:00-16:00', items: [['pet-bottles', 4], ['aluminium', 2]], cand: [0, 1] },
    { c: ananya, col: null, status: B.PENDING, date: daysFromNow(3), slot: '16:00-18:00', items: [['iron', 15]], cand: [1, 2] },
    { c: priya, col: 0, status: B.ACCEPTED, date: daysFromNow(1), slot: '08:00-10:00', items: [['e-waste', 3], ['copper-brass', 1]], cand: [0] },
    { c: rahul, col: 1, status: B.ON_THE_WAY, date: daysFromNow(0), slot: '12:00-14:00', items: [['cardboard', 10], ['hard-plastic', 5]], cand: [1] },
    { c: ananya, col: 1, status: B.AWAITING_CONFIRMATION, date: daysFromNow(0), slot: '10:00-12:00', items: [['newspaper', 20], ['glass', 8]], cand: [1], verified: [18.5, 8] },
    { c: priya, col: 0, status: B.COMPLETED, date: daysAgo(20), slot: '10:00-12:00', items: [['newspaper', 25], ['office-paper', 10]], cand: [0], verified: [26.2, 9.4] },
    { c: rahul, col: 2, status: B.COMPLETED, date: daysAgo(12), slot: '14:00-16:00', items: [['iron', 30], ['aluminium', 3]], cand: [2], verified: [32, 2.6] },
    { c: ananya, col: 1, status: B.COMPLETED, date: daysAgo(5), slot: '16:00-18:00', items: [['pet-bottles', 6], ['cardboard', 12]], cand: [1], verified: [5.8, 13.1] },
    { c: rahul, col: null, status: B.CANCELLED, date: daysAgo(3), slot: '18:00-20:00', items: [['textiles', 5]], cand: [1] },
  ];

  const rates = Object.fromEntries(Object.entries(rateTable).map(([k, [p]]) => [k, p]));
  const completedBookings = [];
  for (const d of bookingDefs) {
    const home = d.c.addresses[0];
    const bookingId = new mongoose.Types.ObjectId();
    const items = d.items.map(([slug, kg], i) => {
      const verifiedKg = d.verified?.[i];
      return {
        _id: new mongoose.Types.ObjectId(),
        owner: d.c._id, booking: bookingId, category: cat[slug]._id, estimatedWeightKg: kg, ratePerKg: rates[slug], estimatedPrice: Math.round(kg * rates[slug] * 100) / 100,
        ...(verifiedKg != null ? { verifiedWeightKg: verifiedKg, finalRatePerKg: rates[slug], finalPrice: Math.round(verifiedKg * rates[slug] * 100) / 100 } : {}),
      };
    });
    // eslint-disable-next-line no-await-in-loop
    await WasteItem.insertMany(items);
    const collector = d.col != null ? collectorUsers[d.col] : null;
    const history = [{ status: B.PENDING, by: d.c._id, role: 'customer', note: 'Booking created', at: daysAgo(25) }];
    const flow = [B.ACCEPTED, B.ON_THE_WAY, B.ARRIVED, B.WEIGHT_VERIFIED, B.AWAITING_CONFIRMATION, B.COMPLETED];
    if (d.status === B.CANCELLED) history.push({ status: B.CANCELLED, by: d.c._id, role: 'customer', note: 'Plans changed' });
    else if (collector) {
      for (const s of flow) {
        history.push({ status: s, by: s === B.COMPLETED ? d.c._id : collector._id, role: s === B.COMPLETED ? 'customer' : 'collector' });
        if (s === d.status) break;
      }
    }
    const verifiedWeight = d.verified ? Math.round(d.verified.reduce((s, x) => s + x, 0) * 100) / 100 : undefined;
    const finalPrice = d.verified ? Math.round(items.reduce((s, i) => s + (i.finalPrice || 0), 0) * 100) / 100 : undefined;
    // eslint-disable-next-line no-await-in-loop
    const booking = await PickupBooking.create({
      _id: bookingId,
      bookingRef: makeRef('PK'),
      customerId: d.c._id,
      collectorId: collector?._id,
      collectorProfile: d.col != null ? collectorProfiles[d.col]._id : undefined,
      wasteItems: items.map((i) => i._id),
      materialSummary: d.items.map(([slug, kg]) => ({ name: cat[slug].name, slug, estimatedWeightKg: kg })),
      pickupAddress: { line1: home.line1, locality: home.locality, city: home.city, state: home.state, pincode: home.pincode, contactName: d.c.name, contactPhone: d.c.phone, location: home.location },
      preferredDate: d.date,
      preferredTimeSlot: d.slot,
      estimatedWeight: d.items.reduce((s, [, kg]) => s + kg, 0),
      estimatedPrice: Math.round(items.reduce((s, i) => s + i.estimatedPrice, 0) * 100) / 100,
      verifiedWeight,
      finalPrice,
      status: d.status,
      statusHistory: history,
      candidateCollectors: d.cand.map((ci) => ({ collector: collectorUsers[ci]._id, distanceKm: 2 + ci * 1.5, score: 0.8 - ci * 0.1, notifiedAt: daysAgo(1) })),
      paymentStatus: d.status === B.COMPLETED ? 'paid' : 'pending',
      paymentMethod: 'upi',
      cancellationReason: d.status === B.CANCELLED ? 'Plans changed' : undefined,
      completedAt: d.status === B.COMPLETED ? d.date : undefined,
      isDemo: true,
      createdAt: d.status === B.COMPLETED ? daysAgo(25) : undefined,
    });
    if (d.status === B.COMPLETED) completedBookings.push({ booking, items, collectorIdx: d.col });
  }

  // Completed pickups → transactions, receipts, collector stats, rewards, reviews.
  const reviewComments = ['On time and weighed everything in front of me. Fair rates!', 'Polite and quick. Paid instantly over UPI.', 'Very professional, brought a proper digital scale.'];
  for (const [i, { booking, items, collectorIdx }] of completedBookings.entries()) {
    const receiptNumber = makeRef('RCPT');
    // eslint-disable-next-line no-await-in-loop
    const txn = await Transaction.create({
      transactionId: makeRef('TXN'), type: 'scrap_collection', bookingId: booking._id, buyerId: booking.collectorId, sellerId: booking.customerId,
      amount: booking.finalPrice, paymentMethod: 'upi', paymentStatus: 'paid', receiptNumber, isDemo: true,
      lineItems: items.map((it) => ({ name: wasteCats.find((c) => String(c._id) === String(it.category)).name, weightKg: it.verifiedWeightKg, ratePerKg: it.finalRatePerKg, amount: it.finalPrice })),
      createdAt: booking.preferredDate,
    });
    booking.transaction = txn._id;
    booking.receipt = { number: receiptNumber, issuedAt: booking.preferredDate };
    booking.customerRated = true;
    // eslint-disable-next-line no-await-in-loop
    await booking.save();
    const resale = items.reduce((s, it) => {
      const slug = wasteCats.find((c) => String(c._id) === String(it.category)).slug;
      return s + it.verifiedWeightKg * rateTable[slug][1];
    }, 0);
    // eslint-disable-next-line no-await-in-loop
    await Collector.updateOne({ _id: collectorProfiles[collectorIdx]._id }, { $inc: { completedCollections: 1, totalKgCollected: booking.verifiedWeight, totalPaidToCustomers: booking.finalPrice, estimatedMargin: Math.round((resale - booking.finalPrice) * 100) / 100 } });
    const pts = Math.round(booking.verifiedWeight * 2);
    // eslint-disable-next-line no-await-in-loop
    await EcoReward.create({ user: booking.customerId, points: pts, reason: `Recycled ${booking.verifiedWeight} kg (${booking.bookingRef})`, refType: 'booking', refId: booking._id, isDemo: true });
    // eslint-disable-next-line no-await-in-loop
    await User.updateOne({ _id: booking.customerId }, { $inc: { ecoPoints: pts } });
    // eslint-disable-next-line no-await-in-loop
    await Review.create({ reviewer: booking.customerId, reviewee: booking.collectorId, targetType: 'collector', booking: booking._id, rating: 5 - (i % 2), comment: reviewComments[i], isDemo: true });
  }
  for (const p of collectorProfiles) {
    // eslint-disable-next-line no-await-in-loop
    const agg = await Review.aggregate([{ $match: { reviewee: p.userId } }, { $group: { _id: null, a: { $avg: '$rating' }, n: { $sum: 1 } } }]);
    // eslint-disable-next-line no-await-in-loop
    if (agg[0]) await Collector.updateOne({ _id: p._id }, { averageRating: Math.round(agg[0].a * 10) / 10, ratingCount: agg[0].n });
  }

  // ------------------------------------------------------------------ products (15)
  const img = (name) => [{ url: `/demo/${name}.svg`, publicId: 'demo' }];
  const productDefs = [
    { s: priya, t: 'Dell Inspiron 15 Laptop (i5, 8GB, 512GB SSD)', c: 'laptops', b: 'Dell', cond: 'Good', age: 30, op: 58000, sp: 24000, loc: 'indiranagar', im: 'laptop', f: ['Intel Core i5 11th Gen', '8GB RAM', '512GB SSD', 'Original charger'] },
    { s: priya, t: 'Wooden Study Table with Drawer', c: 'furniture', b: 'Urban Ladder', cond: 'Like New', age: 14, op: 12000, sp: 6500, loc: 'indiranagar', im: 'table', f: ['Sheesham wood', '1 drawer', '120 × 60 cm'] },
    { s: priya, t: 'Hero Sprint 26T Gear Cycle', c: 'bicycles', b: 'Hero', cond: 'Good', age: 24, op: 14500, sp: 6000, loc: 'indiranagar', im: 'bicycle', f: ['21-speed Shimano gears', 'Front suspension', 'Disc brakes'] },
    { s: priya, t: 'Engineering Books Bundle (CSE, 12 books)', c: 'books', b: '', cond: 'Good', age: 36, op: 6000, sp: 1500, loc: 'indiranagar', im: 'books', f: ['DSA, OS, DBMS, CN', 'Minimal highlighting'] },
    { s: priya, t: 'Prestige Induction Cooktop', c: 'kitchen', b: 'Prestige', cond: 'Good', age: 20, op: 3200, sp: 1300, loc: 'indiranagar', im: 'kitchen', f: ['2000W', 'Auto shut-off', 'Push-button controls'] },
    { s: rahul, t: 'Samsung Galaxy M32 (6GB/128GB)', c: 'mobile-phones', b: 'Samsung', cond: 'Good', age: 28, op: 16999, sp: 6500, loc: 'koramangala', im: 'phone', f: ['6000 mAh battery', 'AMOLED display', 'Box & charger included'] },
    { s: rahul, t: '3-Seater Fabric Sofa (Grey)', c: 'furniture', b: 'Wakefit', cond: 'Good', age: 32, op: 28000, sp: 11000, loc: 'koramangala', im: 'sofa', f: ['Solid wood frame', 'Removable cushion covers'] },
    { s: rahul, t: 'LG 7kg Front Load Washing Machine', c: 'home-appliances', b: 'LG', cond: 'Good', age: 48, op: 32000, sp: 12500, loc: 'koramangala', im: 'washing-machine', f: ['Inverter direct drive', '6 motion wash', 'Works perfectly'] },
    { s: rahul, t: 'Mi 43" 4K Smart TV', c: 'electronics', b: 'Xiaomi', cond: 'Like New', age: 18, op: 27999, sp: 15500, loc: 'koramangala', im: 'tv', f: ['4K HDR', 'Android TV', 'Wall mount included'] },
    { s: rahul, t: 'Levi\'s Denim Jackets (2 pcs, size M)', c: 'clothing', b: 'Levi\'s', cond: 'Like New', age: 10, op: 7000, sp: 2200, loc: 'koramangala', im: 'clothing', f: ['Size M', 'Worn a few times'] },
    { s: ananya, t: 'Apple iPad 9th Gen (64GB, Wi-Fi)', c: 'electronics', b: 'Apple', cond: 'Like New', age: 16, op: 30900, sp: 19500, loc: 'hsr', im: 'tablet', f: ['10.2" Retina', 'Battery health 92%', 'With case'] },
    { s: ananya, t: 'Office Ergonomic Chair', c: 'furniture', b: 'Green Soul', cond: 'Good', age: 22, op: 14000, sp: 5500, loc: 'hsr', im: 'chair', f: ['Lumbar support', 'Adjustable armrests', 'Mesh back'] },
    { s: ananya, t: 'Philips Air Fryer HD9200', c: 'kitchen', b: 'Philips', cond: 'Good', age: 26, op: 8995, sp: 3800, loc: 'hsr', im: 'kitchen', f: ['4.1 L', 'Rapid Air technology'] },
    { s: ananya, t: 'Kids Bicycle 16" with Training Wheels', c: 'bicycles', b: 'Hero Kids', cond: 'Fair', age: 40, op: 5500, sp: 1500, loc: 'hsr', im: 'bicycle', f: ['Training wheels', 'Basket'] },
    { s: ananya, t: 'Lenovo IdeaPad Slim 3 (Ryzen 5)', c: 'laptops', b: 'Lenovo', cond: 'Like New', age: 12, op: 52000, sp: 34000, loc: 'hsr', im: 'laptop', f: ['Ryzen 5 5500U', '16GB RAM', '512GB SSD', 'Under warranty'] },
  ];
  const describe = (d) => `${d.t} in ${d.cond.toLowerCase()} condition, used for about ${Math.round(d.age / 12 * 10) / 10} years. ${d.f.join('. ')}. Pickup from ${d.loc === 'hsr' ? 'HSR Layout' : d.loc[0].toUpperCase() + d.loc.slice(1)}, Bengaluru. Happy to show it working before you buy.`;
  const products = [];
  for (const d of productDefs) {
    // eslint-disable-next-line no-await-in-loop
    products.push(await Product.create({
      sellerId: d.s._id, title: d.t, description: describe(d), category: d.c, images: img(d.im), brand: d.b || undefined, condition: d.cond,
      ageMonths: d.age, features: d.f, originalPrice: d.op, sellingPrice: d.sp,
      AIRecommendedPrice: { min: Math.round(d.sp * 0.85), max: Math.round(d.sp * 1.12), suggested: d.sp, method: 'depreciation+comparables (seed)' },
      aiRecommendation: { action: 'reuse', reason: 'Working item in usable condition — best value is resale.', confidence: 0.82 },
      location: { type: 'Point', coordinates: LOC[d.loc] }, locationLabel: { locality: d.loc === 'hsr' ? 'HSR Layout' : d.loc[0].toUpperCase() + d.loc.slice(1), city: 'Bengaluru' },
      status: P.AVAILABLE, views: 20 + Math.floor(Math.random() * 180), isDemo: true,
    }));
  }

  // ------------------------------------------------------------------ orders
  const sold = [
    { p: 3, b: arjun, price: 1400, rating: 5, comment: 'Books exactly as described. Smooth handover.' },
    { p: 9, b: meera, price: 2000, rating: 4, comment: 'Good jackets, seller was friendly.' },
    { p: 13, b: kiran, price: 1500, rating: 5, comment: 'My son loves it. Thank you!' },
    { p: 4, b: meera, price: 1250, rating: 4, comment: 'Works fine, slight scratches as mentioned.' },
  ];
  for (const s of sold) {
    const product = products[s.p];
    // eslint-disable-next-line no-await-in-loop
    const order = await Order.create({
      orderRef: makeRef('ORD'), product: product._id, buyer: s.b._id, seller: product.sellerId, offeredPrice: s.price, agreedPrice: s.price,
      status: O.COMPLETED, paymentMethod: 'upi', paymentStatus: 'paid', completedAt: daysAgo(7 + s.p), buyerRated: true, isDemo: true,
      statusHistory: [
        { status: O.REQUESTED, by: s.b._id, role: 'buyer' }, { status: O.ACCEPTED, by: product.sellerId, role: 'seller' }, { status: O.COMPLETED, by: product.sellerId, role: 'seller' },
      ],
    });
    // eslint-disable-next-line no-await-in-loop
    const txn = await Transaction.create({
      transactionId: makeRef('TXN'), type: 'marketplace_sale', orderId: order._id, buyerId: s.b._id, sellerId: product.sellerId, amount: s.price,
      paymentMethod: 'upi', paymentStatus: 'paid', lineItems: [{ name: product.title, amount: s.price }], receiptNumber: makeRef('RCPT'), isDemo: true,
    });
    order.transaction = txn._id;
    // eslint-disable-next-line no-await-in-loop
    await order.save();
    product.status = P.SOLD;
    product.soldAt = daysAgo(7 + s.p);
    // eslint-disable-next-line no-await-in-loop
    await product.save();
    // eslint-disable-next-line no-await-in-loop
    await Review.create({ reviewer: s.b._id, reviewee: product.sellerId, targetType: 'seller', order: order._id, product: product._id, rating: s.rating, comment: s.comment, isDemo: true });
    // eslint-disable-next-line no-await-in-loop
    await EcoReward.insertMany([
      { user: product.sellerId, points: 25, reason: `Gave "${product.title}" a second life`, refType: 'order', refId: order._id, isDemo: true },
      { user: s.b._id, points: 10, reason: `Bought pre-loved "${product.title}"`, refType: 'order', refId: order._id, isDemo: true },
    ]);
    // eslint-disable-next-line no-await-in-loop
    await User.updateOne({ _id: product.sellerId }, { $inc: { ecoPoints: 25 } });
    // eslint-disable-next-line no-await-in-loop
    await User.updateOne({ _id: s.b._id }, { $inc: { ecoPoints: 10 } });
  }
  for (const u of customers) {
    // eslint-disable-next-line no-await-in-loop
    const agg = await Review.aggregate([{ $match: { reviewee: u._id, targetType: 'seller' } }, { $group: { _id: null, a: { $avg: '$rating' }, n: { $sum: 1 } } }]);
    // eslint-disable-next-line no-await-in-loop
    if (agg[0]) await User.updateOne({ _id: u._id }, { sellerRating: { average: Math.round(agg[0].a * 10) / 10, count: agg[0].n } });
  }

  // Accepted (reserved) order and open requests
  const reservedProduct = products[5];
  await Order.create({
    orderRef: makeRef('ORD'), product: reservedProduct._id, buyer: arjun._id, seller: reservedProduct.sellerId, offeredPrice: 6200, agreedPrice: 6300,
    status: O.ACCEPTED, paymentMethod: 'cash', message: 'Can I pick it up on Saturday evening?', isDemo: true,
    statusHistory: [{ status: O.REQUESTED, by: arjun._id, role: 'buyer' }, { status: O.ACCEPTED, by: reservedProduct.sellerId, role: 'seller', note: 'Saturday 6 pm works' }],
  });
  reservedProduct.status = P.RESERVED;
  await reservedProduct.save();
  await Order.create({
    orderRef: makeRef('ORD'), product: products[0]._id, buyer: kiran._id, seller: priya._id, offeredPrice: 22000, message: 'Is the battery backup okay? I can pay via UPI.',
    status: O.REQUESTED, paymentMethod: 'upi', isDemo: true, statusHistory: [{ status: O.REQUESTED, by: kiran._id, role: 'buyer' }],
  });
  await Order.create({
    orderRef: makeRef('ORD'), product: products[10]._id, buyer: meera._id, seller: ananya._id, offeredPrice: 18500, message: 'Would you accept 18.5k?',
    status: O.REQUESTED, paymentMethod: 'cash', isDemo: true, statusHistory: [{ status: O.REQUESTED, by: meera._id, role: 'buyer' }],
  });

  // ------------------------------------------------------------------ favourites, messages, notifications, complaints, AI logs
  await Favourite.insertMany([
    { user: arjun._id, product: products[0]._id }, { user: arjun._id, product: products[14]._id }, { user: meera._id, product: products[10]._id },
    { user: kiran._id, product: products[2]._id }, { user: kiran._id, product: products[8]._id },
  ]);
  for (const [i, n] of [[0, 1], [14, 1], [10, 1], [2, 1], [8, 1]]) {
    // eslint-disable-next-line no-await-in-loop
    await Product.updateOne({ _id: products[i]._id }, { $inc: { favouritesCount: n } });
  }

  const key = (pid, a, b) => `${pid}:${[String(a), String(b)].sort().join(':')}`;
  const k1 = key(products[0]._id, kiran._id, priya._id);
  await Message.insertMany([
    { conversationKey: k1, product: products[0]._id, sender: kiran._id, recipient: priya._id, body: 'Hi! How is the battery backup on the laptop?', readAt: daysAgo(1) },
    { conversationKey: k1, product: products[0]._id, sender: priya._id, recipient: kiran._id, body: 'Around 3–4 hours on normal use. You can check it when you come over.' },
  ]);

  await Notification.insertMany([
    { user: collectorUsers[0]._id, type: 'booking.new_request', title: 'New pickup request nearby', message: 'Newspaper, Cardboard · ~18 kg · 10:00-12:00', link: '/collector/requests', isDemo: true },
    { user: collectorUsers[1]._id, type: 'booking.new_request', title: 'New pickup request nearby', message: 'PET Plastic Bottles, Aluminium · ~6 kg · 14:00-16:00', link: '/collector/requests', isDemo: true },
    { user: ananya._id, type: 'booking.weight_verified', title: 'Please confirm your pickup', message: 'Verified 26.5 kg. Confirm once you have received payment.', link: '/customer/bookings', isDemo: true },
    { user: priya._id, type: 'order.requested', title: 'New purchase request', message: 'Kiran Rao offered ₹22000 for "Dell Inspiron 15 Laptop".', link: '/customer/orders', isDemo: true },
    { user: arjun._id, type: 'order.accepted', title: 'Purchase request accepted', message: '"Samsung Galaxy M32" · Accepted — Saturday 6 pm works', link: '/buyer/orders', isDemo: true },
    { user: admin._id, type: 'collector.pending', title: 'New collector application', message: 'Vijay Scrap Traders is waiting for verification.', link: '/admin/verification', isDemo: true },
  ]);

  await Complaint.create({
    complaintRef: makeRef('CMP'), user: rahul._id, category: 'booking', subject: 'Collector arrived late',
    description: 'My pickup was scheduled for 2–4 pm but the collector came at 5:30 pm without informing me.', status: 'open',
  });

  await AIAnalysis.insertMany([
    { user: priya._id, type: 'classify', provider: 'demo-heuristic', output: { material: 'paper', confidence: 0.58 }, confidence: 0.58, latencyMs: 140, success: true },
    { user: rahul._id, type: 'classify', provider: 'demo-heuristic', output: { material: 'plastic', confidence: 0.52 }, confidence: 0.52, latencyMs: 120, success: true },
    { user: ananya._id, type: 'recommend', provider: 'rules', output: { action: 'reuse' }, confidence: 0.82, latencyMs: 35, success: true },
    { user: ananya._id, type: 'price', provider: 'depreciation-model', output: { suggested: 19500 }, confidence: 0.7, latencyMs: 28, success: true },
    { user: priya._id, type: 'describe', provider: 'template', output: {}, latencyMs: 15, success: true },
    { type: 'chat', provider: 'retrieval', output: {}, confidence: 0.64, latencyMs: 22, success: true },
  ]);

  console.log('\n[seed] done ✔  Demo accounts (local development only):');
  console.table([
    { role: 'admin', email: 'admin@recircle.ai', password: ADMIN_PASSWORD },
    ...customers.map((u) => ({ role: 'customer', email: u.email, password: DEMO_PASSWORD })),
    ...collectorUsers.map((u) => ({ role: 'collector', email: u.email, password: DEMO_PASSWORD })),
    { role: 'collector (pending)', email: vijay.email, password: DEMO_PASSWORD },
    ...buyers.map((u) => ({ role: 'buyer', email: u.email, password: DEMO_PASSWORD })),
  ]);
}

run()
  .catch((err) => { console.error('[seed] failed', err); process.exitCode = 1; })
  .finally(() => disconnectDB());
