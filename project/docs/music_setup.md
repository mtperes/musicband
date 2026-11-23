# Music and Password Authentication Setup

## Chosen Flow

Supabase manages identity, passwords, band permissions and private PDFs. An administrator creates approved password accounts from `/admin`. Members enter their username and password at `/music` or `/admin`. New accounts are confirmed by the trusted Admin API; no email confirmation, SMTP sender or magic link is needed. There is no public signup UI.

`admin` is a login alias for `mt.peresn@gmail.com`, not a frontend permission bypass. Other usernames map to internal identifiers under `members.sardinhas-nomades.invalid`; these are not mailboxes. Usernames are lowercase, 3-64 characters, start with a letter or number, and allow letters, numbers, dots, underscores and hyphens. Existing email addresses can still be used as usernames. Database roles, not the username, grant access.

Google login has been removed from the frontend. The unrelated public Google Calendar ICS feed stays. Keep existing Auth account IDs during provider transition; do not delete users or their music records. Disable unused identity providers after verifying password access; this does not revoke previously issued sessions. Previously issued email links can still use the existing callback route.

## 1. Database and Storage

Apply these migrations in order, once, using the Supabase SQL Editor or CLI:

1. `supabase/migrations/202611100001_music_library.sql`: bands, memberships, sheet metadata, private storage and RLS.
2. `supabase/migrations/202611100002_member_invites.sql`: service-only member lookup/list/approval and atomic invitation throttling.
3. `supabase/migrations/202611110001_member_profiles.sql`: admin-only member profiles and the combined profile/account directory.
4. `supabase/migrations/202611110002_member_active.sql`: active membership, access enforcement, and authenticated member list/status RPCs.

Review existing tables before applying; back up existing data. The frontend never applies migrations automatically. The initial band is seeded, but no account automatically becomes administrator.

### Import Member Profiles

After all four migrations, run the local `supabase/seed-members.sql` in the trusted SQL Editor to import the four supplied profiles. This file contains private contact and health details, is ignored by Git, and is not bundled into the frontend. Rerunning it does not duplicate records or overwrite later edits. Birth dates use ISO dates converted from day/month/year. Source timestamps have no supplied timezone and are preserved as timestamp-without-timezone values; new profile timestamps default to UTC.

The directory shows Timestamp, Nome, Data de Nascimento, Tamanho de camisa, Instrumento, Endereço, Telefone, Contato de Emergência, e-mail, Instagram and allergy answers, plus login-access status. Importing a profile does not create an Auth account, set a password or grant membership. Existing band accounts are joined by email, so the administrator's profile does not produce a duplicate row. Profile-only records display **Sem acesso** until approved login access exists.

Profile data is readable only by admins/owners of that band; musicians and other bands cannot read addresses, birth dates, emergency contacts or allergy answers. The add-member form captures these fields and an initial password. Server validation restricts fields and writes to the verified band. Profile-save failures report that account access may already have been approved.

### Active Membership

The **Ativo** checkbox updates `band_members.active` for that band. Existing memberships default to active when the migration is applied. Only an active admin/owner in the same band may change the flag, and an administrator cannot deactivate their own membership. Imported profiles without a login account have a disabled unchecked control. Roles are preserved when toggling status; approving an existing inactive account does not silently reactivate it.

Inactive memberships are excluded from workspace access. Database RLS denies new sheet and storage reads, uploads and deletions, and inactive admins cannot view private profiles or administer members. Authentication itself can still succeed: the status restricts band access, not the entire Supabase account. Previously signed PDF links may remain valid until their five-minute expiry. Status changes do not forcibly sign out another browser; new backend requests are denied immediately, and refreshing the page rechecks membership.

Listing uses the authenticated `get_workspace_members` RPC; toggling uses `update_workspace_member_active`. Both derive the acting user from `auth.uid()` and enforce the band-specific active admin role. They do not accept an actor identity from the browser and do not depend on the Edge Function's CORS configuration.

## 2. Password Authentication Settings

In Supabase Authentication settings, enable the Email/password provider and disable **Allow new users to sign up**. Trusted Admin API account creation still works. Disable anonymous authentication and unused identity providers. Public signup must be disabled on the server, not merely hidden in the UI.

New accounts are created with `email_confirm: true`, so members never need to confirm email. Global email verification can remain enabled. Existing unconfirmed accounts must be configured by a trusted administrator before approval. Existing confirmed accounts are approved without changing their UUID or password, including accounts belonging to another band.

Passwords must be 8-128 characters and meet the configured Supabase password policy. Share initial member credentials privately. Passwords are verified and stored by Supabase; they are not stored in music tables or compared in frontend code.

