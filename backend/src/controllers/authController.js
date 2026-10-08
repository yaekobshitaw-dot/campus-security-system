// src/controllers/authController.js
const { User } = require('../models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { sendEmail, getEmailServiceConfig, formatEmailError } = require('../services/emailService');
const { recordAudit } = require('../services/auditService');
const { notifyUsers } = require('../services/notificationPersistence');
const oauthService = require('../services/oauthService');
const { withAdminAccountsLocked, assertAdminCapacity } = require('../services/adminAccountPolicy');
const { logger } = require('../utils/logger');
const securityService = require('../services/securityService');
const { disconnectSessionSockets } = require('../config/socket');

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
    console.warn('JWT_SECRET is not configured. Authentication will fail until it is set.');
}

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const normalizePhone = (phone) => String(phone || '').trim();
const normalizeRole = (role, allowedRoles, fallbackRole = 'student') => {
    const normalized = String(role || '').trim().toLowerCase();
    return allowedRoles.includes(normalized) ? normalized : fallbackRole;
};
const canonicalizeSecurityRole = (role) => (String(role || '').trim().toLowerCase() === 'security_officer' ? 'security' : String(role || '').trim().toLowerCase());
const isSecurityRole = (role) => ['security', 'security_officer'].includes(String(role || '').trim().toLowerCase());
const isValidBootstrapSecret = (providedSecret) => {
    const configuredSecret = String(process.env.ADMIN_BOOTSTRAP_SECRET || '');
    const suppliedSecret = String(providedSecret || '');
    if (!configuredSecret || !suppliedSecret || configuredSecret.length !== suppliedSecret.length) {
        return false;
    }

    return crypto.timingSafeEqual(Buffer.from(configuredSecret), Buffer.from(suppliedSecret));
};

const PUBLIC_REGISTRATION_ROLES = ['student', 'faculty', 'staff'];
const ADMIN_MANAGED_ROLES = ['student', 'faculty', 'staff', 'security', 'security_officer', 'admin'];

const generateToken = (user, sessionId) => {
    if (!jwtSecret) {
        throw new Error('JWT_SECRET is not configured');
    }

    if (!sessionId) throw new Error('Security session is required');

    return jwt.sign({ user_id: user.user_id, email: user.email, role: user.role, sid: sessionId },
        jwtSecret, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

exports.register = async(req, res) => {
    try {
        const { name, email, password, role, phone } = req.body;
        const normalizedEmail = normalizeEmail(email);
        const normalizedPhone = normalizePhone(phone);
        const requestedRole = String(role || '').trim().toLowerCase();

        if (!name || !normalizedEmail || !password) {
            return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
        }

        if (normalizedPhone && !/^\+?[0-9\s()-]{7,20}$/.test(normalizedPhone)) {
            return res.status(400).json({ success: false, message: 'Phone number is invalid.' });
        }

        if (!PUBLIC_REGISTRATION_ROLES.includes(requestedRole) && requestedRole !== '') {
            return res.status(400).json({
                success: false,
                message: 'Public registration is limited to student, faculty, or staff roles'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
        }

        const existingUser = await User.findOne({ where: { email: normalizedEmail } });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Email already registered' });
        }

        const allowedRole = normalizeRole(requestedRole || 'student', PUBLIC_REGISTRATION_ROLES, 'student');
        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password_hash: password,
            phone: normalizedPhone || null,
            role: allowedRole
        });

        const { refreshToken, session } = await securityService.createRefreshSession(user, req);
        const token = generateToken(user, session.session_id);

        return res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: { user: user.toJSON(), accessToken: token, refreshToken }
        });
    } catch (error) {
        const message = error.message === 'JWT_SECRET is not configured' ?
            'Authentication is not configured correctly' :
            'Registration failed';

        return res.status(500).json({ success: false, message });
    }
};

