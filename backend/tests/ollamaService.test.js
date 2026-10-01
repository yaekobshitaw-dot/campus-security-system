const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const { askOllama, getOllamaConfig } = require('../src/services/ollamaService');

const originalAxiosPost = axios.post;
const originalEnvironment = {
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
  OLLAMA_MODEL: process.env.OLLAMA_MODEL,
  OLLAMA_TIMEOUT_MS: process.env.OLLAMA_TIMEOUT_MS,
  OLLAMA_RETRY_ATTEMPTS: process.env.OLLAMA_RETRY_ATTEMPTS,
  OLLAMA_RETRY_DELAY_MS: process.env.OLLAMA_RETRY_DELAY_MS
};

test.beforeEach(() => {
  process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434/';
  process.env.OLLAMA_MODEL = 'qwen2.5-coder:3b';
  process.env.OLLAMA_TIMEOUT_MS = '60000';
  process.env.OLLAMA_RETRY_ATTEMPTS = '3';
  process.env.OLLAMA_RETRY_DELAY_MS = '0';
});

test.afterEach(() => {
  axios.post = originalAxiosPost;
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('returns a valid Ollama response with configured URL, model, and timeout', async () => {
  axios.post = async (url, payload, options) => {
    assert.equal(url, 'http://127.0.0.1:11434/api/chat');
    assert.equal(payload.model, 'qwen2.5-coder:3b');
    assert.equal(options.timeout, 60000);
    return { data: { message: { content: 'Incident totals are available.' } } };
  };

  assert.equal(await askOllama('authorized context', 'statistics?'), 'Incident totals are available.');
});

test('classifies timeout failures and retries only the configured bounded number of times', async () => {
  let calls = 0;
  axios.post = async () => {
    calls += 1;
    const error = new Error('timeout');
    error.code = 'ECONNABORTED';
    throw error;
  };

  await assert.rejects(askOllama('prompt', 'message'), (error) => error.kind === 'timeout');
  assert.equal(calls, 3);
});

test('classifies connection refused failures and stops after all retries', async () => {
  let calls = 0;
  axios.post = async () => {
    calls += 1;
    const error = new Error('connection refused');
    error.code = 'ECONNREFUSED';
    throw error;
  };

  await assert.rejects(askOllama('prompt', 'message'), (error) => error.kind === 'connection_refused');
  assert.equal(calls, 3);
});

test('retries a transient Ollama startup failure and returns a later response', async () => {
  let calls = 0;
  axios.post = async () => {
    calls += 1;
    if (calls === 1) {
      const error = new Error('loading');
      error.response = { status: 503 };
      throw error;
    }
    return { data: { message: { content: 'Ollama is ready.' } } };
  };

  assert.equal(await askOllama('prompt', 'message'), 'Ollama is ready.');
  assert.equal(calls, 2);
});

test('does not exceed the hard retry cap when configured attempts are higher', async () => {
  process.env.OLLAMA_RETRY_ATTEMPTS = '20';
  assert.equal(getOllamaConfig().retryAttempts, 3);
});
