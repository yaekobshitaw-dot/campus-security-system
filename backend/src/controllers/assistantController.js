const { answerAssistantMessage, MAX_MESSAGE_LENGTH } = require('../services/assistantService');

exports.chat = async (req, res) => {
  const { message } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Message is required' });
  }
  if (message.trim().length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ success: false, message: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` });
  }

  try {
    const result = await answerAssistantMessage(req.user, message);
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    return res.status(200).json({ success: true, message: result.message, source: result.source });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Assistant request failed' });
  }
};