The endpoint enforces one account-creation request per band administrator every 60 seconds. Password login is also subject to Supabase server-side Auth rate limits.

## 3. URLs and Existing Links

The current development origin is `http://localhost:5181`. Production must use HTTPS. Local and production should use separate Supabase projects when possible. Deploy the SPA with an index fallback for direct `/music`, `/admin` and legacy `/auth/confirm` requests.

No redirect allowlist or email-template setup is required for password login. `/auth/confirm` remains for previously issued links; it verifies supported tokens, clears them from the URL, and only redirects to `/music` or `/admin`. Avoid analytics or token logging on that legacy callback page.

## 4. Deploy Member Administration

The Edge Function authenticates the caller with `getUser` and requires an owner/admin membership in the selected band. Database functions recheck the administrator role. The browser cannot write memberships or call service-only lookup/approval RPCs. New accounts receive `musician` while preserving existing roles. Only members of the selected authorized band are returned. The endpoint accepts `list` and `create`; `create` requires an email identifier and initial password.

Supabase-hosted functions provide `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Configure these additional function secrets in the dashboard or CLI (they are configuration values, not frontend variables):

```text
AUTH_ALLOWED_ORIGINS=http://localhost:5181,http://127.0.0.1:5181
```

Use the actual frontend origin; comma-separate multiple permitted origins. `AUTH_SITE_URL` is no longer required by password provisioning. For production, restrict allowed origins to the production HTTPS origin. Authenticate the CLI yourself, then deploy:

Origins include scheme, hostname and port: `http://localhost`, `http://localhost:5181` and `http://127.0.0.1:5181` are different origins. Do not use a wildcard to fix access. If OPTIONS returns `404` with `Requested function was not found`, deploy the function first; the browser can report this missing endpoint as a CORS preflight error. Only account creation still uses the Edge Function; listing and active-status updates use authenticated database RPCs after the fourth migration.

```sh
npx supabase login
npx supabase functions deploy workspace-members --project-ref YOUR_PROJECT_REF --import-map supabase/deno.json --no-verify-jwt
```

The gateway flag accommodates JWT signing-key configurations; **the function itself still rejects missing/invalid JWTs and non-admins** before using a privileged client. No service key is accepted from browser request bodies. Authenticate CLI login yourself; never paste access tokens or SMTP credentials into chat.

Existing confirmed Auth accounts are reused and approved without replacing passwords. New accounts are created and confirmed without email. Unconfirmed existing accounts are rejected for trusted administrator setup. Auth and membership writes are not transactional: failed approval is reported and can be retried after the cooldown. An account without membership has no band access. Use **Verificar acesso** after an administrator changes membership.

## 5. Initial Administrator

After applying both migrations, run the trusted local setup command:

```sh
npm run setup:admin -- --test
```

It sets username **admin**, password **admin123**, confirms the account without email and grants the band's `admin` role. It preserves an existing account UUID and roles. The weak test password is only enabled by the explicit `--test` flag; never use it on a public or production deployment. For a non-testing password, set `WORKSPACE_ADMIN_PASSWORD` locally and run `npm run setup:admin` without `--test`.

The command loads ignored local environment files and requires a project URL (`SUPABASE_URL`, `SUPABASE_PUBLIC_URL` or `VITE_SUPABASE_URL`) and a server-only credential (`SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`). Never prefix server keys with `VITE_` or paste them into chat. Setup is rerunnable and reports partial failures. A `PGRST205` error mentioning `public.bands` means the required tables are unavailable in the selected project.

Alternatively, create or update **mt.peresn@gmail.com** with a password and confirmed email using trusted Supabase administration, then run `supabase/bootstrap-admin.sql` in the SQL Editor. The SQL script only assigns the role; it does not create users or set passwords. It is rerunnable and preserves existing roles. No public email-comparison rule grants administrator rights.

Sign in at `/admin` and add musicians using **Criar músico**, providing a username and initial password. Active owner/admin memberships can create and approve members; active owner/admin/musician memberships can read, upload and delete PDFs. Finance-only or inactive members cannot access music. Use **Ativo** to enable or disable a member's band access. Password resets, role editing, member removal and the broader CMS are not implemented in the app; use trusted Supabase administration for those operations. The other admin entries remain placeholders.

## Frontend Configuration

Configure `.env` using `.env.example` and restart Vite when values change. Existing `SUPABASE_PUBLIC_URL` and `SUPABASE_PUBLIC_ANON_KEY` names are supported, as are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Only public URL/key are explicitly exposed by the build. Never prefix secret/service-role or SMTP keys with `VITE_`.