exports.createUserByAdmin = async(req, res) => {
    try {
        const { name, email, password, role, phone } = req.body;
        const normalizedEmail = normalizeEmail(email);
        const normalizedPhone = normalizePhone(phone);
        const requestedRole = String(role || '').trim().toLowerCase();

        if (typeof name !== 'string' || !name.trim() || !normalizedEmail || !password) {
            return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
        }

        if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
            return res.status(400).json({ success: false, message: 'Email is invalid' });
        }

        if (normalizedPhone && !/^\+?[0-9\s()-]{7,20}$/.test(normalizedPhone)) {
            return res.status(400).json({ success: false, message: 'Phone number is invalid.' });
        }

        if (req.body.is_active !== undefined && typeof req.body.is_active !== 'boolean') {
            return res.status(400).json({ success: false, message: 'is_active must be a boolean' });
        }

        if (typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
        }

        const canonicalRole = canonicalizeSecurityRole(requestedRole);
        if (!ADMIN_MANAGED_ROLES.includes(canonicalRole) && !ADMIN_MANAGED_ROLES.includes(requestedRole)) {
            return res.status(400).json({
                success: false,
                message: 'Role must be one of: student, faculty, staff, security, security_officer, admin'
            });
        }

        const existingUser = await User.findOne({ where: { email: normalizedEmail } });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Email already registered' });
        }

        const attributes = {
            name: name.trim(),
            email: normalizedEmail,
            password_hash: password,
            phone: normalizedPhone || null,
            role: canonicalRole,
            availability_status: isSecurityRole(canonicalRole) ? 'available' : undefined,
            ...(req.body.is_active === undefined ? {} : { is_active: req.body.is_active })
        };
        const user = canonicalRole === 'admin' ?
            await withAdminAccountsLocked(async(transaction, admins) => {
                assertAdminCapacity(admins);
                return User.create(attributes, { transaction });
            }) :
            await User.create(attributes);
        await recordAudit(req, { action: 'user_created', resourceType: 'user', resourceId: user.user_id, details: `Created ${canonicalRole} account.` });
        await notifyUsers(req, { type: 'user_admin_event', title: 'User account created', message: `A ${canonicalRole} account was created.`, resourceType: 'user', resourceId: user.user_id, link: '/users', dedupeKey: `user-created:${user.user_id}` });

        return res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: { user: user.toJSON() }
        });
    } catch (error) {
        const statusCode = error.statusCode || (error.name === 'SequelizeUniqueConstraintError' ? 409 : 500);
        const message = error.statusCode ?
            error.message :
            error.name === 'SequelizeUniqueConstraintError' ?
            'Email already registered' :
            'User creation failed';
        return res.status(statusCode).json({ success: false, message });
    }
};

exports.setupFirstAdmin = async(req, res) => {
    try {
        const configuredSecret = String(process.env.ADMIN_BOOTSTRAP_SECRET || '');
        const suppliedSecret = req.get('x-admin-bootstrap-secret');
        if (!configuredSecret) {
            return res.status(503).json({
                success: false,
                message: 'First-admin setup is not configured'
            });
        }

        if (!isValidBootstrapSecret(suppliedSecret)) {
            return res.status(403).json({
                success: false,
                message: 'Invalid bootstrap credentials'
            });
        }

        const { name, email, password } = req.body;
        const normalizedEmail = normalizeEmail(email);

        const existingAdmin = await User.findOne({ where: { role: 'admin' } });
        if (existingAdmin) {
            return res.status(409).json({
                success: false,
                message: 'An admin user already exists. First-admin setup is disabled after initialization.'
            });
        }

        if (!name || !normalizedEmail || !password) {
            return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
        }

        const existingUser = await User.findOne({ where: { email: normalizedEmail } });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Email already registered' });
        }

        const firstAdmin = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password_hash: password,
            role: 'admin',
            is_active: true
        });

        return res.status(201).json({
            success: true,
            message: 'First admin created successfully',
            data: { user: firstAdmin.toJSON() }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'First admin setup failed' });
    }
};

