const { PublicContent, ensureDefaultPublicContent } = require('../models/PublicContent');
const { validateContactInformationPayload } = require('../validators/publicContentValidator');
const auditService = require('../services/auditService');
const notificationPersistence = require('../services/notificationPersistence');

const CONTACT_TITLE = 'Contact Us Information';
const contactValues = (item) => ({
  phone: item.phone,
  email: item.email,
  location: item.summary,
});

async function findContactInformation() {
  await ensureDefaultPublicContent();
  return PublicContent.findOne({ where: { type: 'emergency_contact', title: CONTACT_TITLE } });
}

exports.getPublicContactInformation = async (_req, res) => {
  try {
    const item = await findContactInformation();
    if (!item || !item.is_active) return res.status(404).json({ success: false, message: 'Contact information is unavailable.' });
    return res.json({ success: true, data: contactValues(item) });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Unable to load contact information.' });
  }
};

exports.getContactInformation = async (_req, res) => {
  try {
    const item = await findContactInformation();
    if (!item) return res.status(404).json({ success: false, message: 'Contact information is unavailable.' });
    return res.json({ success: true, data: contactValues(item) });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Unable to load contact information.' });
  }
};

exports.updateContactInformation = async (req, res) => {
  let values;
  try {
    values = validateContactInformationPayload(req.body);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }

  try {
    const item = await findContactInformation();
    if (!item) return res.status(404).json({ success: false, message: 'Contact information is unavailable.' });
    await item.update({
      phone: values.phone,
      email: values.email,
      summary: values.location,
      is_active: true,
      updated_by: req.user.user_id,
    });
    await auditService.recordAudit(req, { action: 'content_updated', resourceType: item.type, resourceId: item.content_id });
    await notificationPersistence.notifyUsers(req, {
      type: 'content_changed',
      title: 'Public contact information updated',
      message: 'Contact Us information was updated.',
      resourceType: item.type,
      resourceId: item.content_id,
      link: '/content',
      dedupeKey: `contact-information-updated:${item.updated_at}`,
    });
    return res.json({ success: true, data: contactValues(item) });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Unable to update contact information.' });
  }
};
