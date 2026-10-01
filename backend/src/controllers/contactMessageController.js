const { v4: uuidv4 } = require('uuid');
const { Notification, User } = require('../models');
const { validateContactMessagePayload } = require('../validators/publicContentValidator');

exports.submit = async (req, res) => {
  let contactMessage;
  try {
    contactMessage = validateContactMessagePayload(req.body);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }

  try {
    const admins = await User.findAll({
      where: { role: 'admin', is_active: true },
      attributes: ['user_id'],
    });
    if (!admins.length) {
      return res.status(503).json({ success: false, message: 'Contact messages are temporarily unavailable.' });
    }

    const submissionId = uuidv4();
    await Notification.bulkCreate(admins.map((admin) => ({
      user_id: admin.user_id,
      type: 'contact_message',
      title: 'New Contact Us message',
      message: `${contactMessage.name} submitted a Contact Us message.`,
      resource_type: 'contact_message',
      resource_id: submissionId,
      link: '/notifications',
      dedupe_key: `contact-message:${submissionId}:${admin.user_id}`,
      data: contactMessage,
    })));

    return res.status(201).json({ success: true, message: 'Contact message submitted successfully.' });
  } catch (error) {
    console.error('Unable to save Contact Us message:', error?.message || error);
    return res.status(500).json({ success: false, message: 'Unable to submit your message. Please try again.' });
  }
};
