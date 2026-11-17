const express = require('express');
const a = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { protect, optionalAuth, authorize } = require('../middleware/auth');
const { authLimiter, aiLimiter } = require('../middleware/rateLimit');
const { uploadImages, uploadSingle } = require('../middleware/upload');
const v = require('../validators');
const { z } = require('zod');

const auth = require('../controllers/authController');
const users = require('../controllers/userController');
const waste = require('../controllers/wasteController');
const collectors = require('../controllers/collectorController');
const products = require('../controllers/productController');
const orders = require('../controllers/orderController');
const aiCtl = require('../controllers/aiController');
const misc = require('../controllers/miscController');
const admin = require('../controllers/adminController');

const router = express.Router();
const id = validate({ params: v.idParam });
const CUSTOMER = 'customer';
const COLLECTOR = 'collector';
const BUYER = 'buyer';
const ADMIN = 'admin';

// ------------------------------------------------------------ auth
router.post('/auth/register', authLimiter, validate({ body: v.auth.register }), a(auth.register));
router.post('/auth/login', authLimiter, validate({ body: v.auth.login }), a(auth.login));
router.get('/auth/me', protect, a(auth.me));
router.post('/auth/logout', protect, a(auth.logout));
router.post('/auth/change-password', protect, validate({ body: v.auth.changePassword }), a(auth.changePassword));

// ------------------------------------------------------------ users
router.get('/users/profile', protect, a(users.getProfile));
router.put('/users/profile', protect, uploadSingle('profileImage'), validate({ body: v.user.updateProfile }), a(users.updateProfile));
router.get('/users/addresses', protect, a(users.listAddresses));
router.post('/users/addresses', protect, validate({ body: v.user.address }), a(users.addAddress));
router.put('/users/addresses/:addressId', protect, validate({ body: v.user.address }), a(users.updateAddress));
router.delete('/users/addresses/:addressId', protect, a(users.deleteAddress));
router.get('/users/impact', protect, a(users.impact));
router.get('/users/:id/public', id, a(users.publicProfile));

// ------------------------------------------------------------ waste & bookings
router.get('/waste/categories', a(waste.categories));
router.post('/waste/analyze', protect, authorize(CUSTOMER), aiLimiter, uploadSingle('image'), validate({ body: v.waste.analyze }), a(waste.analyze));
router.post('/waste/estimate', protect, validate({ body: v.waste.estimate }), a(waste.estimate));
router.post('/waste/bookings', protect, authorize(CUSTOMER), validate({ body: v.waste.createBooking }), a(waste.createBooking));
router.get('/waste/bookings', protect, authorize(CUSTOMER, COLLECTOR, ADMIN), validate({ query: v.waste.listQuery }), a(waste.listBookings));
router.get('/waste/bookings/:id', protect, id, a(waste.getBooking));
router.patch('/waste/bookings/:id/status', protect, id, validate({ body: v.waste.status }), a(waste.updateStatus));
router.get('/waste/bookings/:id/receipt', protect, id, a(waste.receipt));

// ------------------------------------------------------------ collectors
router.post('/collectors/register', authLimiter, uploadSingle('idProofImage'), validate({ body: v.collector.register }), a(collectors.register));
router.get('/collectors/nearby', protect, validate({ query: v.collector.nearbyQuery }), a(collectors.nearby));
router.get('/collectors/me', protect, authorize(COLLECTOR), a(collectors.getProfile));
router.put('/collectors/me', protect, authorize(COLLECTOR), validate({ body: v.collector.update }), a(collectors.updateProfile));
router.get('/collectors/dashboard', protect, authorize(COLLECTOR), a(collectors.dashboard));
router.get('/collectors/earnings', protect, authorize(COLLECTOR), a(collectors.earnings));
router.get('/collectors/reviews', protect, authorize(COLLECTOR), a(collectors.reviews));
router.get('/collectors/requests', protect, authorize(COLLECTOR), a(collectors.requests));
router.post('/collectors/bookings/:id/accept', protect, authorize(COLLECTOR), id, a(collectors.accept));
router.post('/collectors/bookings/:id/reject', protect, authorize(COLLECTOR), id, validate({ body: v.collector.reject }), a(collectors.reject));
router.post('/collectors/bookings/:id/verify-weight', protect, authorize(COLLECTOR), id, validate({ body: v.collector.verifyWeight }), a(collectors.verifyWeight));

// ------------------------------------------------------------ marketplace
router.get('/products/categories', a(products.categories));
router.get('/products/my-listings', protect, authorize(CUSTOMER), a(products.myListings));
router.get('/products/recommended', protect, a(products.recommended));
router.get('/products/recently-viewed', protect, a(products.recentlyViewed));
router.get('/products/map', a(products.mapPoints));
router.get('/products', validate({ query: v.product.listQuery }), a(products.list));
router.get('/products/:id', id, optionalAuth, a(products.get));
router.post('/products', protect, authorize(CUSTOMER), uploadImages('images', 6), validate({ body: v.product.create }), a(products.create));
router.put('/products/:id', protect, authorize(CUSTOMER), id, uploadImages('images', 6), validate({ body: v.product.create.partial() }), a(products.update));
router.delete('/products/:id', protect, authorize(CUSTOMER, ADMIN), id, a(products.remove));

// ------------------------------------------------------------ orders & payments
router.post('/orders', protect, authorize(CUSTOMER, BUYER), validate({ body: v.order.create }), a(orders.create));
router.get('/orders', protect, validate({ query: v.order.listQuery }), a(orders.list));
router.get('/orders/payment-config', protect, a(orders.paymentConfig));
router.get('/orders/:id', protect, id, a(orders.get));
router.patch('/orders/:id/status', protect, id, validate({ body: v.order.status }), a(orders.updateStatus));
router.post('/orders/:id/pay', protect, id, a(orders.createPayment));
router.post('/orders/:id/verify-payment', protect, id, validate({ body: v.order.verifyPayment }), a(orders.verifyPayment));

