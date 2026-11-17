import axios from 'axios';

const baseURL = `${import.meta.env.VITE_API_URL || ''}/api`;
const TOKEN_KEY = 'recircle_token';

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage unavailable */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ } },
};

const api = axios.create({ baseURL, timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && tokenStore.get()) {
      tokenStore.clear();
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(err);
  },
);

/** Human-readable error message from an axios error. */
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const data = err?.response?.data;
  if (data?.details?.length) return `${data.message}: ${data.details.map((d) => d.message).join(', ')}`;
  if (data?.message) return data.message;
  if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (err?.message === 'Network Error') return 'Cannot reach the server. Is the backend running?';
  return fallback;
}

/** Build multipart FormData; arrays/objects are JSON-encoded, files appended as-is. */
export function toFormData(fields = {}, files = {}) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  });
  Object.entries(files).forEach(([k, list]) => {
    (Array.isArray(list) ? list : [list]).filter(Boolean).forEach((f) => fd.append(k, f));
  });
  return fd;
}

const get = (url, params) => api.get(url, { params }).then((r) => r.data);
const post = (url, body) => api.post(url, body).then((r) => r.data);
const put = (url, body) => api.put(url, body).then((r) => r.data);
const patch = (url, body) => api.patch(url, body).then((r) => r.data);
const del = (url) => api.delete(url).then((r) => r.data);

export const AuthAPI = {
  login: (body) => post('/auth/login', body),
  register: (body) => post('/auth/register', body),
  me: () => get('/auth/me'),
  logout: () => post('/auth/logout'),
  changePassword: (body) => post('/auth/change-password', body),
};

export const UserAPI = {
  profile: () => get('/users/profile'),
  updateProfile: (fd) => put('/users/profile', fd),
  addresses: () => get('/users/addresses'),
  addAddress: (body) => post('/users/addresses', body),
  updateAddress: (id, body) => put(`/users/addresses/${id}`, body),
  deleteAddress: (id) => del(`/users/addresses/${id}`),
  impact: () => get('/users/impact'),
};

export const WasteAPI = {
  categories: (params) => get('/waste/categories', params),
  analyze: (fd) => post('/waste/analyze', fd),
  estimate: (body) => post('/waste/estimate', body),
  createBooking: (body) => post('/waste/bookings', body),
  bookings: (params) => get('/waste/bookings', params),
  booking: (id) => get(`/waste/bookings/${id}`),
  updateStatus: (id, body) => patch(`/waste/bookings/${id}/status`, body),
  receipt: (id) => get(`/waste/bookings/${id}/receipt`),
};

export const CollectorAPI = {
  register: (fd) => post('/collectors/register', fd),
  nearby: (params) => get('/collectors/nearby', params),
  me: () => get('/collectors/me'),
  update: (body) => put('/collectors/me', body),
  dashboard: () => get('/collectors/dashboard'),
  earnings: () => get('/collectors/earnings'),
  reviews: (params) => get('/collectors/reviews', params),
  requests: (params) => get('/collectors/requests', params),
  accept: (id) => post(`/collectors/bookings/${id}/accept`),
  reject: (id, reason) => post(`/collectors/bookings/${id}/reject`, { reason }),
  verifyWeight: (id, body) => post(`/collectors/bookings/${id}/verify-weight`, body),
};

export const ProductAPI = {
  list: (params) => get('/products', params),
  get: (id) => get(`/products/${id}`),
  categories: () => get('/products/categories'),
  create: (fd) => post('/products', fd),
  update: (id, fd) => put(`/products/${id}`, fd),
  remove: (id) => del(`/products/${id}`),
  mine: (params) => get('/products/my-listings', params),
  recommended: () => get('/products/recommended'),
  recentlyViewed: () => get('/products/recently-viewed'),
  map: (params) => get('/products/map', params),
};

