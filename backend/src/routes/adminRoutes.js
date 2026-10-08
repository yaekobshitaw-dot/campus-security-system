const express = require('express');
const { Op } = require('sequelize');
const { authenticate, authorize } = require('../middleware/auth');
const { AuditLog, Notification, User } = require('../models');
const { listSettings, updateSettings } = require('../services/settingsService');
const { recordAudit } = require('../services/auditService');
const { notifyUsers } = require('../services/notificationPersistence');
const { getEmailTransportDiagnostic } = require('../services/emailService');

const router = express.Router();
router.use(authenticate, authorize('admin'));

router.get('/email/diagnostic', async(req, res) => {
    try {
        return res.json({ success: true, data: await getEmailTransportDiagnostic() });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Unable to run SMTP diagnostic' });
    }
});

router.get('/notifications', async(req, res) => {
    try {
        const items = await Notification.findAll({ where: { user_id: req.user.user_id } });
        return res.json({ success: true, data: items });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Unable to load notifications' });
    }
});

router.patch('/notifications/:id/read', async(req, res) => {
    const item = await Notification.findOne({ where: { notification_id: req.params.id, user_id: req.user.user_id } });
    if (!item) return res.status(404).json({ success: false, message: 'Notification not found' });
    await item.update({ is_read: true });
    return res.json({ success: true, data: item });
});

router.patch('/notifications/read-all', async(req, res) => {
    await Notification.update({ is_read: true }, { where: { user_id: req.user.user_id, is_read: false } });
    return res.json({ success: true });
});

router.get('/audit-logs', async(req, res) => {
    try {
        const query = String(req.query.q || '').trim();
        const actorId = String(req.query.actor_id || '').trim();
        const success = String(req.query.success || '').trim().toLowerCase();
        const parsedFrom = req.query.from ? new Date(req.query.from) : null;
        const parsedTo = req.query.to ? new Date(req.query.to) : null;
        if ((req.query.from && Number.isNaN(parsedFrom.getTime())) || (req.query.to && Number.isNaN(parsedTo.getTime()))) {
            return res.status(400).json({ success: false, message: 'Audit date filters must be valid dates' });
        }
        if (success && !['true', 'false', '1', '0'].includes(success)) {
            return res.status(400).json({ success: false, message: 'Audit success filter must be true or false' });
        }
        const where = {
            ...(query ? {
                [Op.or]: [{ action: {
                        [Op.like]: `%${query}%` } }, { resource_type: {
                        [Op.like]: `%${query}%` } }, { details: {
                        [Op.like]: `%${query}%` } }] } : {}),
            ...(actorId ? { actor_id: actorId } : {}),
            ...(req.query.action ? { action: req.query.action } : {}),
            ...(req.query.resource_type ? { resource_type: req.query.resource_type } : {}),
            ...(success ? { success: ['true', '1'].includes(success) } : {}),
            ...(req.query.from || req.query.to ? { created_at: {...(req.query.from ? {
                        [Op.gte]: parsedFrom } : {}), ...(req.query.to ? {
                        [Op.lte]: parsedTo } : {}) } } : {})
        };
        const items = await AuditLog.findAll({ where, limit: 250, order: [
                ['created_at', 'DESC']
            ], include: [{ model: User, as: 'actor', attributes: ['user_id', 'name', 'role'], required: false }] });
        return res.json({ success: true, data: items });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Unable to load audit logs' });
    }
});

router.get('/settings', async(req, res) => {
    try {
        return res.json({ success: true, data: await listSettings() });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Unable to load system settings' });
    }
});

router.put('/settings', async(req, res) => {
    try {
        const data = await updateSettings(req.body?.settings, req.user.user_id);
        const systemStatus = req.body.settings.find((setting) => setting.key === 'system.active');
        if (systemStatus && String(systemStatus.value) === 'false') {
            const sockets = req.app.get('io')?.sockets?.sockets;
            for (const socket of sockets?.values() || []) {
                if (String(socket.user?.role || '').trim().toLowerCase() !== 'admin') socket.disconnect(true);
            }
        }
        await recordAudit(req, { action: 'settings_changed', resourceType: 'system_settings', details: `Updated ${req.body.settings.length} settings.` });
        const settingsKey = req.body.settings.map((setting) => `${setting.key}:${setting.value}`).sort().join('|');
        await notifyUsers(req, { type: 'system_settings_changed', title: 'System settings changed', message: 'An administrator updated system settings.', resourceType: 'system_settings', link: '/settings', dedupeKey: `settings:${settingsKey}` });
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message || 'Unable to save system settings' });
    }
});

module.exports = router;