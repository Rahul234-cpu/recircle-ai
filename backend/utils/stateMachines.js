/**
 * Single source of truth for allowed status changes.
 * Each entry: from -> { to: [roles allowed to perform it] }.
 * 'system' means only the server itself can apply it (never via a user request).
 */
const { BOOKING_STATUS: B, ORDER_STATUS: O, PRODUCT_STATUS: P } = require('../config/constants');

const BOOKING_TRANSITIONS = {
  [B.PENDING]: {
    [B.ACCEPTED]: ['collector'],
    [B.COLLECTOR_ASSIGNED]: ['admin'],
    [B.REJECTED]: ['system'],
    [B.CANCELLED]: ['customer', 'admin'],
  },
  [B.ACCEPTED]: {
    [B.ON_THE_WAY]: ['collector'],
    [B.CANCELLED]: ['customer', 'collector', 'admin'],
  },
  [B.COLLECTOR_ASSIGNED]: {
    [B.ON_THE_WAY]: ['collector'],
    [B.CANCELLED]: ['customer', 'collector', 'admin'],
  },
  [B.ON_THE_WAY]: {
    [B.ARRIVED]: ['collector'],
    [B.CANCELLED]: ['admin'],
  },
  [B.ARRIVED]: {
    [B.WEIGHT_VERIFIED]: ['collector'],
    [B.CANCELLED]: ['admin'],
  },
  [B.WEIGHT_VERIFIED]: {
    [B.AWAITING_CONFIRMATION]: ['collector', 'system'],
  },
  [B.AWAITING_CONFIRMATION]: {
    [B.COMPLETED]: ['customer'],
    [B.ARRIVED]: ['customer'], // dispute: collector must re-verify
    [B.CANCELLED]: ['admin'],
  },
  [B.REJECTED]: {},
  [B.COMPLETED]: {},
  [B.CANCELLED]: {},
};

const ORDER_TRANSITIONS = {
  [O.REQUESTED]: {
    [O.ACCEPTED]: ['seller'],
    [O.REJECTED]: ['seller', 'system'],
    [O.CANCELLED]: ['buyer', 'admin'],
  },
  [O.ACCEPTED]: {
    [O.COMPLETED]: ['seller'],
    [O.CANCELLED]: ['buyer', 'seller', 'admin'],
  },
  [O.REJECTED]: {},
  [O.COMPLETED]: {},
  [O.CANCELLED]: {},
};

const PRODUCT_TRANSITIONS = {
  [P.DRAFT]: { [P.PENDING_APPROVAL]: ['seller', 'system'], [P.AVAILABLE]: ['seller', 'system'], [P.REMOVED]: ['seller', 'admin'] },
  [P.PENDING_APPROVAL]: { [P.AVAILABLE]: ['admin'], [P.REJECTED]: ['admin'], [P.REMOVED]: ['seller', 'admin'], [P.DRAFT]: ['seller'] },
  [P.AVAILABLE]: { [P.RESERVED]: ['system'], [P.REMOVED]: ['seller', 'admin'], [P.DRAFT]: ['seller'], [P.SOLD]: ['system'] },
  [P.RESERVED]: { [P.AVAILABLE]: ['system'], [P.SOLD]: ['system'], [P.REMOVED]: ['admin'] },
  [P.REJECTED]: { [P.DRAFT]: ['seller'], [P.REMOVED]: ['seller', 'admin'] },
  [P.SOLD]: {},
  [P.REMOVED]: { [P.AVAILABLE]: ['admin'] },
};

function makeMachine(table) {
  return {
    allowedNext(from, actor) {
      const row = table[from] || {};
      return Object.entries(row).filter(([, actors]) => actors.includes(actor)).map(([to]) => to);
    },
    canTransition(from, to, actor) {
      const actors = (table[from] || {})[to];
      return Array.isArray(actors) && actors.includes(actor);
    },
    isTerminal(status) {
      return Object.keys(table[status] || {}).length === 0;
    },
  };
}

module.exports = {
  bookingMachine: makeMachine(BOOKING_TRANSITIONS),
  orderMachine: makeMachine(ORDER_TRANSITIONS),
  productMachine: makeMachine(PRODUCT_TRANSITIONS),
  BOOKING_TRANSITIONS,
  ORDER_TRANSITIONS,
  PRODUCT_TRANSITIONS,
};
