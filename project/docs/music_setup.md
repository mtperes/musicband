# Music and Email Authentication Setup

## Chosen Flow

Supabase manages identity, band permissions and private PDFs. An administrator invites an approved email from `/admin`. Members enter their email at `/music` or `/admin`, receive a one-time link, and click it to sign in without a password. Typing an email alone never authenticates a user. There is no public signup UI; login uses `shouldCreateUser: false`.

Google login has been removed from the frontend. The unrelated public Google Calendar ICS feed stays. Keep existing Auth account IDs during provider transition; do not delete users or their music records. Disable the Google provider in the Supabase dashboard after verifying email access; this does not revoke previously issued sessions.

## 1. Database and Storage

Apply these migrations in order, once, using the Supabase SQL Editor or CLI:

1. `supabase/migrations/202611100001_music_library.sql`: bands, memberships, sheet metadata, private storage and RLS.
2. `supabase/migrations/202611100002_member_invites.sql`: service-only member lookup/list/approval and atomic invitation throttling.

Review existing tables before applying; back up existing data. The frontend never applies migrations automatically. The initial band is seeded, but no account automatically becomes administrator.

## 2. Email Provider and Free SMTP

In Supabase Authentication settings, enable Email authentication, keep email verification enabled and disable **Allow new users to sign up**. Trusted Admin API invitations can still provision users. Disable anonymous authentication and any unused identity providers.

Supabase's built-in SMTP is not suitable for band members: it only sends to organization-team addresses and has a very small testing limit. Configure a custom SMTP sender. Brevo Free is a candidate with no credit card requirement; verify its current transactional allowance, sender verification and account activation requirements. Stay on free plans and do not purchase a domain or upgrade without approval. If a free sender cannot be verified, email delivery remains blocked; do not bypass ownership verification.

Create/verify the sender in the email provider, obtain its SMTP host, port, login and SMTP key, then enter those values under Supabase Authentication > Email > SMTP Settings. Use the provider's SMTP key, not its ordinary account password. Keep credentials in Supabase, never in frontend variables. Disable click/link tracking for authentication emails. Set appropriate Auth rate limits and enable CAPTCHA before opening to a larger audience.

The endpoint enforces one invite per band administrator every 60 seconds. Normal magic-link requests also use Supabase server-side Auth rate limits; the frontend cooldown is only a usability aid.

## 3. URLs and Email Templates

Set Supabase Authentication > URL Configuration > Site URL to the application origin, without a trailing slash. For this development server, use `http://127.0.0.1:5174`. Production must use HTTPS. Local and production should use separate Supabase projects when possible.

Allow exact redirect URLs for each active origin, including:

```text
http://127.0.0.1:5174/auth/confirm?next=music
http://127.0.0.1:5174/auth/confirm?next=admin
http://127.0.0.1:5173/auth/confirm?next=music
http://127.0.0.1:5173/auth/confirm?next=admin
http://localhost:5173/auth/confirm?next=music
http://localhost:5173/auth/confirm?next=admin
https://YOUR_DOMAIN/auth/confirm?next=music
https://YOUR_DOMAIN/auth/confirm?next=admin
```

Configure the **Magic Link** email template:

```html
<h2>Acesso ao workspace</h2>
<p><a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}&type=email">Entrar</a></p>
```

Configure the **Invite User** template:

```html
<h2>Convite para o workspace</h2>
<p><a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}&type=invite">Aceitar convite</a></p>
```

The fragment keeps the bearer token out of HTTP request URLs. `/auth/confirm` verifies the token directly using `verifyOtp`, clears the URL, and only redirects to `/music` or `/admin`. This supports invitations and links opened in a different browser, without relying on an inviter's PKCE verifier. Links expire and are single-use. Avoid analytics/token logging on the callback page. Deploy the SPA with an index fallback for direct `/auth/confirm`, `/music` and `/admin` requests.

## 4. Deploy Member Administration

The Edge Function authenticates the caller with `getUser` and requires an owner/admin membership in the selected band. Database functions recheck the administrator role. The browser cannot write memberships or call service-only lookup/approval RPCs. Invitations add `musician` while preserving existing roles. Only members of the selected authorized band are returned.

