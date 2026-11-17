const ROLES = Object.freeze({
  CUSTOMER: 'customer',
  COLLECTOR: 'collector',
  BUYER: 'buyer',
  ADMIN: 'admin',
});

const BOOKING_STATUS = Object.freeze({
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  COLLECTOR_ASSIGNED: 'Collector Assigned',
  ON_THE_WAY: 'On The Way',
  ARRIVED: 'Arrived',
  WEIGHT_VERIFIED: 'Weight Verified',
  AWAITING_CONFIRMATION: 'Awaiting Customer Confirmation',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
});

const PRODUCT_STATUS = Object.freeze({
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  AVAILABLE: 'Available',
  RESERVED: 'Reserved',
  SOLD: 'Sold',
  REJECTED: 'Rejected',
  REMOVED: 'Removed',
});

const ORDER_STATUS = Object.freeze({
  REQUESTED: 'Requested',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
});

const PRODUCT_CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Needs Repair'];

const TIME_SLOTS = ['08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00', '18:00-20:00'];

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const MATERIAL_TYPES = ['paper', 'cardboard', 'plastic', 'metal', 'glass', 'e-waste', 'textile', 'mixed'];

// Default platform settings; admin can override them (PlatformSetting collection).
const DEFAULT_SETTINGS = Object.freeze({
  listingRequiresApproval: false,
  matchingRadiusKm: 15,
  maxCandidateCollectors: 5,
  rewardPointsPerKg: 2,
  rewardPointsPerProductSale: 25,
  rewardPointsPerProductPurchase: 10,
});

module.exports = {
  ROLES,
  BOOKING_STATUS,
  PRODUCT_STATUS,
  ORDER_STATUS,
  PRODUCT_CONDITIONS,
  TIME_SLOTS,
  WEEKDAYS,
  MATERIAL_TYPES,
  DEFAULT_SETTINGS,
};
