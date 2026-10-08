const express = require('express');
const { Op } = require('sequelize');
const { MfaRecoveryCode, SecuritySession, sequelize } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { recordAudit } = require('../services/auditService');
const securityService = require('../services/securityService');
const { mfaLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
router.use(authenticate);

router.post('/mfa/setup', mfaLimiter, async(req, res) => {
    try {
        if (req.user.mfa_enabled) {
            return res.status(409).json({ success: false, message: 'Disable MFA before creating a new MFA configuration' });
        }
        const secret = securityService.generateBase32Secret();
        await req.user.update({ mfa_secret_hash: securityService.encryptSecret(secret) });
        const issuer = encodeURIComponent(process.env.MFA_ISSUER || 'Campus Security');
        const label = encodeURIComponent(req.user.email);
        return res.json({ success: true, data: { otpauthUrl: `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}` } });
    } catch (error) {
        return res.status(503).json({ success: false, message: 'MFA is not configured. Please contact an administrator.' });
    }
});

router.post('/mfa/enable', mfaLimiter, async(req, res) => {
    try {
        if (!req.user.mfa_secret_hash) return res.status(400).json({ success: false, message: 'Start MFA setup first' });
        const secret = securityService.decryptSecret(req.user.mfa_secret_hash);
        if (!securityService.verifyTotp(secret, req.body?.code)) return res.status(400).json({ success: false, message: 'Invalid MFA code' });
        const recoveryCodes = securityService.createRecoveryCodes();
        const transaction = await sequelize.transaction();
        try {
            const recoveryCodeHashes = securityService.hashRecoveryCodes(recoveryCodes);
            await MfaRecoveryCode.destroy({ where: { user_id: req.user.user_id }, transaction });
            await MfaRecoveryCode.bulkCreate(recoveryCodeHashes.map((codeHash) => ({
                user_id: req.user.user_id,
                code_hash: codeHash
            })), { transaction });
            await req.user.update({ mfa_enabled: true, mfa_recovery_codes_hash: recoveryCodeHashes }, { transaction });
            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
        await recordAudit(req, { action: 'mfa_enabled', resourceType: 'user', resourceId: req.user.user_id });
        return res.json({ success: true, data: { enabled: true, recoveryCodes } });
    } catch {
        return res.status(400).json({ success: false, message: 'Unable to enable MFA' });
    }
});

router.post('/mfa/disable', mfaLimiter, async(req, res) => {
    if (!req.user.mfa_enabled) return res.json({ success: true, data: { enabled: false } });
    let valid = false;
    try { valid = securityService.verifyTotp(securityService.decryptSecret(req.user.mfa_secret_hash), req.body?.code); } catch { valid = false; }
    if (!valid) return res.status(400).json({ success: false, message: 'A valid MFA code is required' });
    const transaction = await sequelize.transaction();
    try {
        await MfaRecoveryCode.destroy({ where: { user_id: req.user.user_id }, transaction });
        await req.user.update({ mfa_enabled: false, mfa_secret_hash: null, mfa_recovery_codes_hash: null }, { transaction });
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        return res.status(500).json({ success: false, message: 'Unable to disable MFA' });
    }
    await recordAudit(req, { action: 'mfa_disabled', resourceType: 'user', resourceId: req.user.user_id });
    return res.json({ success: true, data: { enabled: false } });
});

router.get('/sessions', async(req, res) => {
    const sessions = await SecuritySession.findAll({ where: { user_id: req.user.user_id, revoked_at: null, expires_at: {
                [Op.gt]: new Date() } }, attributes: ['session_id', 'device_label', 'ip_address', 'last_active_at', 'created_at', 'expires_at'], order: [
            ['last_active_at', 'DESC']
        ] });
    return res.json({ success: true, data: sessions });
});

router.delete('/sessions/:sessionId', async(req, res) => {
    const session = await SecuritySession.findOne({ where: { session_id: req.params.sessionId, user_id: req.user.user_id, revoked_at: null } });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    await session.update({ revoked_at: new Date() });
    const sockets = req.app.get('io')?.sockets?.sockets;
    for (const socket of sockets?.values() || []) {
        if (socket.sessionId === session.session_id) socket.disconnect(true);
    }
    await recordAudit(req, { action: 'session_revoked', resourceType: 'security_session', resourceId: session.session_id });
    return res.json({ success: true });
});

router.post('/sessions/revoke-all', async(req, res) => {
    await SecuritySession.update({ revoked_at: new Date() }, { where: { user_id: req.user.user_id, revoked_at: null } });
    const sockets = req.app.get('io')?.sockets?.sockets;
    for (const socket of sockets?.values() || []) {
        if (socket.user?.user_id === req.user.user_id) socket.disconnect(true);
    }
    await recordAudit(req, { action: 'logout_all', resourceType: 'security_session', resourceId: req.user.user_id });
    return res.json({ success: true });
});

router.post('/sessions/revoke-user/:userId', authorize('admin'), async(req, res) => {
    await SecuritySession.update({ revoked_at: new Date() }, { where: { user_id: req.params.userId, revoked_at: null } });
    await recordAudit(req, { action: 'session_revoked', resourceType: 'security_session', resourceId: req.params.userId });
    return res.json({ success: true });
});

module.exports = router;