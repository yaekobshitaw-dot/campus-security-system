const crypto = require('crypto');
const { Issuer, generators } = require('openid-client');
const { Op } = require('sequelize');
const { OAuthLoginTicket, User, UserIdentity } = require('../models');

const SUPPORTED_PROVIDERS = ['google', 'microsoft'];
const providerClients = new Map();

const providerConfig = (provider) => {
  if (provider === 'google') {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl: process.env.GOOGLE_CALLBACK_URL,
      issuerUrl: 'https://accounts.google.com',
      scopes: 'openid email profile'
    };
  }

  if (provider === 'microsoft') {
    const tenant = process.env.MICROSOFT_TENANT_ID || 'common';
    return {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      callbackUrl: process.env.MICROSOFT_CALLBACK_URL,
      issuerUrl: `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/v2.0`,
      scopes: 'openid profile email User.Read'
    };
  }

  return null;
};

const isConfigured = (provider) => {
  const config = providerConfig(provider);
  return Boolean(config?.clientId && config.clientSecret && config.callbackUrl);
};

const getClient = async (provider) => {
  if (!SUPPORTED_PROVIDERS.includes(provider)) throw new Error('Unsupported provider');
  const config = providerConfig(provider);
  if (!isConfigured(provider)) throw new Error(`${provider} is not configured`);
  if (!providerClients.has(provider)) {
    const issuer = await Issuer.discover(config.issuerUrl);
    providerClients.set(provider, new issuer.Client({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uris: [config.callbackUrl],
      response_types: ['code']
    }));
  }
  return { client: providerClients.get(provider), config };
};

const stateSecret = () => String(process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET || '');
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const sign = (value) => crypto.createHmac('sha256', stateSecret()).update(value).digest('base64url');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

const createStateCookie = (provider) => {
  const state = generators.state();
  const codeVerifier = generators.codeVerifier();
  const nonce = generators.nonce();
  const payload = encode({ provider, state, codeVerifier, nonce, expiresAt: Date.now() + 10 * 60 * 1000 });
  return { state, codeVerifier, nonce, value: `${payload}.${sign(payload)}` };
};

const readCookies = (header = '') => Object.fromEntries(header.split(';').map((part) => {
  const index = part.indexOf('=');
  if (index < 0) return ['', ''];
  return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
}).filter(([key]) => key));

const cookieName = (provider) => `campus_oauth_${provider}`;
const cookieOptions = (provider, value, maxAge) => `${cookieName(provider)}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/api/auth/oauth/${provider}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

const readState = (req, provider) => {
  const signedState = readCookies(req.headers.cookie)[cookieName(provider)];
  if (!signedState) throw new Error('OAuth state is missing or expired');
  const [payload, signature] = signedState.split('.');
  const expectedSignature = sign(payload);
  if (!payload || !signature || signature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error('OAuth state is invalid');
  }
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (parsed.provider !== provider || parsed.expiresAt <= Date.now()) throw new Error('OAuth state is expired');
  return parsed;
};

const frontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const redirectWithError = (res, message) => res.redirect(`${frontendUrl()}/oauth/callback?error=${encodeURIComponent(message)}`);

const getVerifiedIdentity = (provider, tokens) => {
  const claims = tokens.claims();
  const email = String(claims.email || '').trim().toLowerCase();
  if (!claims.sub || !email || claims.email_verified !== true) {
    throw new Error('The provider did not return a verified email address');
  }
  return { subject: claims.sub, email, name: String(claims.name || claims.given_name || email.split('@')[0]).trim() };
};

const findOrCreateUser = async (provider, identity) => {
  const existingIdentity = await UserIdentity.findOne({ where: { provider, provider_subject: identity.subject } });
  if (existingIdentity) return User.findByPk(existingIdentity.user_id);

  let user = await User.findOne({ where: { email: identity.email } });
  if (!user) {
    user = await User.create({
      name: identity.name || identity.email,
      email: identity.email,
      password_hash: crypto.randomBytes(32).toString('base64url'),
      role: 'student',
      is_active: true
    });
  }

  await UserIdentity.create({
    user_id: user.user_id,
    provider,
    provider_subject: identity.subject,
    provider_email: identity.email,
    email_verified: true
  });
  return user;
};

const createLoginTicket = async (user) => {
  const ticket = crypto.randomBytes(32).toString('base64url');
  await OAuthLoginTicket.create({
    ticket_hash: hash(ticket),
    user_id: user.user_id,
    expires_at: new Date(Date.now() + 2 * 60 * 1000)
  });
  return ticket;
};

const exchangeLoginTicket = async (ticket) => {
  if (!ticket) throw new Error('OAuth login ticket is missing');
  const [updatedCount] = await OAuthLoginTicket.update(
    { consumed_at: new Date() },
    { where: { ticket_hash: hash(ticket), consumed_at: null, expires_at: { [Op.gt]: new Date() } } }
  );
  if (updatedCount !== 1) throw new Error('OAuth login ticket is invalid or expired');
  const storedTicket = await OAuthLoginTicket.findOne({ where: { ticket_hash: hash(ticket) } });
  const user = await User.findByPk(storedTicket.user_id);
  if (!user || !user.is_active) throw new Error('User is inactive or unavailable');
  return user;
};

const start = async (req, res, provider) => {
  try {
    const { client, config } = await getClient(provider);
    const state = createStateCookie(provider);
    res.setHeader('Set-Cookie', cookieOptions(provider, state.value, 600));
    return res.redirect(client.authorizationUrl({
      scope: config.scopes,
      resource: provider === 'microsoft' ? 'https://graph.microsoft.com' : undefined,
      response_mode: 'query',
      state: state.state,
      nonce: state.nonce,
      code_challenge: generators.codeChallenge(state.codeVerifier),
      code_challenge_method: 'S256'
    }));
  } catch (error) {
    return res.status(503).json({ success: false, message: `${provider[0].toUpperCase()}${provider.slice(1)} sign-in is not configured.` });
  }
};

const callback = async (req, res, provider, generateToken) => {
  try {
    const state = readState(req, provider);
    const { client, config } = await getClient(provider);
    const tokens = await client.callback(config.callbackUrl, req.query, {
      state: state.state,
      nonce: state.nonce,
      code_verifier: state.codeVerifier
    });
    const identity = getVerifiedIdentity(provider, tokens);
    const user = await findOrCreateUser(provider, identity);
    const ticket = await createLoginTicket(user);
    res.setHeader('Set-Cookie', cookieOptions(provider, '', 0));
    return res.redirect(`${frontendUrl()}/oauth/callback?ticket=${encodeURIComponent(ticket)}`);
  } catch (error) {
    res.setHeader('Set-Cookie', cookieOptions(provider, '', 0));
    return redirectWithError(res, error.message === 'The provider did not return a verified email address'
      ? error.message
      : 'Unable to complete provider sign-in. Please try again.');
  }
};

module.exports = {
  SUPPORTED_PROVIDERS,
  isConfigured,
  start,
  callback,
  exchangeLoginTicket,
  __resetProviderClients: () => providerClients.clear(),
  __setProviderClient: (provider, client) => providerClients.set(provider, client),
  __createStateCookie: createStateCookie,
  __readState: readState,
  __getVerifiedIdentity: getVerifiedIdentity,
  __findOrCreateUser: findOrCreateUser
};