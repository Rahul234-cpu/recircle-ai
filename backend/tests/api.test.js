jest.mock('../services/aiClient', () => ({
  classify: jest.fn(async () => ({ material: 'paper', confidence: 0.81, predictions: [{ material: 'paper', confidence: 0.81 }], provider: 'mock', analysisId: undefined })),
  recommend: jest.fn(async () => ({ action: 'reuse', reason: 'Works fine', provider: 'mock' })),
  priceEstimate: jest.fn(async () => ({ min: 100, max: 200, suggested: 150, provider: 'mock' })),
  generateDescription: jest.fn(async () => ({ description: 'Nice item', provider: 'mock' })),
  chat: jest.fn(async () => ({ answer: 'Hello', provider: 'mock' })),
  health: jest.fn(async () => ({ status: 'ok' })),
}));

const {
  startDB, stopDB, clearDB, createUser, createCollector, seedWaste, tomorrowISO, api, auth, HOME, PNG_1PX, models,
} = require('./helpers');

beforeAll(startDB);
afterAll(stopDB);
beforeEach(clearDB);

// ------------------------------------------------------------------ auth
describe('auth', () => {
  test('register → login → me', async () => {
    const reg = await api().post('/api/auth/register').send({ name: 'Asha', email: 'asha@test.dev', password: 'Passw0rd1', role: 'customer' });
    expect(reg.status).toBe(201);
    expect(reg.body.user.passwordHash).toBeUndefined();

    const login = await api().post('/api/auth/login').send({ email: 'asha@test.dev', password: 'Passw0rd1' });
    expect(login.status).toBe(200);
    const me = await api().get('/api/auth/me').set(auth(login.body.token));
    expect(me.body.user.email).toBe('asha@test.dev');
  });

  test('rejects weak password, duplicate email and admin self-registration', async () => {
    expect((await api().post('/api/auth/register').send({ name: 'A', email: 'x@test.dev', password: '123' })).status).toBe(400);
    await api().post('/api/auth/register').send({ name: 'Asha', email: 'dup@test.dev', password: 'Passw0rd1' });
    expect((await api().post('/api/auth/register').send({ name: 'Asha', email: 'dup@test.dev', password: 'Passw0rd1' })).status).toBe(409);
    expect((await api().post('/api/auth/register').send({ name: 'Evil', email: 'evil@test.dev', password: 'Passw0rd1', role: 'admin' })).status).toBe(400);
  });

  test('wrong password gives 401', async () => {
    await createUser({ email: 'p@test.dev', password: 'Passw0rd!' });
    expect((await api().post('/api/auth/login').send({ email: 'p@test.dev', password: 'nope1234' })).status).toBe(401);
  });
});

// ------------------------------------------------------------------ RBAC
describe('role-based access', () => {
  test('non-admins cannot reach admin routes', async () => {
    const { token } = await createUser({ role: 'customer' });
    expect((await api().get('/api/admin/dashboard').set(auth(token))).status).toBe(403);
    expect((await api().get('/api/admin/dashboard')).status).toBe(401);
  });
  test('buyers cannot create bookings or listings', async () => {
    const { token } = await createUser({ role: 'buyer' });
    expect((await api().post('/api/waste/bookings').set(auth(token)).send({})).status).toBe(403);
    expect((await api().post('/api/products').set(auth(token))).status).toBe(403);
  });
  test('admin can read dashboard', async () => {
    const { token } = await createUser({ role: 'admin' });
    const res = await api().get('/api/admin/dashboard').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.stats).toBeDefined();
  });
});

