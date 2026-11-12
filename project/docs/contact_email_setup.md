# Contact Form Email

## Implemented Flow

The public form posts name, email and message to same-origin `/api/contact`. A Node backend validates the request and uses the provisioned Resend Free integration. The sender and recipients are never accepted from visitor input, and API keys are never included in the frontend bundle. The visitor's address is Reply-To, not From.

Messages go to `mt.peresn@gmail.com`. In normal mode, additional active, confirmed band members with `production`, `receive_mail`, `admin` or legacy `owner` tags are included privately in BCC. The server does not return recipient addresses to the browser.

The form shows success only after Resend accepts a message. On validation, timeout, configuration or provider errors it keeps the visitor's input and displays the error. Provider acceptance is not proof of inbox delivery.

## Local Tests Before DNS

Run `npm run dev` and open the public page at the URL Vite reports. The existing server at `http://localhost:5181/#contact` supports the endpoint after the Vite configuration reloads.

Vite development mode defaults to owner-only testing with Resend's `onboarding@resend.dev` sender. It does not query member recipients or require the contact SQL migration. Requests still undergo validation and a local one-minute cooldown. Set `CONTACT_EMAIL_TEST_MODE=0` to use the normal sender and database recipient/rate-limit functions locally.

Resend permits emails from its testing sender only to the email address of the Resend account. The provisioned account rejected a real local form test addressed to `mt.peresn@gmail.com` because that is not its permitted testing address. At the owner's request, tests remain addressed to Gmail rather than substituting another inbox. No DNS records have been changed. Until the domain is verified, that real send is expected to fail and the UI will not claim success.

On Vercel, normal delivery is the default. `CONTACT_EMAIL_TEST_MODE=1` may explicitly enable owner-only testing in a non-production environment; production always ignores this test flag. Never expose the test-mode setting or a recipient override as visitor-controlled input.

## Normal Delivery After DNS Verification

The free integration is connected to `collective17/musicband` and provisioned for `notifications.sardinhasnomades.com`, using region `eu-west-1`. It provides `RESEND_API_KEY` and `RESEND_EMAIL_DOMAIN` as server variables.

Before normal delivery:

1. Verify the sending domain using the exact records shown by Resend. Website DNS and domain registration do not need to move.
2. Apply `supabase/migrations/202611120001_contact_email.sql` after the existing membership/profile/active migrations.
3. Configure server-only `SUPABASE_URL` and `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` for the Vercel Function. Local `SUPABASE_PUBLIC_URL` is also supported by the backend. Never prefix server secrets with `VITE_`, put them in chat, or commit them.
4. Deploy the code containing `api/contact.ts`. The live website is not changed merely by installing the email integration or editing local files.

Normal From is `Sardinhas Nomades <contato@notifications.sardinhasnomades.com>`. The recipient and rate-limit SQL functions are executable only by the trusted server role. They are not public RPCs.

## Recipient Tag Example

Use a trusted SQL Editor to add the independent mail tag without removing other tags:

```sql
update public.band_members as members
set roles = array(select distinct unnest(members.roles || array['receive_mail']::text[]))
from auth.users as users, public.bands as bands
where users.id = members.user_id and bands.id = members.band_id
  and bands.slug = 'sardinhas-nomades'
  and lower(users.email) = 'MEMBER_EMAIL_HERE';
```

This does not activate a disabled membership. The existing Ativo control still determines eligibility.

## Validation and Limits

The endpoint accepts JSON bodies up to 8 KB, names up to 160 characters, email addresses up to 254 characters, and messages up to 4000 characters. It rejects cross-origin submissions and a filled honeypot. Normal mode uses a persistent one-minute cooldown per sender-email hash and a global cap of 50 sends per UTC day; failure to verify limits or recipients blocks the send. Local test cooldowns are in-process and are not used as production rate limiting. For a publicly promoted site, add a server-verified CAPTCHA or platform bot controls before increasing these limits.

## Checks

```sh
npm run test:contact
npm run build
npx eslint server/contact.ts api/contact.ts src/components/Contact.tsx vite.config.ts tests/contact.test.ts
npx --yes --package=deno deno test --config supabase/deno.json --allow-read --allow-env --allow-sys supabase/tests/workspace_access_test.ts
```

The isolated tests cover fixed destinations, BCC privacy, owner-only mode, validation, provider failures, recipient tags, inactive recipients, cooldowns and daily caps. Actual inbox delivery still needs a verified sending domain and a live delivery check.