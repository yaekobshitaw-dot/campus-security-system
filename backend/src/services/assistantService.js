const { logger } = require('../utils/logger');
const { buildAuthorizedContext } = require('./assistantAuthorization');
const { buildAssistantPrompt } = require('./assistantPrompt');
const { askOllama } = require('./ollamaService');

const MAX_MESSAGE_LENGTH = 2000;
const fallbackMessage = 'The AI assistant is temporarily unavailable. For an emergency, use the campus SOS workflow and contact campus security or your local emergency service.';

const answerAssistantMessage = async (user, message) => {
  const normalizedMessage = typeof message === 'string' ? message.trim() : '';
  if (!normalizedMessage) return { error: 'Message is required' };
  if (normalizedMessage.length > MAX_MESSAGE_LENGTH) return { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` };

  const context = await buildAuthorizedContext(user);
  try {
    const answer = await askOllama(buildAssistantPrompt(context), normalizedMessage);
    return { message: answer, source: 'ollama' };
  } catch (error) {
    logger.warn('Assistant model unavailable; returning safe fallback');
    return { message: fallbackMessage, source: 'fallback' };
  }
};

module.exports = { answerAssistantMessage, MAX_MESSAGE_LENGTH, fallbackMessage };