// ------------------------------------------------------------------ waste booking workflow
describe('waste collection workflow', () => {
  async function book(customerToken, paper) {
    return api().post('/api/waste/bookings').set(auth(customerToken)).send({
      items: [{ categoryId: String(paper._id), estimatedWeightKg: 10 }],
      pickupAddress: { line1: '12 Main Road', locality: 'Indiranagar', city: 'Bengaluru', pincode: '560038', coordinates: HOME },
      preferredDate: tomorrowISO(),
      preferredTimeSlot: '10:00-12:00',
    });
  }

  test('full lifecycle: create → accept → on the way → arrived → verify → confirm', async () => {
    const { paper } = await seedWaste();
    const { user: customer, token: ct } = await createUser({ role: 'customer' });
    const { token: kt } = await createCollector();

    const created = await book(ct, paper);
    expect(created.status).toBe(201);
    expect(created.body.booking.estimatedPrice).toBe(140);
    expect(created.body.candidatesNotified).toBe(1);
    const id = created.body.booking._id;

    // Before acceptance, the collector cannot see the exact address or phone.
    const reqs = await api().get('/api/collectors/requests').set(auth(kt));
    expect(reqs.body.items).toHaveLength(1);
    expect(reqs.body.items[0].pickupAddress.line1).toBeUndefined();
    expect(reqs.body.items[0].locked).toBe(true);

    expect((await api().post(`/api/collectors/bookings/${id}/accept`).set(auth(kt))).status).toBe(200);
    const after = await api().get(`/api/waste/bookings/${id}`).set(auth(kt));
    expect(after.body.booking.pickupAddress.line1).toBe('12 Main Road');

    // Customer cannot push collector-only states.
    expect((await api().patch(`/api/waste/bookings/${id}/status`).set(auth(ct)).send({ status: 'On The Way' })).status).toBe(409);
    expect((await api().patch(`/api/waste/bookings/${id}/status`).set(auth(kt)).send({ status: 'Completed' })).status).toBe(409);

    expect((await api().patch(`/api/waste/bookings/${id}/status`).set(auth(kt)).send({ status: 'On The Way' })).status).toBe(200);
    expect((await api().patch(`/api/waste/bookings/${id}/status`).set(auth(kt)).send({ status: 'Arrived' })).status).toBe(200);

    const items = await models.WasteItem.find({ booking: id });
    const verify = await api().post(`/api/collectors/bookings/${id}/verify-weight`).set(auth(kt))
      .send({ items: [{ itemId: String(items[0]._id), verifiedWeightKg: 12 }], paymentMethod: 'upi' });
    expect(verify.status).toBe(200);
    expect(verify.body.booking.status).toBe('Awaiting Customer Confirmation');
    expect(verify.body.booking.finalPrice).toBe(168);

    const done = await api().patch(`/api/waste/bookings/${id}/status`).set(auth(ct)).send({ status: 'Completed' });
    expect(done.status).toBe(200);
    expect(done.body.booking.status).toBe('Completed');

    const txn = await models.Transaction.findOne({ bookingId: id });
    expect(txn.amount).toBe(168);
    const fresh = await models.User.findById(customer._id);
    expect(fresh.ecoPoints).toBe(24); // 12 kg × 2 points

    const receipt = await api().get(`/api/waste/bookings/${id}/receipt`).set(auth(ct));
    expect(receipt.body.receipt.totalAmount).toBe(168);

    // Rating once only
    expect((await api().post('/api/reviews').set(auth(ct)).send({ bookingId: id, rating: 5 })).status).toBe(201);
    expect((await api().post('/api/reviews').set(auth(ct)).send({ bookingId: id, rating: 4 })).status).toBe(409);
  });

  test('a second collector cannot accept an already-accepted booking', async () => {
    const { paper } = await seedWaste();
    const { token: ct } = await createUser({ role: 'customer' });
    const a = await createCollector();
    const b = await createCollector({ coords: [77.64, 12.975] });
    const { body } = await book(ct, paper);
    expect(body.candidatesNotified).toBe(2);
    expect((await api().post(`/api/collectors/bookings/${body.booking._id}/accept`).set(auth(a.token))).status).toBe(200);
    expect((await api().post(`/api/collectors/bookings/${body.booking._id}/accept`).set(auth(b.token))).status).toBe(409);
  });

  test('unverified collectors are not matched', async () => {
    const { paper } = await seedWaste();
    const { token: ct } = await createUser({ role: 'customer' });
    await createCollector({ verificationStatus: 'pending' });
    const { body } = await book(ct, paper);
    expect(body.candidatesNotified).toBe(0);
  });

  test('when every candidate rejects, booking becomes Rejected', async () => {
    const { paper } = await seedWaste();
    const { token: ct } = await createUser({ role: 'customer' });
    const k = await createCollector();
    const { body } = await book(ct, paper);
    const res = await api().post(`/api/collectors/bookings/${body.booking._id}/reject`).set(auth(k.token)).send({ reason: 'Too far' });
    expect(res.body.status).toBe('Rejected');
  });

  test('rejects past pickup dates', async () => {
    const { paper } = await seedWaste();
    const { token: ct } = await createUser({ role: 'customer' });
    const res = await api().post('/api/waste/bookings').set(auth(ct)).send({
      items: [{ categoryId: String(paper._id), estimatedWeightKg: 1 }],
      pickupAddress: { line1: '12 Main Road', city: 'Bengaluru', coordinates: HOME },
      preferredDate: '2020-01-01',
      preferredTimeSlot: '10:00-12:00',
    });
    expect(res.status).toBe(400);
  });
});