exports.login = async(req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = normalizeEmail(email);

        // Lightweight request logging for debugging failed login attempts (no passwords)
        try { logger.info(`Auth login attempt: ${normalizedEmail} from ${req.ip} - UA: ${req.get('user-agent') || 'unknown'}`); } catch (e) { /* ignore logging errors */ }

        if (!normalizedEmail || !password) {
            logger.warn(`Auth login missing fields from ${req.ip}: email=${!!normalizedEmail}`);
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const user = await User.findOne({ where: { email: normalizedEmail } });
        if (!user || !user.is_active) {
            logger.warn(`Auth login failed (invalid user or inactive): ${normalizedEmail} from ${req.ip}`);
            await recordAudit(req, { action: 'login_failed', resourceType: 'user', success: false, metadata: { reason: 'invalid_credentials' } });
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const isValid = await user.comparePassword(password);
        if (!isValid) {
            logger.warn(`Auth login failed (bad password): ${normalizedEmail} from ${req.ip}`);
            await recordAudit({...req, user: null }, { action: 'login_failed', resourceType: 'user', resourceId: user.user_id, success: false });
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        if (user.mfa_enabled) {
            await recordAudit({...req, user }, { action: 'mfa_challenge', resourceType: 'user', resourceId: user.user_id });
            return res.status(200).json({
                success: true,
                message: 'MFA verification required',
                data: { mfaRequired: true, challengeToken: securityService.signMfaChallenge(user) }
            });
        }

        const { refreshToken, session } = await securityService.createRefreshSession(user, req);
        const token = generateToken(user, session.session_id);
        if (isSecurityRole(user.role)) {
            await user.update({ availability_status: 'available' });
        }
        if (user.role === 'admin') {
            req.user = user;
            await recordAudit(req, { action: 'admin_login', resourceType: 'user', resourceId: user.user_id });
        }

        logger.info(`Auth login success: ${normalizedEmail} from ${req.ip}`);
        await recordAudit({...req, user }, { action: 'login', resourceType: 'user', resourceId: user.user_id });

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: { user: user.toJSON(), accessToken: token, refreshToken }
        });
    } catch (error) {
        const message = error.message === 'JWT_SECRET is not configured' ?
            'Authentication is not configured correctly' :
            'Login failed';

        logger.error('Auth login error', { error: error && error.message });
        return res.status(500).json({ success: false, message });
    }
};

exports.verifyMfaLogin = async(req, res) => {
    try {
        const challenge = securityService.verifyMfaChallenge(req.body?.challengeToken);
        const user = await User.findByPk(challenge.user_id);
        if (!user || !user.is_active || !user.mfa_enabled) throw new Error('MFA verification unavailable');
        let valid = false;
        try {
            valid = securityService.verifyTotp(securityService.decryptSecret(user.mfa_secret_hash), req.body?.code);
        } catch { valid = false; }
        if (!valid) {
            valid = await securityService.consumeRecoveryCodeAtomic(user.user_id, req.body?.recoveryCode);
        }
        if (!valid) {
            await recordAudit({...req, user }, { action: 'mfa_login_failed', resourceType: 'user', resourceId: user.user_id, success: false });
            return res.status(401).json({ success: false, message: 'Invalid MFA code' });
        }
        const { refreshToken, session } = await securityService.createRefreshSession(user, req);
        const token = generateToken(user, session.session_id);
        await recordAudit({...req, user }, { action: 'mfa_success', resourceType: 'user', resourceId: user.user_id });
        await recordAudit({...req, user }, { action: 'login', resourceType: 'user', resourceId: user.user_id });
        return res.json({ success: true, message: 'Login successful', data: { user: user.toJSON(), accessToken: token, refreshToken } });
    } catch {
        return res.status(401).json({ success: false, message: 'MFA verification failed' });
    }
};

