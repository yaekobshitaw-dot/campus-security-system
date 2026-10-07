# Security Implementation Plan

## Existing architecture anchors

- Express backend with centralized `authenticate`/`authorize` middleware in `backend/src/middleware/auth.js`.
- Sequelize models and additive MySQL bootstrap scripts under `backend/src/models` and `backend/src/scripts`.
- Password login, password reset, Google/Microsoft OAuth login tickets, notifications, SMS, incident assignment, zones, campus locations, protected evidence URLs, and ML risk prediction already exist.
- Dashboard admin audit logs and settings are already routed through `Dashboard.jsx` and `AdminPages.jsx`.

## Compatibility rules

- Keep existing bearer access-token fields, API paths, roles, OAuth ticket flow, incident/SOS paths, location filtering, zone routes, and deployment files.
- Add tables/columns through `ensureAuthSchema.js` or focused migrations; do not rewrite existing records.
- Never serialize password hashes, MFA encryption material, recovery-code hashes, or refresh tokens into user/session-list payloads.
- Keep ML predictions advisory; never block a user solely from an anomaly score.

## Incremental work

1. **Foundation (implemented in this change)**
   - Add encrypted-at-rest MFA secret material, MFA enablement state, and hashed recovery codes to users.
   - Add persistent security sessions with hashed refresh tokens, device metadata, expiry, and revocation.
   - Extend audit records with success, user agent, and structured metadata.
   - Add additive MFA setup/enable/disable, MFA login challenge/verification, session listing/revocation, logout-all, admin session revocation, and refresh rotation APIs.
   - Extend admin audit filtering by actor, action, dates, and success/failure.
   - Add dashboard MFA verification after password login.

2. **Authentication hardening**
   - Add bounded failed-login counters, progressive delay, temporary lockout, and suspicious-login notifications/audit records.
   - Add session identifiers to newly issued access tokens and optional revocation checks while preserving legacy tokens.
   - Add MFA handling to OAuth exchange for privileged accounts without changing provider callbacks.

3. **Authorization and audit coverage**
   - Inventory every protected route and add explicit permission policies for student, staff/faculty, security officer, admin, and any future super-admin role.
   - Add missing failure/success audit records for role changes, deletions, password changes, incident changes/deletes, zone changes, SOS handling, security configuration, evidence access, and session revocation.

4. **Emergency operations**
   - Extend `Response`/incident assignment with escalation deadline, escalation level, and supervisor handoff.
   - Add a scheduled worker that escalates unacknowledged critical incidents/SOS records, sends existing notifications, and audits every transition.

5. **Zones, anomalies, and officer safety**
   - Extend the existing `Zone` model with classification and use existing officer coordinates for restricted/high-risk entry events.
   - Add advisory anomaly input/output to the current ML service and backend fallback, covering failed logins, access patterns, officer locations, and incident activity.
   - Add officer shift/check-in records and missed-check welfare alerts using the existing user location/presence system.

6. **Evidence and alert center**
   - Keep protected evidence routing, add MIME/content validation and explicit evidence-access audit metadata.
   - Normalize existing notifications into a severity-based alert center without duplicating delivery events.

7. **Validation**
   - Add focused backend tests for every new API and frontend tests for MFA, sessions, audit filters, and alert/security pages.
   - Run backend tests, dashboard tests, lint/build, `git diff --check`, `git status --short`, and `git diff --stat` before release.
