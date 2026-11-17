const { Notification } = require('../models');
const { emitToUser } = require('../sockets');

/**
 * Persist a notification and push it in real time.
 * Persisting first means offline users still see it on next login.
 */
async function notify(userId, { type, title, message, link, data }) {
  if (!userId) return null;
  const doc = await Notification.create({ user: userId, type, title, message, link, data });
  emitToUser(String(userId), 'notification', doc.toObject());
  return doc;
}

async function notifyMany(userIds, payload) {
  return Promise.all(userIds.map((id) => notify(id, payload)));
}

module.exports = { notify, notifyMany };
