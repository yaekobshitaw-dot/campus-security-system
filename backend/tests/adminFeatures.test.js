const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePublicContentPayload } = require('../src/validators/publicContentValidator');
const { validateAnnouncementPayload } = require('../src/validators/announcementValidator');

test('public content validation supports typed records and rejects invalid types', () => {
  assert.deepEqual(validatePublicContentPayload({ type: 'faq', title: 'How do I report?', body: 'Use the report form.' }), {
    type: 'faq', title: 'How do I report?', body: 'Use the report form.'
  });
  assert.throws(() => validatePublicContentPayload({ type: 'unknown', title: 'Bad' }), /type must be one of/);
  assert.throws(() => validatePublicContentPayload({ type: 'emergency_contact', title: 'Security', email: 'bad' }), /email must be valid/);
});

test('public announcements require explicit public visibility and preserve it through validation', () => {
  assert.equal(validateAnnouncementPayload({ title: 'Public notice', content: 'Details', target_roles: ['student'], is_public: true }).is_public, true);
  assert.throws(() => validateAnnouncementPayload({ title: 'Notice', content: 'Details', is_public: 'yes' }), /is_public must be a boolean/);
});

