## Roles

Roles are additive tags. A member can have more than one, such as Musico and Producao. Adding Viewer never removes permissions supplied by another role.

| Role | Current permissions |
| --- | --- |
| Proprietario (`owner`) | Band owner: admin access plus permission to grant/remove ownership and reset another administrator's password. The band must retain an active owner. |
| Administrador (`admin`) | Manage members, roles and member passwords; read and edit music. Cannot change owner access. |
| Musico (`musician`) | Read music, upload/delete PDFs, associate scores and edit setlists. |
| Visualizacao (`viewer`) | Read-only access to Setlists, Repertorio, PDFs and the performance reader. No upload, deletion, score associations, setlist edits or member administration. |
| Producao (`production`) | Receives contact mail; other production workflows remain planned. Combine with another role for music access. |
| Financas (`finance_manager`) | Reserved for finance workflows; no music access by itself. |
| Receber e-mails (`receive_mail`) | Receives contact mail without granting music or admin access. |

## Contact email recipients

`production` receives public contact-form messages, as do active `admin` and legacy `owner` memberships. The independent `receive_mail` tag lets another active member receive messages without granting production or admin permissions. Role tags remain additive.

The server selects recipients from confirmed Auth accounts in the Sardinhas Nomades band. Inactive memberships and internal `.invalid` username identifiers are excluded. Matheus's primary destination remains `mt.peresn@gmail.com`; additional recipients are BCC so member addresses are not exposed to visitors or one another.

Receiving mail is implemented by `supabase/migrations/202611120001_contact_email.sql`. This change adds email-recipient tags only; it does not implement the other production permissions listed above.

## Editing members

The pencil action in the Admin members table opens a populated form. Email and Utilizador (username) are separate fields. Existing account emails remain read-only; the username can be changed independently. The app login accepts usernames only; email remains an internal Supabase Auth identifier and a separate member detail. Usernames are resolved server-side before Supabase Auth checks the password. Usernames contain 3 to 64 letters, numbers, dots, underscores or hyphens and are case-insensitive, globally unique aliases. Legacy usernames and the admin alias remain supported. The administrator signs in as `admin` with the current password, not the email address.

Only active owners/admins can access member password controls. The optional new-password field starts empty and never displays an existing password. Leaving it empty keeps the password; a supplied password must contain 8 to 128 characters and satisfy Supabase Auth policy. Passwords are stored only as Supabase Auth hashes, never in the member schema or API listings, even for admins. Supplying a username and password for a profile without an account creates a confirmed login with the selected roles. Profile tags alone do not grant login access.

Every member edit form includes the Funcoes role checkboxes. Account roles are stored in `band_members.roles`; profiles without an Auth account store their tags in `member_profiles.roles`. Existing account roles take precedence over profile tags when listing members. The Add Member workflow initially grants musician access; edit that member to adjust roles. Provisioning a profile from its edit form uses its selected roles directly, including Viewer.

Only active owners and administrators can save edits, and the target must belong to the selected band. Only owners can change owner access or another administrator's password. Members cannot remove their own administrator access, and a band must retain an active owner. Passwords belong to the Auth account, so changing one affects that account's login across all its bands.

Role, profile and Auth updates are separate operations, not a single transaction. If a later operation fails, the form stays open and the error identifies which earlier changes were saved. Retry after correcting the error.

### Hosted activation

The following migrations and the member function were applied/deployed to project `vgisuqtuogeuodazpirc` on 2026-11-13. Do not rerun the non-idempotent migrations there. The sequence below is for another project or a confirmed missing migration. The existing member profile and active-member migrations are prerequisites.

1. If not yet applied, run the SQL migration [202611120005_member_roles.sql](../supabase/migrations/202611120005_member_roles.sql) once in the Supabase SQL Editor for this project's database. It adds the guarded role-update functions and requires the existing member-active migration. It is not safe to rerun because it uses `create function` without replacement.
2. Run the new SQL migration [202611130001_member_profile_roles.sql](../supabase/migrations/202611130001_member_profile_roles.sql) once in the same Supabase SQL Editor. It adds profile role-tag storage and updates the member listing; it requires the existing profile and active-member migrations. It is not safe to rerun because it adds a column without `if not exists`.
3. Run [202611130002_viewer_role.sql](../supabase/migrations/202611130002_viewer_role.sql) once in the same SQL Editor, after the existing repertoire, setlist and sheet-association migrations. It adds Viewer and separates music read/write policies. It is not safe to rerun because it creates a function without replacement.
4. Run [202611130003_member_usernames.sql](../supabase/migrations/202611130003_member_usernames.sql) once next. It adds separate username and account-link fields, a private username resolver and guarded account provisioning. Existing profile/account links are backfilled by email. It is not safe to rerun because it adds columns and functions.
5. Run [202611130004_member_identity_listing.sql](../supabase/migrations/202611130004_member_identity_listing.sql) next. It corrects the identity join for hosted PostgreSQL, which rejects a FULL JOIN with alternative OR conditions. This corrective migration is safe to rerun because it replaces the function and reapplies its grants.
6. Deploy the updated [workspace-members entry point](../supabase/functions/workspace-members/index.ts) and [handler](../supabase/functions/workspace-members/handler.ts) to the same Supabase project using `npx supabase functions deploy workspace-members --project-ref YOUR_PROJECT_REF --import-map supabase/deno.json --no-verify-jwt` from the repository root. The handler itself verifies sessions and active administrator membership for every member-management action; the sign-in action verifies credentials through Supabase Auth before returning tokens. Retain the existing function configuration and secrets.

Local verification: `node --experimental-strip-types --test tests/workspaceMembers.test.ts` checks service behavior, and `npx playwright test adminMembers.spec.ts` checks the table/form workflow on desktop and mobile. Both use isolated service fixtures and do not verify or modify hosted accounts.
