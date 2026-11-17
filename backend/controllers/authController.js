const { User, Collector } = require('../models');
const { signToken } = require('../middleware/auth');
const ApiError = require('../utils/ApiError');
const { sendEmail } = require('../services/emailService');

async function buildSession(user) {
  const safe = user.toSafeJSON();
  if (user.role === 'collector') {
    const profile = await Collector.findOne({ userId: user._id }).select('verificationStatus businessName isAvailable');
    safe.collectorProfile = profile;
  }
  return safe;
}

exports.register = async (req, res) => {
  const { name, email, phone, password, role } = req.body;
  const exists = await User.exists({ email });
  if (exists) throw ApiError.conflict('An account with this email already exists');
  const user = new User({ name, email, phone, role });
  await user.setPassword(password);
  await user.save();
  sendEmail({ to: email, subject: 'Welcome to ReCircle AI', text: `Hi ${name}, welcome to ReCircle AI! Give waste a value. Give products a second life.` });
  res.status(201).json({ success: true, token: signToken(user), user: await buildSession(user) });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  // Same message for unknown email and wrong password (no account enumeration).
  if (!user || !(await user.comparePassword(password))) throw ApiError.unauthorized('Invalid email or password');
  if (!user.isActive) throw ApiError.forbidden('This account has been disabled. Contact support.');
  user.lastLoginAt = new Date();
  await user.save();
  res.json({ success: true, token: signToken(user), user: await buildSession(user) });
};

exports.me = async (req, res) => {
  res.json({ success: true, user: await buildSession(req.user) });
};

// JWTs are stateless; the client discards its token. Endpoint exists for symmetry/auditing.
exports.logout = async (req, res) => {
  res.json({ success: true, message: 'Logged out' });
};

exports.changePassword = async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await user.comparePassword(req.body.currentPassword))) throw ApiError.badRequest('Current password is incorrect');
  await user.setPassword(req.body.newPassword);
  await user.save();
  res.json({ success: true, message: 'Password updated' });
};

exports.buildSession = buildSession;
