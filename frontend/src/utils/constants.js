export const TIME_SLOTS = ['08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00', '18:00-20:00'];
export const WEEKDAYS = [
  ['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun'],
];
export const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Needs Repair'];

// Default map centre: Bengaluru (demo data city)
export const DEFAULT_CENTER = [12.9716, 77.5946];

export const STATUS_STYLES = {
  // bookings
  Pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  Accepted: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  'Collector Assigned': 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  'On The Way': 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  Arrived: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  'Weight Verified': 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
  'Awaiting Customer Confirmation': 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  Completed: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
  Rejected: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  Cancelled: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
  // products
  Draft: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
  'Pending Approval': 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  Available: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
  Reserved: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  Sold: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  Removed: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  // orders
  Requested: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  // generic
  approved: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  rejected: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  open: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  in_progress: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  resolved: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
  closed: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
  paid: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
};

export const BOOKING_FLOW = ['Pending', 'Accepted', 'On The Way', 'Arrived', 'Weight Verified', 'Awaiting Customer Confirmation', 'Completed'];
export const ORDER_FLOW = ['Requested', 'Accepted', 'Completed'];

export const ACTION_META = {
  reuse: { label: 'Reuse', tone: 'bg-brand-50 text-brand-800 ring-brand-200', cta: 'List it on the marketplace' },
  repair: { label: 'Repair', tone: 'bg-sky-50 text-sky-800 ring-sky-200', cta: 'Repair first, then list it' },
  donate: { label: 'Donate', tone: 'bg-violet-50 text-violet-800 ring-violet-200', cta: 'Donate to someone who needs it' },
  recycle: { label: 'Recycle', tone: 'bg-amber-50 text-amber-800 ring-amber-200', cta: 'Book a kabadiwala pickup' },
};

export const ROLE_HOME = { customer: '/customer', collector: '/collector', buyer: '/buyer', admin: '/admin' };