// ------------------------------------------------------------------ uploads & classification
describe('uploads', () => {
  test('rejects non-image files', async () => {
    const { token } = await createUser({ role: 'customer' });
    const res = await api().post('/api/waste/analyze').set(auth(token)).attach('image', Buffer.from('not an image'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
  });
  test('rejects disallowed mime types', async () => {
    const { token } = await createUser({ role: 'customer' });
    const res = await api().post('/api/waste/analyze').set(auth(token)).attach('image', Buffer.from('GIF89a'), { filename: 'x.gif', contentType: 'image/gif' });
    expect(res.status).toBe(400);
  });
  test('classifies a valid image and maps it to a category with a rate', async () => {
    await seedWaste();
    const { token } = await createUser({ role: 'customer' });
    const res = await api().post('/api/waste/analyze').set(auth(token)).attach('image', PNG_1PX, { filename: 'paper.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.material).toBe('paper');
    expect(res.body.suggestedCategory.ratePerKg).toBe(14);
  });
});

// ------------------------------------------------------------------ marketplace
describe('marketplace', () => {
  async function setupListing() {
    await models.ProductCategory.create({ name: 'Laptops', slug: 'laptops' });
    const seller = await createUser({ role: 'customer' });
    const res = await api().post('/api/products').set(auth(seller.token))
      .field('title', 'Dell Laptop i5')
      .field('description', 'A well maintained laptop with charger and bag included.')
      .field('category', 'laptops')
      .field('condition', 'Good')
      .field('sellingPrice', '20000')
      .field('coordinates', JSON.stringify(HOME))
      .field('city', 'Bengaluru')
      .field('publish', 'true')
      .attach('images', PNG_1PX, { filename: 'a.png', contentType: 'image/png' });
    return { seller, res };
  }

  test('create, edit and ownership checks', async () => {
    const { seller, res } = await setupListing();
    expect(res.status).toBe(201);
    expect(res.body.product.status).toBe('Available');
    const id = res.body.product._id;

    const other = await createUser({ role: 'customer' });
    expect((await api().put(`/api/products/${id}`).set(auth(other.token)).field('sellingPrice', '1')).status).toBe(403);
    const edit = await api().put(`/api/products/${id}`).set(auth(seller.token)).field('sellingPrice', '18000');
    expect(edit.status).toBe(200);
    expect(edit.body.product.sellingPrice).toBe(18000);
    expect(edit.body.product.status).toBe('Available'); // editing must not unpublish

    const list = await api().get('/api/products?q=dell');
    expect(list.body.items).toHaveLength(1);
  });

  test('order lifecycle: request → accept (reserved) → complete (sold)', async () => {
    const { seller, res } = await setupListing();
    const pid = res.body.product._id;
    const buyer = await createUser({ role: 'buyer' });
    const buyer2 = await createUser({ role: 'buyer' });

    expect((await api().post('/api/orders').set(auth(seller.token)).send({ productId: pid })).status).toBe(400); // own listing
    const o1 = await api().post('/api/orders').set(auth(buyer.token)).send({ productId: pid, offeredPrice: 19000 });
    expect(o1.status).toBe(201);
    expect(o1.body.order.status).toBe('Requested');
    const o2 = await api().post('/api/orders').set(auth(buyer2.token)).send({ productId: pid });

    // A request alone never completes the order.
    expect((await api().patch(`/api/orders/${o1.body.order._id}/status`).set(auth(seller.token)).send({ status: 'Completed' })).status).toBe(409);
    // Buyer cannot accept their own request.
    expect((await api().patch(`/api/orders/${o1.body.order._id}/status`).set(auth(buyer.token)).send({ status: 'Accepted' })).status).toBe(409);

    expect((await api().patch(`/api/orders/${o1.body.order._id}/status`).set(auth(seller.token)).send({ status: 'Accepted' })).status).toBe(200);
    expect((await models.Product.findById(pid)).status).toBe('Reserved');
    // Second request cannot be accepted while reserved.
    expect((await api().patch(`/api/orders/${o2.body.order._id}/status`).set(auth(seller.token)).send({ status: 'Accepted' })).status).toBe(409);

    const done = await api().patch(`/api/orders/${o1.body.order._id}/status`).set(auth(seller.token)).send({ status: 'Completed' });
    expect(done.status).toBe(200);
    expect((await models.Product.findById(pid)).status).toBe('Sold');
    expect((await models.Order.findById(o2.body.order._id)).status).toBe('Rejected');
    expect(await models.Transaction.countDocuments({ orderId: o1.body.order._id })).toBe(1);

    expect((await api().post('/api/reviews').set(auth(buyer.token)).send({ orderId: o1.body.order._id, rating: 5 })).status).toBe(201);
  });
});

// ------------------------------------------------------------------ admin
describe('admin', () => {
  test('verifies a collector and manages scrap rates with versioning', async () => {
    const { token } = await createUser({ role: 'admin' });
    const { profile } = await createCollector({ verificationStatus: 'pending' });
    const v = await api().patch(`/api/admin/collectors/${profile._id}/verify`).set(auth(token)).send({ decision: 'approved' });
    expect(v.body.collector.verificationStatus).toBe('approved');

    const { paper } = await seedWaste();
    const rates = await api().get('/api/admin/scrap-rates').set(auth(token));
    const paperRate = rates.body.items.find((r) => String(r.category._id) === String(paper._id));
    const upd = await api().put(`/api/admin/scrap-rates/${paperRate._id}`).set(auth(token)).send({ pricePerKg: 16 });
    expect(upd.body.item.pricePerKg).toBe(16);
    expect(await models.ScrapRate.countDocuments({ category: paper._id })).toBe(2); // old version kept
    expect(await models.ScrapRate.countDocuments({ category: paper._id, isActive: true })).toBe(1);
  });

  test('unknown routes and bad ids return clean JSON errors', async () => {
    const nf = await api().get('/api/nope');
    expect(nf.status).toBe(404);
    expect(nf.body.success).toBe(false);
    const { token } = await createUser();
    expect((await api().get('/api/waste/bookings/not-an-id').set(auth(token))).status).toBe(400);
  });
});
