const { Expo } = require('expo-server-sdk');
const expo = new Expo();

async function sendExpoPush(toTokens, title, body, data = {}) {
  try {
    const messages = [];
    for (const token of toTokens) {
      if (!Expo.isExpoPushToken(token)) continue;
      messages.push({
        to: token,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high',
      });
    }
    if (messages.length === 0) return { ok: false, reason: 'No valid tokens' };

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    for (const chunk of chunks) {
      const t = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...t);
    }
    return { ok: true, tickets };
  } catch (e) {
    console.error('[sendExpoPush] error:', e);
    return { ok: false, reason: e?.message || 'unknown' };
  }
}

module.exports = { sendExpoPush };