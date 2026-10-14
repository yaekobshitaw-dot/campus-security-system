const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const previousNodeEnv = process.env.NODE_ENV;
const previousCorsOrigins = process.env.CORS_ORIGINS;
process.env.NODE_ENV = 'production';
delete process.env.CORS_ORIGINS;

const app = require('../src/app');

if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
else process.env.NODE_ENV = previousNodeEnv;
if (previousCorsOrigins === undefined) delete process.env.CORS_ORIGINS;
else process.env.CORS_ORIGINS = previousCorsOrigins;

test('production CORS allows the deployed frontend login preflight', async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const response = await new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1',
      port: server.address().port,
      path: '/api/auth/login',
      method: 'OPTIONS',
      headers: {
        Origin: 'https://campus-security-system-alpha.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'
      }
    }, resolve);
    request.on('error', reject);
    request.end();
  });

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers['access-control-allow-origin'], 'https://campus-security-system-alpha.vercel.app');
  assert.match(response.headers['access-control-allow-methods'], /POST/);
  response.resume();
});