## Repertoire and Setlists

After the existing migrations, apply `supabase/migrations/202611120002_songs_repertoire.sql`, then `supabase/migrations/202611120003_setlists.sql` in the trusted SQL Editor or CLI. Run `supabase/seed-songs.sql` first and `supabase/seed-setlists.sql` second. These are manual setup steps; the frontend does not execute SQL. The setlist seed fails if any of its songs are missing rather than creating a partial concert list.

The initial setlist is **Brasilidades - Lavagem das Escadas de Sto Antonio 26**, with the 17 supplied songs in concert order, starting with Emoriô and ending with Verdinha. Rerunning the setlist seed does not duplicate it or overwrite subsequent edits. Rerunning the repertoire seed updates the existing songs and links without changing their setlist positions.

At `/music`, **Setlists** is the default view; **Repertório** and **PDFs** retain the complete song catalog and private PDF library. Choose a setlist and instrument to open the existing instrument links directly. Songs without a matching part remain visible in concert order and show an unavailable label. External Drive/MuseScore links retain their provider permissions; the app does not grant access to those files.

Active owners, admins and musicians can create, rename, delete and edit shared band setlists. Search the repertoire to add songs, use the arrow controls to reorder, and save or cancel. Repeated songs are allowed; each setlist requires a title and 1-200 entries. Edits are saved atomically by `save_setlist`, which checks access and song ownership on the server. All songs must belong to the same band. RLS denies anonymous, inactive, finance-only and cross-band access. Deleting a setlist never deletes repertoire songs or their tabs. Concurrent edits use last-save-wins; there is no collaborative conflict resolution yet.

Focused database verification:

```sh
npx --yes --package=deno deno test --config supabase/deno.json --allow-read --allow-env --allow-sys --filter "setlists preserve" supabase/tests/workspace_access_test.ts
```

## PDF Workflow and Limits

Apply `supabase/migrations/202611120004_song_sheets.sql` after the setlist migration. It adds optional song associations to the existing private PDF records. Existing PDFs stay unassociated until a member links them; song titles are never used to guess an association. A composite foreign key requires the PDF and song to belong to the same band. Only one PDF per song/instrument is allowed, ignoring instrument casing and surrounding spaces. A linked PDF must have an instrument. Active music members may change only the association and instrument, not storage paths or upload ownership.

Open `/music`, sign in, select your band, then use **PDFs** to upload a PDF up to 20 MB. Choose its repertoire song and instrument, or leave it unassociated for general library use. Existing library PDFs can be associated or unlinked using their association form. To replace a part, unlink the previous PDF first, then link the replacement. No files are automatically removed by relinking. Search by title, instrument or filename. The library's title preview remains the native browser viewer; download and confirmed deletion remain available. Signed library-preview URLs expire after five minutes; use Reopen PDF to renew. Already-issued signed links may remain usable until expiry after membership revocation. Do not share these bearer links.

### Performance Mode

In **Setlists**, choose a setlist and tap **Tocar setlist**. The modal fills the window on phones, tablets and desktops, with optional native fullscreen and a top-left back arrow returning to setlists. At widths below 1024px, the document starts 8px below the measured header so scores cannot sit behind its buttons, including after device rotation. Desktop keeps the full-height viewport with a white song title and adjacent source label. Overlay bars remain transparent; individual controls stay opaque for readability. Local PDF content has measured scroll insets so the first/last page and page jumps remain reachable around the controls. Choose one instrument; the reader keeps every song in concert order, including repeated songs and entries without a matching PDF. Large bottom controls move between songs, while the song drawer jumps directly to an entry without source badges. PDF page controls are separate from song navigation. Left/right keyboard arrows navigate songs when focus is on the score surface, not a form control. Escape closes the drawer first, then the reader. A screen wake lock is requested while the reader is open, when supported and permitted by the browser.

The lazy-loaded `react-pdf`/PDF.js viewer provides fit-to-width, bounded 75%-250% zoom, continuous page scrolling, page selection, and loading/error/retry states. Normal browser pinch zoom remains available where supported; there is no custom pinch gesture or swipe-to-change-song behavior. Page one remains mounted; later pages render near the viewport. PDF.js worker, character maps, fonts and WASM codecs are bundled locally. Document/page Suspense is explicitly disabled so page loading cannot suspend the navigation or reset the reader cache.

