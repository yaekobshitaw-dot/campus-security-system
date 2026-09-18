const express = require('express');
const { Op } = require('sequelize');
const { authenticate, authorize } = require('../middleware/auth');
const { PublicContent, CONTENT_TYPES } = require('../models/PublicContent');
const { validatePublicContentPayload } = require('../validators/publicContentValidator');
const { recordAudit } = require('../services/auditService');
const { notifyUsers } = require('../services/notificationPersistence');

const router = express.Router();
const sendError = (res, error, fallback) => res.status(error.statusCode || 400).json({ success: false, message: error.message || fallback });

router.get('/public-content', async (req, res) => {
  try {
    const type = req.query.type ? String(req.query.type) : null;
    if (type && !CONTENT_TYPES.includes(type)) return res.status(400).json({ success: false, message: 'Invalid content type.' });
    const where = { is_active: true, ...(type ? { type } : {}) };
    const items = await PublicContent.findAll({ where, order: [['type', 'ASC'], ['priority', 'DESC'], ['created_at', 'DESC']] });
    return res.json({ success: true, data: items });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load public content.' });
  }
});

router.use(authenticate, authorize('admin'));

router.get('/content', async (req, res) => {
  try {
    const type = req.query.type ? String(req.query.type) : null;
    const query = String(req.query.q || '').trim();
    if (type && !CONTENT_TYPES.includes(type)) return res.status(400).json({ success: false, message: 'Invalid content type.' });
    const where = {
      ...(type ? { type } : {}),
      ...(query ? { [Op.or]: [{ title: { [Op.like]: `%${query}%` } }, { summary: { [Op.like]: `%${query}%` } }, { body: { [Op.like]: `%${query}%` } }] } : {})
    };
    return res.json({ success: true, data: await PublicContent.findAll({ where, order: [['type', 'ASC'], ['priority', 'DESC'], ['created_at', 'DESC']] }) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load content.' });
  }
});

router.post('/content', async (req, res) => {
  try {
    const values = validatePublicContentPayload(req.body);
    const item = await PublicContent.create({ ...values, created_by: req.user.user_id, updated_by: req.user.user_id });
    await recordAudit(req, { action: 'content_created', resourceType: item.type, resourceId: item.content_id });
    await notifyUsers(req, { type: 'content_changed', title: 'Public content updated', message: `${item.title} was created.`, resourceType: item.type, resourceId: item.content_id, link: '/content', dedupeKey: `content-created:${item.content_id}` });
    return res.status(201).json({ success: true, data: item });
  } catch (error) {
    return sendError(res, error, 'Unable to create content.');
  }
});

router.patch('/content/:id', async (req, res) => {
  try {
    const item = await PublicContent.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Content item not found.' });
    const values = validatePublicContentPayload({ ...req.body, content_id: req.params.id }, { partial: true });
    await item.update({ ...values, updated_by: req.user.user_id });
    await recordAudit(req, { action: 'content_updated', resourceType: item.type, resourceId: item.content_id });
    await notifyUsers(req, { type: 'content_changed', title: 'Public content updated', message: `${item.title} was updated.`, resourceType: item.type, resourceId: item.content_id, link: '/content', dedupeKey: `content-updated:${item.content_id}:${item.updated_at}` });
    return res.json({ success: true, data: item });
  } catch (error) {
    return sendError(res, error, 'Unable to update content.');
  }
});

router.delete('/content/:id', async (req, res) => {
  try {
    const item = await PublicContent.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Content item not found.' });
    await item.update({ is_active: false, updated_by: req.user.user_id });
    await recordAudit(req, { action: 'content_deactivated', resourceType: item.type, resourceId: item.content_id });
    await notifyUsers(req, { type: 'content_changed', title: 'Public content deactivated', message: `${item.title} is no longer public.`, resourceType: item.type, resourceId: item.content_id, link: '/content', dedupeKey: `content-deactivated:${item.content_id}:${item.updated_at}` });
    return res.json({ success: true, data: item });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to deactivate content.' });
  }
});

module.exports = router;
