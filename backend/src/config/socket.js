const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { SecuritySession, User } = require('../models');
const { isSystemActive } = require('../services/settingsService');

function initSocket(io, options = {}) {
    const configuredGrace = String(process.env.PRESENCE_DISCONNECT_GRACE_MS || '').trim();
    const defaultGrace = configuredGrace === '' ? 15000 : Number(configuredGrace);
    const disconnectGraceMs = Number.isFinite(options.disconnectGraceMs) ?
        Math.max(0, options.disconnectGraceMs) :
        Number.isFinite(defaultGrace) && defaultGrace >= 0 ? defaultGrace : 15000;
    io.presence = new Map();
    io.presenceLastSeenWrites = new Map();

    const persistLastSeen = (userId, lastSeenAt) => {
        const pendingWrites = io.presenceLastSeenWrites;
        const previousWrite = pendingWrites.get(userId) || Promise.resolve();
        let nextWrite;
        nextWrite = previousWrite
            .catch(() => undefined)
            .then(() => User.update({ last_seen_at: lastSeenAt }, { where: { user_id: userId }, silent: true }))
            .finally(() => {
                if (pendingWrites.get(userId) === nextWrite) pendingWrites.delete(userId);
            });
        pendingWrites.set(userId, nextWrite);
        return nextWrite;
    };

    io.use(async(socket, next) => {
        try {
            const token = socket.handshake.auth ? .token;
            if (!token || !process.env.JWT_SECRET) return next(new Error('Authentication required'));
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (!decoded.user_id || !decoded.sid) return next(new Error('Authentication required'));
            const user = await User.findByPk(decoded.user_id);
            if (!user || !user.is_active) return next(new Error('Authentication required'));
            const session = await SecuritySession.findOne({
                where: {
                    session_id: decoded.sid,
                    user_id: decoded.user_id,
                    revoked_at: null,
                    expires_at: {
                        [Op.gt]: new Date()
                    }
                }
            });
            if (!session) return next(new Error('Authentication required'));
            if (String(user.role || '').trim().toLowerCase() !== 'admin' && !(await isSystemActive())) {
                return next(new Error('The campus security system is temporarily deactivated'));
            }
            socket.user = user;
            socket.sessionId = decoded.sid;
            return next();
        } catch (error) {
            return next(new Error('Invalid socket token'));
        }
    });

    io.on('connection', (socket) => {
        socket.join(`role:${socket.user.role}`);
        socket.join(`user:${socket.user.user_id}`);
        socket.join('authenticated');

        const presence = io.presence;
        const userId = socket.user.user_id;
        let entry = presence.get(userId);
        const becameOnline = !entry;
        if (!entry) entry = { count: 0, connections: new Set(), offlineTimer: null };
        if (entry.offlineTimer) clearTimeout(entry.offlineTimer);
        entry.offlineTimer = null;
        entry.connections.add(socket.id);
        entry.count = entry.connections.size;
        presence.set(userId, entry);

        if (becameOnline) {
            const lastSeenAt = new Date();
            persistLastSeen(userId, lastSeenAt).catch((error) => {
                console.warn('Presence timestamp persistence failed:', error ? .message || error);
            });
            io.to('authenticated').emit('presence-updated', {
                user_id: userId,
                is_online: true,
                last_seen_at: null
            });
        }

        socket.emit('presence-snapshot', { online_user_ids: [...presence.keys()] });

        const officerPayload = {
            user_id: socket.user.user_id,
            name: socket.user.name,
            role: socket.user.role,
            latitude: socket.user.latitude,
            longitude: socket.user.longitude,
            availability_status: socket.user.availability_status,
            location_updated_at: socket.user.location_updated_at,
            presence: true
        };
        io.to('role:security').to('role:admin').emit('officer-location-updated', officerPayload);

        socket.on('disconnect', () => {
            const currentEntry = presence.get(userId);
            if (!currentEntry || !currentEntry.connections.delete(socket.id)) return;
            currentEntry.count = currentEntry.connections.size;

            const disconnectedOfficerPayload = {...officerPayload, presence: currentEntry.count > 0 };
            io.to('role:security').to('role:admin').emit('officer-location-updated', disconnectedOfficerPayload);
            if (currentEntry.count > 0) return;

            currentEntry.offlineTimer = setTimeout(() => {
                if (presence.get(userId) !== currentEntry || currentEntry.connections.size > 0) return;
                presence.delete(userId);
                const lastSeenAt = new Date();
                persistLastSeen(userId, lastSeenAt)
                    .catch((error) => {
                        console.warn('Presence timestamp persistence failed:', error ? .message || error);
                    })
                    .finally(() => {
                        if (presence.has(userId)) return;
                        io.to('authenticated').emit('presence-updated', {
                            user_id: userId,
                            is_online: false,
                            last_seen_at: lastSeenAt
                        });
                    });
            }, disconnectGraceMs);
            currentEntry.offlineTimer.unref ? .();
        });
    });
}

const disconnectSessionSockets = (io, sessionId, options = {}) => {
    const sockets = io ? .sockets ? .sockets;
    for (const socket of sockets ? .values() || []) {
        if (socket.sessionId === sessionId) {
            const payload = {
                reason: options.reason || 'session_revoked',
                message: options.message || 'Your account was signed in on another device. Please log in again.'
            };
            socket.emit ? .('session-revoked', payload);
            socket.disconnect(true);
        }
    }
};

const disconnectUserSockets = (io, userId, options = {}) => {
    const sockets = io ? .sockets ? .sockets;
    for (const socket of sockets ? .values() || []) {
        if (String(socket.user ? .user_id) === String(userId)) {
            const payload = {
                reason: options.reason || 'session_revoked',
                message: options.message || 'Your account was signed in on another device. Please log in again.'
            };
            socket.emit ? .('session-revoked', payload);
            socket.disconnect(true);
        }
    }
    if (io ? .presence ? .has(userId)) {
        io.presence.delete(userId);
        io.to ? .('authenticated') ? .emit ? .('presence-updated', {
            user_id: userId,
            is_online: false,
            last_seen_at: new Date()
        });
    }
};

module.exports = { disconnectSessionSockets, disconnectUserSockets, initSocket };