export const OrderAPI = {
  create: (body) => post('/orders', body),
  list: (params) => get('/orders', params),
  get: (id) => get(`/orders/${id}`),
  updateStatus: (id, body) => patch(`/orders/${id}/status`, body),
  paymentConfig: () => get('/orders/payment-config'),
  pay: (id) => post(`/orders/${id}/pay`),
  verifyPayment: (id, body) => post(`/orders/${id}/verify-payment`, body),
};

export const AiAPI = {
  classify: (fd) => post('/ai/classify', fd),
  recommend: (fd) => post('/ai/recommend', fd),
  price: (body) => post('/ai/price-estimate', body),
  describe: (body) => post('/ai/generate-description', body),
  chat: (body) => post('/ai/chat', body),
  health: () => get('/ai/health'),
};

export const MiscAPI = {
  notifications: (params) => get('/notifications', params),
  readNotification: (id) => patch(`/notifications/${id}/read`),
  readAll: () => patch('/notifications/read-all'),
  conversations: () => get('/messages'),
  thread: (key) => get(`/messages/${encodeURIComponent(key)}`),
  sendMessage: (body) => post('/messages', body),
  favourites: () => get('/favourites'),
  toggleFavourite: (productId) => post(`/favourites/${productId}`),
  review: (body) => post('/reviews', body),
  reviewsFor: (userId, params) => get(`/reviews/user/${userId}`, params),
  complaint: (body) => post('/complaints', body),
  myComplaints: () => get('/complaints'),
  transactions: (params) => get('/transactions', params),
  rewards: () => get('/rewards'),
  impact: () => get('/impact'),
  customerDashboard: () => get('/dashboard/customer'),
  buyerDashboard: () => get('/dashboard/buyer'),
  contact: (body) => post('/contact', body),
};

export const AdminAPI = {
  dashboard: () => get('/admin/dashboard'),
  analytics: () => get('/admin/analytics'),
  aiActivity: (params) => get('/admin/ai-activity', params),
  users: (params) => get('/admin/users', params),
  updateUser: (id, body) => patch(`/admin/users/${id}`, body),
  collectors: (params) => get('/admin/collectors', params),
  verifyCollector: (id, body) => patch(`/admin/collectors/${id}/verify`, body),
  wasteCategories: () => get('/admin/waste-categories'),
  createWasteCategory: (b) => post('/admin/waste-categories', b),
  updateWasteCategory: (id, b) => put(`/admin/waste-categories/${id}`, b),
  deleteWasteCategory: (id) => del(`/admin/waste-categories/${id}`),
  productCategories: () => get('/admin/product-categories'),
  createProductCategory: (b) => post('/admin/product-categories', b),
  updateProductCategory: (id, b) => put(`/admin/product-categories/${id}`, b),
  deleteProductCategory: (id) => del(`/admin/product-categories/${id}`),
  scrapRates: (params) => get('/admin/scrap-rates', params),
  createScrapRate: (b) => post('/admin/scrap-rates', b),
  updateScrapRate: (id, b) => put(`/admin/scrap-rates/${id}`, b),
  deleteScrapRate: (id) => del(`/admin/scrap-rates/${id}`),
  bookings: (params) => get('/admin/bookings', params),
  assignBooking: (id, collectorUserId) => post(`/admin/bookings/${id}/assign`, { collectorUserId }),
  products: (params) => get('/admin/products', params),
  setProductStatus: (id, body) => patch(`/admin/products/${id}/status`, body),
  orders: (params) => get('/admin/orders', params),
  transactions: (params) => get('/admin/transactions', params),
  complaints: (params) => get('/admin/complaints', params),
  updateComplaint: (id, b) => patch(`/admin/complaints/${id}`, b),
  rewards: (params) => get('/admin/rewards', params),
  adjustRewards: (b) => post('/admin/rewards', b),
  settings: () => get('/admin/settings'),
  updateSettings: (b) => put('/admin/settings', b),
};

export default api;