Supabase-hosted functions provide `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Configure these additional function secrets in the dashboard or CLI (they are configuration values, not frontend variables):

```text
AUTH_SITE_URL=http://127.0.0.1:5174
AUTH_ALLOWED_ORIGINS=http://127.0.0.1:5174,http://127.0.0.1:5173,http://localhost:5173
```

For production, use the production HTTPS origin and restrict allowed origins accordingly. Then deploy:

```sh
npx supabase login
npx supabase functions deploy workspace-members --project-ref YOUR_PROJECT_REF --import-map supabase/deno.json --no-verify-jwt
```

The gateway flag accommodates JWT signing-key configurations; **the function itself still rejects missing/invalid JWTs and non-admins** before using a privileged client. No service key is accepted from browser request bodies. Authenticate CLI login yourself; never paste access tokens or SMTP credentials into chat.

Existing confirmed Auth accounts are reused and approved without sending a new invitation; they can request a normal login link. Pending/new accounts receive an invitation. Auth/email and membership writes are not transactional: failed approval is reported and can be retried after the cooldown. A resolved account without membership has no band access. Use **Verificar acesso** if an invitation is opened before membership provisioning completes.

## 5. Initial Administrator

After configuring SMTP and templates, use Supabase Authentication > Users > Invite User to invite **mt.peresn@gmail.com**, with redirect URL `http://127.0.0.1:5174/auth/confirm?next=admin` (or the production equivalent). If this account already exists, preserve its UUID and make sure it supports email-link login rather than recreating it.

Run `supabase/bootstrap-admin.sql` in the trusted SQL Editor. It resolves exactly that account and the `sardinhas-nomades` band, assigns `admin`, and preserves existing roles. It is rerunnable and fails if the account or band is missing. It does not create or auto-confirm Auth users, and no public email-comparison rule grants administrator rights.

Click the invitation or request a login link at `/admin`. Add musicians using **Convidar músico**. Owner/admin can administer memberships; owner/admin/musician can read, upload and delete PDFs. Finance-only members cannot access music. Role editing, member removal, last-owner protection, and the broader CMS are not implemented; the other admin entries remain placeholders.

## Frontend Configuration

Configure `.env` using `.env.example` and restart Vite when values change. Existing `SUPABASE_PUBLIC_URL` and `SUPABASE_PUBLIC_ANON_KEY` names are supported, as are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Only public URL/key are explicitly exposed by the build. Never prefix secret/service-role or SMTP keys with `VITE_`.

## PDF Workflow and Limits

Open `/music`, sign in, select your band, enter title/instrument, and upload a PDF up to 20 MB. Search by title, instrument or filename. Click a title to preview in the browser's native PDF reader, download using the download icon, or confirm deletion. Native PDF controls vary by browser; a standalone maintained PDF viewer with consistent zoom/navigation/performance controls remains future work. Signed URLs expire after five minutes; use Reopen PDF to renew. Already-issued signed links may remain usable until expiry after membership revocation. Do not share these bearer links.

Client checks validate extension, MIME, size and PDF header. The bucket enforces MIME and size server-side, but these are not malware/content validation. Add server-side PDF inspection/quarantine before accepting untrusted contributors. File upload and metadata insert are not transactional: failed metadata saves attempt cleanup and report cleanup failure; deletion reports partial failure for retry. Inspect orphaned objects operationally. No public sample files or fake private data are shipped.

## Verification Before Real Data

- Run `npm run build` and scoped ESLint for the new files.
- Typecheck and run the backend tests without changing app dependencies:

```sh
npx --yes --package=deno deno check --config supabase/deno.json supabase/functions/workspace-members/index.ts
npx --yes --package=deno deno lint --config supabase/deno.json supabase/functions/workspace-members supabase/tests
npx --yes --package=deno deno test --config supabase/deno.json --allow-read --allow-env --allow-sys supabase/functions/workspace-members/handler_test.ts supabase/tests/workspace_access_test.ts
```

- The isolated PGlite test exercises migrations, RLS, bootstrap and throttling, but does not emulate Supabase's whole Auth/Storage server or prove hosted SMTP delivery.
- Verify actual delivered administrator/invitation/login emails, link acceptance in a second browser, expired/reused links and direct navigation.
- Verify that a musician, invalid JWT and another band's administrator cannot invoke privileged member operations.
- Sign in with an approved account, restore a session after refresh, upload/view/download/delete a sample PDF, and sign out.
- Repeat with an unapproved account and a finance-only membership: no sheet rows, file listing, uploads, downloads or deletion should succeed.
- Use two accounts in different bands and make direct REST and Storage requests with each JWT. Cross-band SELECT must return no rows; INSERT must fail; DELETE must not remove data. Object list/read/upload/delete must be denied outside the caller's band.
- Remove membership using SQL and verify new requests are denied, including previously visible rows. Previously issued signed links remain usable only until expiry.
- Reject a non-PDF and an over-20-MB file. Check 375px and desktop layouts and native viewer fallback on mobile.

The SQL and real authenticated workflow must be verified against your Supabase project before treating this as production-ready. No migrations are executed automatically by the frontend.

Remain on the Supabase Free plan while within its storage/database/bandwidth allowances. Free projects can pause after inactivity and have no automatic backups; retain independent PDF/data backups. Email-provider limits and delivery are separate from Supabase's free quota.