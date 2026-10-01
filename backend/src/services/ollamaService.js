const axios = require('axios');
const { logger } = require('../utils/logger');

const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 750;

const getPositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getOllamaConfig = () => ({
  baseUrl: String(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, ''),
  model: String(process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b').trim(),
  timeoutMs: getPositiveInteger(process.env.OLLAMA_TIMEOUT_MS, 60000),
  retryAttempts: Math.min(getPositiveInteger(process.env.OLLAMA_RETRY_ATTEMPTS, MAX_RETRY_ATTEMPTS), MAX_RETRY_ATTEMPTS),
  retryDelayMs: Number.isInteger(Number(process.env.OLLAMA_RETRY_DELAY_MS)) && Number(process.env.OLLAMA_RETRY_DELAY_MS) >= 0
    ? Number(process.env.OLLAMA_RETRY_DELAY_MS)
    : DEFAULT_RETRY_DELAY_MS
});

const getOllamaError = (error) => {
  const code = error?.code || error?.cause?.code;
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return { kind: 'timeout', retryable: true };
  if (code === 'ECONNREFUSED') return { kind: 'connection_refused', retryable: true };
  if (['ECONNRESET', 'EPIPE', 'EHOSTUNREACH', 'ENETUNREACH'].includes(code)) {
    return { kind: 'connection_error', retryable: true };
  }
  if (error?.response) {
    const status = error.response.status;
    return { kind: 'http_error', retryable: [408, 429, 500, 502, 503, 504].includes(status), status };
  }
  if (error?.request) return { kind: 'connection_error', retryable: true };
  return { kind: 'request_error', retryable: false };
};

const createOllamaError = (kind, status) => {
  const error = new Error(`Ollama ${kind}${status ? ` (HTTP ${status})` : ''}`);
  error.kind = kind;
  if (status) error.status = status;
  return error;
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const askOllama = async (prompt, message) => {
  const { baseUrl, model, timeoutMs, retryAttempts, retryDelayMs } = getOllamaConfig();
  if (!model) throw createOllamaError('model_not_configured');

  for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
    try {
      const response = await axios.post(`${baseUrl}/api/chat`, {
        model,
        stream: false,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: message }
        ],
        options: { temperature: 0.2 }
      }, { timeout: timeoutMs });

      const answer = response.data?.message?.content;
      if (typeof answer !== 'string' || !answer.trim()) {
        throw createOllamaError('invalid_response');
      }
      return answer.trim();
    } catch (error) {
      const failure = error.kind
        ? { kind: error.kind, retryable: false, status: error.status }
        : getOllamaError(error);
      logger.warn(`Ollama request failed (${failure.kind}) on attempt ${attempt}/${retryAttempts}${failure.status ? `; HTTP ${failure.status}` : ''}`);

      if (!failure.retryable || attempt === retryAttempts) {
        throw createOllamaError(failure.kind, failure.status);
      }
      await delay(retryDelayMs);
    }
  }

  throw createOllamaError('request_error');
};

module.exports = { askOllama, getOllamaConfig };