Scores are downloaded through authenticated Supabase Storage requests. Only the current and next PDF blobs are retained in the reader's memory cache; the next score is prefetched after attempting the current one. The cache is discarded on exit and is not an offline-download feature. Already downloaded data remains readable during that session even if membership is subsequently revoked; new storage requests still require access. No signed PDF URL or PDF contents are written to local storage. Only versioned song position and instrument preferences are stored locally, scoped to user, band and setlist. Invalid or outdated saved positions fall back safely.

Uploaded and associated PDFs take priority. If none exists for the selected song/instrument, an existing Google Drive file link opens in an embedded Drive preview while retaining the reader's song navigation. A desktop-only source label appears beside the title; mobile hides it. Open-original links remain removed from the reader. Drive sharing permissions and Google sign-in still apply; source links remain available in the repertoire and setlist views outside performance mode. These previews use Google's controls, not the local PDF.js zoom/page controls, and are not cached or prefetched by the app. Google controls its own embedded interface, which the app cannot restyle. No privileged proxy or automatic file copying is used.

Drive folders and MuseScore pages remain external source links because they do not identify a directly previewable Drive file. The PDF-association migration adds relationships but does not download the repertoire's external files or link existing unassociated uploads automatically. For a folder or unsupported source, choose a specific Drive file link or upload an authorized PDF in **PDFs**, select its song/instrument and save the association. Associate local PDF copies before relying on consistent PDF.js controls during a performance.

Run the focused checks:

```sh
npm run test:music
npx playwright install chromium
npm run test:music:browser
```

The twelve browser checks use synthetic scores, mocked Drive frames and an isolated mock Supabase client, verify nonblank canvas pixels, and cover 1280x900, 820x1180, 375x812 and 812x375 layouts. They exercise page/song navigation, zoom, fullscreen or fallback, drawer focus, progress restoration, instrument changes, failed-download retry, PDF relinking, upload metadata, Drive fallback, uploaded-PDF priority and folder-link handling. SQL access tests separately cover same-band links, duplicate parts, restricted update fields and inactive/cross-band denials. Hosted migrations, real Storage delivery, actual Drive permissions/embedding, native iOS/Android gestures/fullscreen/wake lock, and physical-device readability still require acceptance testing. Offline downloads, auto-scroll and pedal mapping are deferred.

Client checks validate extension, MIME, size and PDF header. The bucket enforces MIME and size server-side, but these are not malware/content validation. Add server-side PDF inspection/quarantine before accepting untrusted contributors. File upload and metadata insert are not transactional: failed metadata saves attempt cleanup and report cleanup failure; deletion reports partial failure for retry. Inspect orphaned objects operationally. No public sample files or fake private data are shipped.

## Verification Before Real Data

- Run `npm run build` and scoped ESLint for the changed files and `scripts/setup-admin.mjs`.
- Typecheck and run the backend tests without changing app dependencies:

```sh
npx --yes --package=deno deno check --config supabase/deno.json supabase/functions/workspace-members/index.ts
npx --yes --package=deno deno lint --config supabase/deno.json supabase/functions/workspace-members supabase/tests
npx --yes --package=deno deno test --config supabase/deno.json --allow-read --allow-env --allow-sys supabase/functions/workspace-members/handler_test.ts supabase/tests/workspace_access_test.ts
```

- The isolated PGlite test exercises migrations, RLS, bootstrap and throttling, but does not emulate Supabase's whole Auth/Storage server or prove hosted SMTP delivery.
- Verify real administrator password login, new member creation, member username/password login without email, invalid-password rejection and direct navigation.
- Verify that a musician, invalid JWT and another band's administrator cannot invoke privileged member operations.
- Sign in with an approved account, restore a session after refresh, upload/view/download/delete a sample PDF, and sign out.
- Repeat with an unapproved account and a finance-only membership: no sheet rows, file listing, uploads, downloads or deletion should succeed.
- Use two accounts in different bands and make direct REST and Storage requests with each JWT. Cross-band SELECT must return no rows; INSERT must fail; DELETE must not remove data. Object list/read/upload/delete must be denied outside the caller's band.
- Remove membership using SQL and verify new requests are denied, including previously visible rows. Previously issued signed links remain usable only until expiry.
- Reject a non-PDF and an over-20-MB file. Check 375px and desktop layouts and native viewer fallback on mobile.

The SQL and real authenticated workflow must be verified against your Supabase project before treating this as production-ready. No migrations are executed automatically by the frontend.

Remain on the Supabase Free plan while within its storage/database/bandwidth allowances. Free projects can pause after inactivity and have no automatic backups; retain independent PDF/data backups. Email-provider limits and delivery are separate from Supabase's free quota.