# Add-on: web/mobile business application (SPA or mobile app + API + database)

Read with ../linking-v3-core.md. Rubric numbers below refer to its questions 1–8.

## Components this type usually has

| Component kind | What it does | Rubric question that finds it | Source |
|---|---|---|---|
| Web SPA / mobile app | Screens a person uses; calls the API over HTTP | 1 (who acts) | [1] |
| Web API / front-end service | Handles client requests, owns business rules and the ordinary tables behind them | 2 (what rule, what data) | [1][2] |
| Background worker | Long-running, batch or scheduled work, triggered by queue messages or a schedule | 3 (no person) | [1] |
| Message queue | Decouples API from worker; stateless on both sides | 3, but 8 (link only when a new queue/topic is added) | [1] |
| Identity provider / login | Authenticates users; often a managed service (Entra ID, Cognito, Firebase) | 8 (link only when sign-in flow changes) | [1][2] |
| Permission / authorization module | Enforces roles or attributes server-side on every request; least privilege | 2 for a new rule, 8 for reuse | [10] |
| Relational database | Tables and constraints; one or several ("polyglot persistence") | 5 (store-specific work only) | [1][2] |
| Cache | Session state and semi-static data for fast reads | 5 / 8 | [1] |
| Object store + CDN | Uploaded files and static assets; files kept out of the web root | 5 (new bucket, retention) | [1][13] |
| Upload pipeline | Issues presigned/expiring upload URLs, validates, renames, scans and re-encodes files | 2 + 3 (scan runs without a person) | [13][14] |
| Notification sender | Sends email / SMS / push via remote providers; owns templates | 1 (who is told) + 4 (outside) | [1][7][15] |
| Push token registry | Stores a registration token per app instance so the server can target a device | 2 (data this feature needs) | [7] |
| Offline local store + sync engine (mobile) | Local DB as source of truth; push/pull queues; conflict resolution | 2 + 3 (sync starts on a timer / connectivity) | [5][6] |
| Audit log | Records who changed what, when, old and new values; tamper-evident, retained per regulation | 2 | [11][12] |
| Tenant onboarding / tenant mapping (SaaS) | Provisions and configures a new tenant; maps tenant → deployment | 2 + 3 (self-serve or provider-run) | [3][4] |
| Telemetry / monitoring | Request and dependency logs, health model, alerts | 8 (link only when a new signal is required) | [2] |

## Work estimates for this type usually miss

- **Offline sync is server work too.** The app needs a local store as source of truth, write queues drained when online, and conflict resolution by timestamp or version; the API must expose `updatedAt`/version fields and incremental (delta) reads. Missed because "works offline" sounds like a client switch. Lands in: mobile app (store + sync) AND the API module that owns the data. [5][6]
- **Push notifications need a token registry and store compliance.** The server must store registration tokens per app instance and send through FCM/APNs; App Store rules require opt-in for promotional pushes and an in-app opt-out, and the app must work without push. Missed because it is priced as "send a message". Lands in: notification sender, push token registry, mobile app settings screen. [7][8]
- **App-store release is a feature-sized task.** Review demo account with backend switched on, privacy-policy link in metadata and in-app, in-app account deletion if sign-up exists, store listing, testing tracks, release notes per language, staged rollout. Missed because none of it appears in the feature list. Lands in: mobile app; account deletion also in the API user module. [8][9]
- **A new role is not a dropdown value.** Authorization must be validated on every request server-side; a new role or "only X may" rule changes the permission module and every endpoint that now enforces it, plus tests for the denial paths. Missed because the UI change looks small. Lands in: permission module + each affected API module. [10]
- **File upload is a pipeline, not a form field.** Allow-listed extensions, signature check (Content-Type can be spoofed), generated filenames, size caps, antivirus/CDR, image re-encoding, storage outside the web root; presigned URLs expire and must match the declared content type. Missed because the first demo "just uploads". Lands in: API (URL issuer + metadata), worker (scan/re-encode), object store only if a new bucket or retention rule is needed. [13][14]
- **Every notification type is a template.** Stored templates carry subject, HTML and text parts with placeholders; rendering failures need an event path so bad data is caught. Missed because email is listed as "a remote service". Lands in: notification sender. [1][15]
- **Audit trail must be designed, not assumed.** What to log is set "during requirements and design": auth success/failure, access-control failures, admin actions, sensitive-data access, with when/where/who/what and old/new values; tamper detection and retention per legal obligation. Missed because framework logs feel free. Lands in: audit log component + each module whose actions must be recorded. [11][12]
- **Accessibility is per screen.** WCAG 2.2 success criteria at level A/AA apply to web and web-on-mobile content; every new screen inherits them. Missed because it is non-functional and untested until audit. Lands in: SPA / mobile app. [16]
- **Tenant onboarding orchestrates several components.** Creating a tenant means provisioning identity, configuration and possibly per-tenant databases or stamps, and recording the tenant → deployment mapping; isolation must be tested. Missed because "sign-up" reads as one form. Lands in: tenant onboarding component, identity, database (Q5 when a per-tenant store is created). [3][4]
- **Write-then-enqueue can lose the second half.** If the API writes the DB and then fails before posting the queue message, the worker never runs; a transactional outbox is extra work. Missed because the happy path hides it. Lands in: API module + worker. [1]

