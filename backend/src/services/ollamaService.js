const axios = require('axios');

const getOllamaConfig = () => ({
  baseUrl: String(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, ''),
  model: String(process.env.OLLAMA_MODEL || '').trim(),
  timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS || 15000)
});

const askOllama = async (prompt, message) => {
  const { baseUrl, model, timeoutMs } = getOllamaConfig();
  if (!model) throw new Error('Ollama model is not configured');

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
  if (typeof answer !== 'string' || !answer.trim()) throw new Error('Ollama returned an empty response');
  return answer.trim();
};

module.exports = { askOllama, getOllamaConfig };