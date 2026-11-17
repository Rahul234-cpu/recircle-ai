const { bookingMachine, orderMachine, productMachine } = require('../utils/stateMachines');
const { scoreCollector } = require('../services/matchingService');
const { isValidSignature } = require('../services/paymentService');
const { maskContactInfo, fuzzDistanceKm, stripMongoOperators } = require('../utils/privacy');
const { looksLikeImage } = require('../middleware/upload');
const crypto = require('crypto');

describe('booking state machine', () => {
  test('collector can accept a pending booking, customer cannot', () => {
    expect(bookingMachine.canTransition('Pending', 'Accepted', 'collector')).toBe(true);
    expect(bookingMachine.canTransition('Pending', 'Accepted', 'customer')).toBe(false);
  });
  test('cannot skip from Accepted straight to Completed', () => {
    expect(bookingMachine.canTransition('Accepted', 'Completed', 'collector')).toBe(false);
    expect(bookingMachine.canTransition('Accepted', 'Completed', 'customer')).toBe(false);
  });
  test('only the customer confirms completion', () => {
    expect(bookingMachine.canTransition('Awaiting Customer Confirmation', 'Completed', 'customer')).toBe(true);
    expect(bookingMachine.canTransition('Awaiting Customer Confirmation', 'Completed', 'collector')).toBe(false);
  });
  test('terminal states have no exits', () => {
    ['Completed', 'Cancelled', 'Rejected'].forEach((s) => expect(bookingMachine.isTerminal(s)).toBe(true));
  });
  test('rejected is system-only', () => {
    expect(bookingMachine.canTransition('Pending', 'Rejected', 'collector')).toBe(false);
    expect(bookingMachine.canTransition('Pending', 'Rejected', 'system')).toBe(true);
  });
});

describe('order & product machines', () => {
  test('requested order cannot be completed directly', () => {
    expect(orderMachine.canTransition('Requested', 'Completed', 'seller')).toBe(false);
  });
  test('seller completes an accepted order', () => {
    expect(orderMachine.canTransition('Accepted', 'Completed', 'seller')).toBe(true);
    expect(orderMachine.canTransition('Accepted', 'Completed', 'buyer')).toBe(false);
  });
  test('sold product is terminal', () => {
    expect(productMachine.isTerminal('Sold')).toBe(true);
  });
});

describe('matching score', () => {
  test('closer, better-rated, less-loaded collectors score higher', () => {
    const near = scoreCollector({ distanceKm: 1, radiusKm: 15, rating: 4.8, load: 1, capacity: 6 });
    const far = scoreCollector({ distanceKm: 12, radiusKm: 15, rating: 4.8, load: 1, capacity: 6 });
    const busy = scoreCollector({ distanceKm: 1, radiusKm: 15, rating: 4.8, load: 5, capacity: 6 });
    expect(near).toBeGreaterThan(far);
    expect(near).toBeGreaterThan(busy);
  });
});

describe('payment signature', () => {
  test('accepts a correct HMAC and rejects a forged one', () => {
    const secret = 'shh';
    const sig = crypto.createHmac('sha256', secret).update('order_1|pay_1').digest('hex');
    expect(isValidSignature('order_1', 'pay_1', sig, secret)).toBe(true);
    expect(isValidSignature('order_1', 'pay_2', sig, secret)).toBe(false);
    expect(isValidSignature('order_1', 'pay_1', 'deadbeef', secret)).toBe(false);
  });
});

describe('privacy helpers', () => {
  test('masks phone numbers and emails', () => {
    const out = maskContactInfo('Call me on 98765 43210 or mail a.b@x.com');
    expect(out).not.toMatch(/98765/);
    expect(out).not.toMatch(/a\.b@x\.com/);
  });
  test('fuzzes distance to 0.5 km steps', () => {
    expect(fuzzDistanceKm(2.26)).toBe(2.5);
    expect(fuzzDistanceKm(0.1)).toBe(0.5);
  });
  test('strips mongo operators', () => {
    expect(stripMongoOperators({ email: { $gt: '' }, ok: 1 })).toEqual({ email: {}, ok: 1 });
  });
});

describe('upload magic numbers', () => {
  test('detects png and rejects text', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(looksLikeImage(png)).toBe(true);
    expect(looksLikeImage(Buffer.from('MZ this is not an image'))).toBe(false);
  });
});