## Reviewer questions

Each question can only ADD a link the linker missed, and only when the feature changes that component. Do not propose a link for pass-through use.

- Does any feature promise to work offline? If so, are both the mobile app (local store + sync queue) and the API module owning the data (version fields, delta endpoint) linked — and does the feature actually change them, or only use them?
- Does any feature notify a user? If so, is the notification sender linked, plus the channel piece (push → token registry + opt-in screen; email → that template) — and does the feature actually change them (a new template, a new channel), or only use them?
- Does any feature add a role or an "only X may…" rule? If so, are the permission module and each API module whose endpoints now enforce it linked — and does the feature actually change them (a new rule), or only reuse an existing role (Q8, nothing shared)?
- Does any feature accept a file? If so, are the API (URL issuer, metadata) and the worker (scan/re-encode) linked — and does the feature actually change the object store (a new bucket or retention rule, Q5), or only use it?
- Does any feature need to be auditable or show change history? If so, are the audit log and each module that must emit records linked — and does the feature actually change them (new record kinds), or only use existing platform telemetry?
- Does any feature change what a tenant gets (plan, isolation, region)? If so, is tenant onboarding/mapping linked — and does the feature actually change it, or only use the sign-up screen?

## Sources

1. Web-Queue-Worker architecture style — Azure Architecture Center. https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/web-queue-worker
2. Basic web application — Azure Architecture Center. https://learn.microsoft.com/en-us/azure/architecture/web-apps/app-service/architectures/basic-web-app
3. Tenancy models for a multitenant solution — Azure Architecture Center. https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models
4. Tenant onboarding — AWS Well-Architected SaaS Lens. https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/tenant-onboarding.html
5. Build an offline-first app — Android Developers. https://developer.android.com/topic/architecture/data-layer/offline-first
6. Offline data sync for mobile apps — Microsoft Learn (Azure Mobile Apps, archived). https://learn.microsoft.com/en-us/previous-versions/azure/developer/mobile-apps/azure-mobile-apps/howto/data-sync
7. FCM architectural overview — Firebase. https://firebase.google.com/docs/cloud-messaging/fcm-architecture
8. App Store Review Guidelines — Apple Developer. https://developer.apple.com/app-store/review/guidelines/
9. Prepare and roll out a release — Google Play Console Help. https://support.google.com/googleplay/android-developer/answer/9859348
10. Authorization Cheat Sheet — OWASP. https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
11. Logging Cheat Sheet — OWASP. https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
12. Audit Log — Martin Fowler. https://martinfowler.com/eaaDev/AuditLog.html
13. File Upload Cheat Sheet — OWASP. https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
14. Uploading objects with presigned URLs — Amazon S3 User Guide. https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
15. Using templates to send personalized email — Amazon SES Developer Guide. https://docs.aws.amazon.com/ses/latest/dg/send-personalized-email-api.html
16. WCAG 2 Overview — W3C Web Accessibility Initiative. https://www.w3.org/WAI/standards-guidelines/wcag/
