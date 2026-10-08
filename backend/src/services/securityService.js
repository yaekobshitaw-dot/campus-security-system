const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { MfaRecoveryCode, SecuritySession, User } = require('../models');

const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const getEncryptionKey = () => {
    const configured = String(process.env.MFA_ENCRYPTION_KEY || '');
    if (configured.length < 32) throw new Error('MFA_ENCRYPTION_KEY must be at least 32 characters');
    return crypto.createHash('sha256').update(configured).digest();
};

const generateBase32Secret = (length = 20) => {
    const bytes = crypto.randomBytes(length);
    let bits = '';
    for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
    let secret = '';
    for (let index = 0; index < bits.length; index += 5) secret += base32Alphabet[parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
    return secret;
};

const getPendingMfaSecret = async(user) => {
    if (user.mfa_secret_hash) return decryptSecret(user.mfa_secret_hash);
    const secret = generateBase32Secret();
    const encryptedSecret = encryptSecret(secret);
    const [updatedCount] = await User.update({ mfa_secret_hash: encryptedSecret }, { where: { user_id: user.user_id, mfa_secret_hash: null } });
    if (updatedCount === 1) return secret;
    const persistedUser = await User.findByPk(user.user_id, { attributes: ['mfa_secret_hash'] });
    if (!persistedUser?.mfa_secret_hash) throw new Error('Unable to persist pending MFA secret');
    return decryptSecret(persistedUser.mfa_secret_hash);
};

const decodeBase32 = (value) => {
    const normalized = String(value || '').replace(/=+$/g, '').toUpperCase();
    let bits = '';
    for (const character of normalized) {
        const index = base32Alphabet.indexOf(character);
        if (index < 0) throw new Error('Invalid MFA secret');
        bits += index.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
    return Buffer.from(bytes);
};

const encryptSecret = (secret) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
};

const decryptSecret = (value) => {
    const [ivValue, tagValue, encryptedValue] = String(value || '').split('.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8');
};

const createTotp = (secret, timestamp = Date.now()) => {
    const counter = Math.floor(timestamp / 1000 / 30);
    const buffer = Buffer.alloc(8);
    buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    buffer.writeUInt32BE(counter >>> 0, 4);
    const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(buffer).digest();
    const offset = digest[digest.length - 1] & 15;
    return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
};

const verifyTotp = (secret, code, timestamp = Date.now()) => {
    const supplied = String(code || '').trim();
    if (!/^\d{6}$/.test(supplied)) return false;
    for (const offset of[-1, 0, 1]) {
        const expected = createTotp(secret, timestamp + offset * 30000);
        if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return true;
    }
    return false;
};

const createRecoveryCodes = (count = 8) => Array.from({ length: count }, () => crypto.randomBytes(8).toString('hex'));
const hashRecoveryCodes = (codes) => codes.map((code) => hash(code));
const consumeRecoveryCode = (storedCodes, suppliedCode) => {
    const suppliedHash = hash(String(suppliedCode || '').trim());
    const index = (storedCodes || []).findIndex((value) => value === suppliedHash);
    return index < 0 ? null : [...storedCodes.slice(0, index), ...storedCodes.slice(index + 1)];
};

const consumeRecoveryCodeAtomic = async(userId, suppliedCode) => {
    if (!userId || !suppliedCode) return false;
    const [updatedCount] = await MfaRecoveryCode.update({ consumed_at: new Date() }, { where: { user_id: userId, code_hash: hash(String(suppliedCode).trim()), consumed_at: null } });
    return updatedCount === 1;
};

const createRefreshSession = async(user, req) => {
    const refreshToken = crypto.randomBytes(48).toString('base64url');
    const ttlMs = Number(process.env.REFRESH_TOKEN_TTL_MS || 30 * 24 * 60 * 60 * 1000);
    const session = await SecuritySession.create({
        user_id: user.user_id,
        refresh_token_hash: hash(refreshToken),
        device_label: String(req.get?.('user-agent') || '').slice(0, 255) || null,
        ip_address: req.ip || null,
        user_agent: String(req.get?.('user-agent') || '').slice(0, 512) || null,
        expires_at: new Date(Date.now() + ttlMs)
    });
    return { refreshToken, session };
};

const rotateRefreshSession = async(refreshToken) => {
    if (!refreshToken) return null;
    const refreshTokenHash = hash(refreshToken);
    const lastActiveAt = new Date();
    const [updatedCount] = await SecuritySession.update({ revoked_at: lastActiveAt, last_active_at: lastActiveAt }, {
        where: {
            refresh_token_hash: refreshTokenHash,
            revoked_at: null,
            expires_at: {
                [Op.gt]: lastActiveAt
            }
        }
    });
    if (updatedCount !== 1) return null;
    return SecuritySession.findOne({
        where: {
            refresh_token_hash: refreshTokenHash,
            revoked_at: {
                [Op.ne]: null
            }
        }
    });
};

const revokeRefreshSession = async(refreshToken) => {
    if (!refreshToken) return false;
    const refreshTokenHash = hash(refreshToken);
    const [updatedCount] = await SecuritySession.update({ revoked_at: new Date() }, { where: { refresh_token_hash: refreshTokenHash, revoked_at: null } });
    if (updatedCount !== 1) return false;
    const session = await SecuritySession.findOne({ where: { refresh_token_hash: refreshTokenHash } });
    return session?.session_id || false;
};

const signMfaChallenge = (user) => jwt.sign({ user_id: user.user_id, purpose: 'mfa-challenge' }, String(process.env.JWT_SECRET || ''), { expiresIn: '5m' });
const verifyMfaChallenge = (token) => {
    const payload = jwt.verify(token, String(process.env.JWT_SECRET || ''));
    if (payload.purpose !== 'mfa-challenge') throw new Error('Invalid MFA challenge');
    return payload;
};

module.exports = {
    consumeRecoveryCode,
    consumeRecoveryCodeAtomic,
    createRefreshSession,
    createRecoveryCodes,
    decryptSecret,
    encryptSecret,
    generateBase32Secret,
    getPendingMfaSecret,
    hash,
    hashRecoveryCodes,
    rotateRefreshSession,
    revokeRefreshSession,
    signMfaChallenge,
    verifyMfaChallenge,
    verifyTotp
};