// ------------------------------------------------------------ AI
router.get('/ai/health', a(aiCtl.health));
router.post('/ai/classify', protect, authorize(CUSTOMER), aiLimiter, uploadSingle('image'), validate({ body: v.waste.analyze }), a(aiCtl.classify));
router.post('/ai/recommend', protect, aiLimiter, uploadSingle('image'), validate({ body: v.ai.recommend }), a(aiCtl.recommend));
router.post('/ai/price-estimate', protect, aiLimiter, validate({ body: v.ai.price }), a(aiCtl.priceEstimate));
router.post('/ai/generate-description', protect, aiLimiter, validate({ body: v.ai.describe }), a(aiCtl.generateDescription));
router.post('/ai/chat', optionalAuth, aiLimiter, validate({ body: v.ai.chat }), a(aiCtl.chat));

// ------------------------------------------------------------ misc
router.get('/notifications', protect, a(misc.listNotifications));
router.patch('/notifications/read-all', protect, a(misc.markAllRead));
router.patch('/notifications/:id/read', protect, id, a(misc.markNotificationRead));
router.get('/messages', protect, a(misc.conversations));
router.get('/messages/:key', protect, a(misc.thread));
router.post('/messages', protect, validate({ body: v.misc.message }), a(misc.sendMessage));
router.get('/favourites', protect, a(misc.listFavourites));
router.post('/favourites/:productId', protect, validate({ params: z.object({ productId: v.objectId }) }), a(misc.toggleFavourite));
router.post('/reviews', protect, validate({ body: v.misc.review }), a(misc.createReview));
router.get('/reviews/user/:userId', validate({ params: z.object({ userId: v.objectId }) }), a(misc.reviewsForUser));
router.post('/complaints', protect, validate({ body: v.misc.complaint }), a(misc.createComplaint));
router.get('/complaints', protect, a(misc.myComplaints));
router.get('/transactions', protect, a(misc.myTransactions));
router.get('/rewards', protect, a(misc.myRewards));
router.get('/impact', a(misc.platformImpact));
router.get('/dashboard/customer', protect, authorize(CUSTOMER), a(misc.customerDashboard));
router.get('/dashboard/buyer', protect, authorize(BUYER, CUSTOMER), a(misc.buyerDashboard));
router.post('/contact', authLimiter, validate({ body: v.misc.contact }), a(misc.contact));

// ------------------------------------------------------------ admin
const adminRouter = express.Router();
adminRouter.use(protect, authorize(ADMIN));
const lq = validate({ query: v.admin.listQuery });
adminRouter.get('/dashboard', a(admin.dashboard));
adminRouter.get('/analytics', a(admin.analytics));
adminRouter.get('/ai-activity', lq, a(admin.aiActivity));
adminRouter.get('/users', lq, a(admin.listUsers));
adminRouter.patch('/users/:id', id, validate({ body: v.admin.userUpdate }), a(admin.updateUser));
adminRouter.get('/collectors', lq, a(admin.listCollectors));
adminRouter.patch('/collectors/:id/verify', id, validate({ body: v.admin.verifyCollector }), a(admin.verifyCollector));
adminRouter.get('/waste-categories', a(admin.listWasteCategories));
adminRouter.post('/waste-categories', validate({ body: v.admin.wasteCategory }), a(admin.createWasteCategory));
adminRouter.put('/waste-categories/:id', id, validate({ body: v.admin.wasteCategory }), a(admin.updateWasteCategory));
adminRouter.delete('/waste-categories/:id', id, a(admin.deleteWasteCategory));
adminRouter.get('/product-categories', a(admin.listProductCategories));
adminRouter.post('/product-categories', validate({ body: v.admin.productCategory }), a(admin.createProductCategory));
adminRouter.put('/product-categories/:id', id, validate({ body: v.admin.productCategory }), a(admin.updateProductCategory));
adminRouter.delete('/product-categories/:id', id, a(admin.deleteProductCategory));
adminRouter.get('/scrap-rates', a(admin.listScrapRates));
adminRouter.post('/scrap-rates', validate({ body: v.admin.scrapRate }), a(admin.createScrapRate));
adminRouter.put('/scrap-rates/:id', id, validate({ body: v.admin.scrapRateUpdate }), a(admin.updateScrapRate));
adminRouter.delete('/scrap-rates/:id', id, a(admin.deleteScrapRate));
adminRouter.get('/bookings', lq, a(admin.listBookings));
adminRouter.post('/bookings/:id/assign', id, validate({ body: v.admin.assign }), a(admin.assignBooking));
adminRouter.get('/products', lq, a(admin.listProducts));
adminRouter.patch('/products/:id/status', id, validate({ body: v.product.status }), a(admin.setProductStatus));
adminRouter.get('/orders', lq, a(admin.listOrders));
adminRouter.get('/transactions', lq, a(admin.listTransactions));
adminRouter.get('/complaints', lq, a(admin.listComplaints));
adminRouter.patch('/complaints/:id', id, validate({ body: v.admin.complaint }), a(admin.updateComplaint));
adminRouter.get('/rewards', a(admin.listRewards));
adminRouter.post('/rewards', validate({ body: v.admin.reward }), a(admin.adjustRewards));
adminRouter.get('/settings', a(admin.getSettings));
adminRouter.put('/settings', validate({ body: v.admin.settings }), a(admin.updateSettings));
router.use('/admin', adminRouter);

module.exports = router;
