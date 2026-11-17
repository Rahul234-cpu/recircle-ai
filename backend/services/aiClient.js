const axios = require('axios');
const env = require('../config/env');
const { AIAnalysis } = require('../models');
const ApiError = require('../utils/ApiError');

const http = axios.create({
  baseURL: env.aiServiceUrl,
  timeout: env.aiTimeoutMs,
  headers: { 'X-Internal-Key': env.aiServiceKey },
});

/** Remove large fields (base64 images) before logging inputs. */
function summarizeInput(input) {
  const copy = { ...input };
  if (copy.image_base64) copy.image_base64 = `[base64 ${Math.round(copy.image_base64.length / 1024)} KB]`;
  if (Array.isArray(copy.images_base64)) copy.images_base64 = `[${copy.images_base64.length} images]`;
  if (Array.isArray(copy.history)) copy.history = `[${copy.history.length} turns]`;
  return copy;
}

async function call(type, path, payload, { userId, imageUrl } = {}) {
  const started = Date.now();
  try {
    const { data } = await http.post(path, payload);
    const log = await AIAnalysis.create({
      user: userId,
      type,
      provider: data.provider,
      input: summarizeInput(payload),
      output: data,
      confidence: data.confidence,
      latencyMs: Date.now() - started,
      success: true,
      imageUrl,
    });
    return { ...data, analysisId: log._id };
  } catch (err) {
    const message = err.response?.data?.detail || err.message;
    const log = await AIAnalysis.create({
      user: userId,
      type,
      input: summarizeInput(payload),
      latencyMs: Date.now() - started,
      success: false,
      error: String(message).slice(0, 500),
      imageUrl,
    }).catch(() => null);
    const apiErr = err.response && err.response.status < 500
      ? ApiError.badRequest(`AI service: ${message}`)
      : ApiError.unavailable('The AI service is not reachable right now. You can still continue by choosing values manually.');
    apiErr.analysisId = log?._id;
    throw apiErr;
  }
}

module.exports = {
  classify: (payload, ctx) => call('classify', '/classify', payload, ctx),
  recommend: (payload, ctx) => call('recommend', '/recommend', payload, ctx),
  priceEstimate: (payload, ctx) => call('price', '/price-estimate', payload, ctx),
  generateDescription: (payload, ctx) => call('describe', '/generate-description', payload, ctx),
  chat: (payload, ctx) => call('chat', '/chat', payload, ctx),
  health: async () => {
    try {
      const { data } = await http.get('/health', { timeout: 3000 });
      return data;
    } catch {
      return { status: 'unreachable' };
    }
  },
};