exports.refreshSession = async(req, res) => {
    try {
        const current = await securityService.rotateRefreshSession(req.body?.refreshToken);
        if (!current) return res.status(401).json({ success: false, message: 'Refresh token is invalid or expired' });
        const user = await User.findByPk(current.user_id);
        if (!user || !user.is_active) return res.status(401).json({ success: false, message: 'User not found or inactive' });
        const { refreshToken, session } = await securityService.createRefreshSession(user, req);
        const token = generateToken(user, session.session_id);
        await recordAudit({...req, user }, { action: 'refresh_rotation', resourceType: 'security_session', resourceId: session.session_id });
        return res.json({ success: true, data: { user: user.toJSON(), accessToken: token, refreshToken } });
    } catch {
        return res.status(401).json({ success: false, message: 'Unable to refresh session' });
    }
};

exports.forgotPassword = async(req, res) => {
    const genericResponse = {
        success: true,
        message: 'If an account exists for that email, password reset instructions have been sent.'
    };

    try {
        const normalizedEmail = normalizeEmail(req.body.email);
        if (!normalizedEmail) return res.status(200).json(genericResponse);

        if (!getEmailServiceConfig().configured) {
            return res.status(503).json({
                success: false,
                message: 'Password reset email service is not configured. Please contact support.'
            });
        }

        const user = await User.findOne({ where: { email: normalizedEmail, is_active: true } });
        if (!user) return res.status(200).json(genericResponse);

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await user.update({ reset_token_hash: resetTokenHash, reset_token_expires_at: expiresAt });

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password/?token=${resetToken}`;
        await sendEmail(
            user.email,
            'Campus Security password reset',
            `<p>Use the link below to set a new password. It expires in 15 minutes.</p><p><a href="${resetUrl}">Reset your password</a></p><p>If you did not request this, you can ignore this email.</p>`
        );

        return res.status(200).json(genericResponse);
    } catch (error) {
        console.error('Password reset request failed:', formatEmailError(error));
        return res.status(503).json({
            success: false,
            message: 'Password reset email service is temporarily unavailable. Please try again later.'
        });
    }
};

exports.resetPassword = async(req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ success: false, message: 'A valid token and password of at least 8 characters are required' });
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(10));
        const [updatedCount] = await User.update({
            password_hash: passwordHash,
            reset_token_hash: null,
            reset_token_expires_at: null
        }, {
            where: {
                reset_token_hash: tokenHash,
                reset_token_expires_at: {
                    [Op.gt]: new Date() }
            }
        });

        if (updatedCount !== 1) {
            return res.status(400).json({ success: false, message: 'This reset link is invalid or expired' });
        }

        return res.status(200).json({ success: true, message: 'Password reset successful' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Unable to reset password' });
    }
};

exports.logout = async(req, res) => {
    try {
        const refreshToken = String(req.body?.refreshToken || '');
        const revokedSessionId = await securityService.revokeRefreshSession(refreshToken);
        if (!revokedSessionId) return res.status(401).json({ success: false, message: 'Logout credentials are invalid or expired' });
        disconnectSessionSockets(req.app?.get('io'), revokedSessionId);
        if (req.user && isSecurityRole(req.user.role)) {
            await req.user.update({ availability_status: 'offline' });
        }
        await recordAudit(req, { action: 'logout', resourceType: 'user', resourceId: req.user?.user_id });
        return res.status(200).json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        return res.status(503).json({ success: false, message: 'Unable to complete logout' });
    }
};

exports.oauthExchange = async(req, res) => {
    try {
        const user = await oauthService.exchangeLoginTicket(req.body.ticket);
        const { refreshToken, session } = await securityService.createRefreshSession(user, req);
        const token = generateToken(user, session.session_id);
        await recordAudit({...req, user }, { action: 'login', resourceType: 'user', resourceId: user.user_id });
        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: { user: user.toJSON(), accessToken: token, refreshToken }
        });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message || 'Unable to complete provider sign-in' });
    }
};

exports.generateToken = generateToken;