# LSPD / DA Case Filing System

An Express and MongoDB case-filing workflow for LSPD officers and DA reviewers. It creates structured drafts, accepts protected evidence, records review decisions, and generates the approved DOCX filing package.

## Workflow

1. An LSPD officer creates and saves a draft.
2. The server validates the filing according to its configured schema.
3. The officer submits with a password-verified attestation.
4. A DA reviewer claims the filing, requests changes, dismisses it, or approves it with a password-verified signature.
5. Approval generates a versioned DOCX document and an immutable audit trail.

Filing requirements are configuration-driven in `config/filingSchemas.js`. The browser uses those settings to show the correct sections, while the backend applies the same requirements when it saves or submits a filing.

## Security model

- Session, JWT, admin, and database configuration must be supplied through environment variables in production.
- Sessions are stored in MongoDB in production and regenerated after login.
- CSRF tokens protect form and JavaScript state-changing requests.
- Rate limiting applies after the session middleware.
- Evidence is not publicly static: `/files/attachments/:id` checks filing-level permission before delivery.
- Filing and generated-document access is limited to the owner, DA users, assigned reviewer for decisions, or a super administrator.
- Uploads are size-limited, content-signature checked, and stored under server-generated names.

## Setup

```powershell
Copy-Item .env.example .env
npm install
npm start
```

Set strong values in `.env`; do not use the sample placeholders. Production requires `MONGODB_URI`, `SESSION_SECRET`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_NAME`. The server refuses an unavailable MongoDB connection in production. Development may use its in-memory fallback, which intentionally loses data when the process stops.

## Development checks

```powershell
npm test -- --runInBand
Get-ChildItem -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

## Operational notes

- Generated filings are currently stored as DOCX. Add a dedicated background conversion worker before advertising PDF output.
- Back up MongoDB and the `uploads` directory together. Attachments reference the filing record and are intentionally private.
- Use the configured `CRON_TIMEZONE` when deploying scheduled digests.
