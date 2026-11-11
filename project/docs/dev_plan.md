# Collective Development Plan

## Product Objective

Collective is a customizable, responsive online self-management platform for independent artists and bands. Its defining value is bringing a band's public website together with the private tools its members use to run their work. Sardinhas Nômades is the first band using the platform and the reference instance for product decisions; the data model and content tools should support additional bands without copying the application.

The product has two connected areas:

- **Public presence:** a band's website with its profile, media, events, calendar, and contact information.
- **Private workspace:** authenticated tools for band members to manage content, setlists and music sheets, finances, and shared band resources.

The first release should make the public site manageable and deliver the member workflows with the highest day-to-day value. Fan-following/community features, payments, a store, and event notifications are later extensions, not prerequisites for that release.

## Current State

Verified in the repository as of November 10, 2026:

- React 19, TypeScript, Vite, and Tailwind CSS 4 are in use.
- The public single-page site has a hero, band bio and photo carousel, calendar, event descriptions, image carousel, contact form UI, and footer.
- The navigation has a desktop menu and a mobile dropdown.
- Calendar events are loaded from an ICS feed through `useCalendarEvents`; mock calendar mode is available.
- Basic responsive styles, responsive navigation behavior, font imports, and a global image max-width rule exist.

The photo carousel is the public image gallery. A separate Videos page/section for YouTube embeds is planned; it is not a replacement for the photo gallery, and no dedicated Videos experience is present in the current code. Other features not verified in the repository include a working contact-form submission workflow, CMS, authentication, private member space, persistent theme preferences, accounting, inventory, donations, store, fan accounts, or notifications. Treat these as planned work, not existing functionality.

## Scope and Decisions

**First release:** a reusable public site, an admin-managed content workflow, secure member access, setlists and music-sheet viewing, and basic band finances and inventory. The public site and member workspace may share one application, but permissions and data boundaries must be enforced by the backend, not only by route visibility.

**Later release:** public video discovery, fan accounts and following, donations/store integrations, and opt-in event notifications. Google Meet/rehearsal integration is exploratory and should be prioritized only after the core workflows are in use.

**Architecture guardrails:**

- Keep React, TypeScript, Vite, and the existing design system unless a concrete requirement motivates a change.
- Select one managed backend after comparing authentication, relational data, file storage, access policies, cost, and operational needs. Supabase is a reasonable first candidate; Firebase remains an alternative, not a parallel implementation.
- Avoid introducing a client state library or custom API server before a specific workflow needs one.
- Use backend-managed authentication and authorization. Do not implement a hand-rolled session-token table in the browser app.
- Every band-owned record and uploaded file must be scoped to a band/workspace. Enforce that boundary in backend policies and verify it with cross-workspace access tests.
- Keep payment card data with the payment provider; the application should store provider references and transaction status only.

## Roadmap

Task numbers are global and stable for progress tracking. A task is checked only when the behavior is implemented, not merely scaffolded. Phase completion requires its deliverable and acceptance checks, not just checked boxes.

### Phase 0: Product and Technical Foundation

**Deliverable:** an agreed MVP, user roles, backend choice, and data/access model before protected data is introduced.

- [x] 1. Confirm first-release users and workflows: public visitor, band owner/admin, musician, and finance manager; define which roles may view or change each resource.
- [x] 2. Write acceptance criteria for public content management, setlists/sheets, accounting, and inventory; distinguish required release scope from later ideas.
- [x] 3. Evaluate Supabase and Firebase against the data relationships, authentication, storage, access-control, backup, cost, and deployment needs; record one selected backend.
- [x] 4. Define the workspace model: band identity, public slug, member roles, ownership/invitations, and how each record belongs to one band.
- [x] 5. Document environment configuration, local development, mock data, and deployment assumptions without committing secrets.

#### Phase 0 Decisions

**MVP users and permissions**

| User | Access |
|---|---|
| Public visitor | Read published band profile, events, photo gallery, Videos page, and public contact links. No access to member data. |
| Band owner/admin | Manage band settings, public content, members, roles, and all band workspace data. At least one owner must remain assigned. |
| Musician | View band events and manage setlists, songs, and music sheets. No access to financial records unless separately granted. |
| Finance manager | Manage transactions, inventory, and financial reports. May also hold another role. |

Roles are independently assignable to a band membership, so a member may be both musician and finance manager. The owner/admin role grants workspace administration; public visitors do not need accounts for public content.

**First-release acceptance criteria**

- An authorized editor can create and update a band's profile, events, photo gallery, and YouTube videos, preview changes, and publish them to that band's public site.
- A public visitor can browse a band's published site without signing in. The photo carousel remains separate from the dedicated YouTube Videos experience.
- Invited band members can sign in; workspace tools enforce the member's assigned roles.
- Musicians can create and arrange setlists and open their associated music sheets in the viewer.
- Authorized finance users can record transactions and inventory and produce a period summary using documented calculation rules.
- Tests confirm that signed-out users, wrong-role members, and members of another band cannot read or change private records or files.
- Public and private workflows pass the responsive, accessibility, and release-readiness gates defined below.

Fan accounts/follows, public user-generated posts, donations, store/fulfillment, event notifications, and rehearsal meeting links are explicitly outside the first-release acceptance criteria.

**Backend decision: Supabase**

Use Supabase as the initial managed backend. The platform's core records (bands, memberships, events, setlists, transactions, and inventory) are relational; PostgreSQL constraints and queries fit these relationships and reporting needs. Supabase also provides managed authentication, file storage, and row-level security in one service. Firebase was considered, but its document-oriented model is a less direct fit for relational reporting and cross-entity role/workspace rules. This is a product-fit decision, not approval of a production plan: confirm current pricing, region availability, backup/restore, quotas, and data-retention requirements before launch.

**Workspace and data boundary**

- A `band` is the tenant/workspace, with an internal ID and unique public slug.
- A user may belong to multiple bands. Each membership is scoped to one band and can carry multiple roles; owners/admins manage membership and band settings.
- Every band-owned row and private storage object is associated with that band's ID. Public queries expose only published public fields; private workspace data is never made public by route configuration alone.
- Enforce membership and role checks in Supabase Row Level Security and storage policies. Include cross-band and wrong-role tests before adding real data.
- Keep payment-provider details and secrets outside the app's public data model; no payment card data is stored in Collective.

**Local development and environment assumptions**

- Existing commands: `npm run dev`, `npm run dev:mock`, `npm run build`, and `npm run lint`.
- `.env.local` is ignored by the existing `*.local` rule; `token.env` is also ignored. No `.env.example` currently exists.
- When the backend is introduced, add a placeholder-only `.env.example` and use `.env.local` for local values. Only intentionally public Supabase URL and publishable/anon key may use Vite's `VITE_` prefix; never put the Supabase service-role key or other secrets in frontend variables.
- Use separate Supabase projects/configuration for development and production. Keep mock calendar mode independent from backend authentication/data and do not treat mock mode as a production fallback.
- No backend project, credentials, migrations, or client SDK have been created as part of Phase 0.

### Phase 1: Public Website and Responsive Baseline

**Deliverable:** the existing Sardinhas Nômades website is usable on small, medium, and large screens and presents content reliably.

- [x] 6. Establish the React, TypeScript, and Vite application shell and render the public site.
- [x] 7. Build the public-page sections for band profile, calendar, event descriptions, photo content, contact form UI, and footer.
- [x] 8. Provide desktop navigation and a mobile menu with open/close behavior.
- [x] 9. Load the current display/body fonts, apply a global image width constraint, and provide basic responsive text/button styles.
- [x] 10. Test and correct overflow, spacing, readable type, touch targets, and section flow at narrow phone, tablet, and desktop widths; verified 320x568, 375x812, 820x1180, and 1366x768.
- [x] 11. Make hero media fill mobile viewport behavior, keep parallax reduced for reduced-motion preferences, and preserve requested banner/background playback.
- [x] 12. Check bio, event descriptions, carousel, calendar, and contact form layouts at each breakpoint; replace brittle fixed dimensions where they cause clipping or overlap.
- [ ] 13. Give the contact form a defined outcome: send through a backend email provider to the agreed public inbox, with validation, success, and failure states. Provider selection and backend setup are pending.
- [x] 14. Add accessible names/alt text, keyboard operation, visible focus, and appropriate heading order across the public page.
- [x] 15. Add loading, empty, and error states for public calendar and media content so failed requests do not silently remove whole sections.
- [ ] 16. Verify image/video loading cost and defer non-critical media; preserve a usable experience when autoplay is unavailable.

**Open media follow-up:** the production build reports `banner-video.mov` at about 146 MB and the event photos at about 14 MB and 13 MB. The banner uses the existing 2.8 MB MP4 on mobile and browsers without QuickTime stream support, and retains the MOV where supported. Event-card images are lazy-loaded; the restored CSS background-image carousels are not. Preserve the intended footage, obtain optimized exports, and add deferred carousel image loading before public launch.

**Contact form status:** the recipient inbox has been provided, but the email provider was deferred. The form is intentionally disabled with an explanation until a backend delivery path is configured; do not mark task 13 complete until successful and failed sends are tested.

### Phase 2: Backend, CMS, and Public Content

**Deliverable:** an authorized band editor can update public content and see those changes on that band's public site.

- [ ] 17. Set up the selected backend project and separate development/production configuration; keep credentials out of source control.
- [ ] 18. Define and migrate the core data model for bands, public profiles/pages, events, media, members, and content ownership; add validation and timestamps.
- [ ] 19. Create the first band/workspace and a safe seed/import path for the existing Sardinhas Nômades content.
- [ ] 20. Build an admin content workflow for profile text, contact links, images, event descriptions, and published/unpublished state.
- [ ] 21. Connect calendar/event management to the public calendar; decide whether ICS remains the source of truth or becomes an import/export integration.
- [ ] 22. Add media upload rules for allowed types, size limits, metadata, storage paths, and removal; ensure one band's files cannot be listed or fetched by another band.
- [ ] 23. Make public pages load content by band slug and return a deliberate not-found state for unknown or unpublished bands.
- [ ] 24. Add a preview/publish workflow so editors can review changes before they become public.
- [ ] 25. Verify that public visitors can read only published public fields and cannot access admin operations or private member data.

### Phase 3: Identity and Private Workspace

**Deliverable:** band members can sign in and use role-limited private tools without exposing another band's data.

**Implementation update:** Supabase email-link login replaces Google OAuth. Shared session/membership guards protect `/music` and `/admin`; a token-hash callback accepts login/invitation links. The admin member list and musician invitations use a JWT-validated Edge Function with service-only scoped SQL helpers and invitation throttling. A rerunnable trusted bootstrap script targets `mt.peresn@gmail.com`. Build, scoped lint and isolated backend tests are available; SMTP configuration, hosted migrations, function deployment, initial admin provisioning and real delivered-link verification remain activation requirements. See `docs/music_setup.md`. Broader CMS, role editing/removal and production acceptance gates remain pending; the public Google Calendar feed is unchanged.

- [ ] 26. Implement sign-in, sign-out, session restoration, password recovery, and invite acceptance using the selected backend's supported flow.
- [ ] 27. Define roles and permissions for owner/admin, musician, and finance manager; document whether one member may hold multiple roles.
- [ ] 28. Build protected workspace navigation for `/admin` and `/music`, plus `/accounting` when that area is implemented; redirect unauthenticated users without losing their intended destination. `/band` remains a compatibility redirect to `/music`.
- [ ] 29. Implement backend access policies for every private table and storage object, scoped by band membership and role.
- [ ] 30. Add member invitation, role change, and removal flows; prevent removal of the last owner and revoke removed members' access.
- [ ] 31. Add a band settings page for name, public slug, locale/time zone, currency, and basic branding.
- [ ] 32. Add clear loading, expired-session, permission-denied, and backend-error states to private routes.
- [ ] 33. Test direct URL access and API/storage requests for signed-out, wrong-role, removed-member, and cross-band cases.
- [ ] 34. Add an accessible global theme preference only if a real light/dark theme is defined; persist the choice and respect the operating-system preference by default.

### Phase 4: Musician Tools

**Deliverable:** members can prepare a setlist and reliably read the correct music materials during rehearsal or performance.

- [ ] 35. Define setlist and song fields, including ordering, key, tempo, notes, instrument, and optional date/venue; validate required and optional values.
- [ ] 36. Build setlist list/detail views with create, edit, duplicate, delete, search, and stable song reordering.
- [ ] 37. Build a song library and add existing songs to a setlist without duplicating their underlying records.
- [ ] 38. Support instrument-specific sheet attachments and notes, with clear file ownership and replacement/removal behavior.
- [ ] 39. Add an in-browser PDF viewer with loading/error states, bounded zoom, fit-to-width, and page navigation; choose a maintained viewer compatible with the app.
- [ ] 40. Add a clean performance mode with fullscreen support, keyboard-accessible controls, and a reliable way to exit fullscreen.
- [ ] 41. Add optional auto-scroll with start/pause/reset and speed control; keep it off until explicitly enabled.
- [ ] 42. Add mock/example setlists and verify the musician workflow on mobile, tablet, and desktop without using real private data.
- [ ] 43. Verify PDF uploads against configured type/size limits and test that unauthorized members cannot fetch another band's sheets.

### Phase 5: Accounting and Inventory

**Deliverable:** authorized members can record band finances and assets and produce a trustworthy period summary.

- [ ] 44. Agree on currency, rounding, date/time-zone rules, categories, and whether balances represent cash flow, reimbursements, or member shares before implementing calculations.
- [ ] 45. Define income, expense, transfer, reimbursement, and inventory-item records with audit metadata and band ownership.
- [ ] 46. Build transaction create/edit/delete and filtering by date, type, category, and member; require confirmation for destructive actions.
- [ ] 47. Show period totals, category breakdown, and member balances with explicit calculation rules and tests for edge cases.
- [ ] 48. Build the band asset inventory with item details, status, purchase/value fields, custodian, and history where useful.
- [ ] 49. Generate a printable/downloadable monthly summary and a shareable email draft; do not expose private reports through public URLs by default.
- [ ] 50. Test calculations, currency formatting, permissions, and export output against known sample data before using real financial records.

### Phase 6: Videos Page, Community, and Revenue Extensions

**Deliverable:** the public site has a dedicated YouTube Videos experience alongside its photo carousel. Fan/community and revenue features remain optional extensions and must not delay the core member workflows.

- [ ] 51. Build a dedicated Videos page/section for YouTube embeds, backed by managed video records with title, category, and publish status; include responsive playback, useful browsing/search, and navigation from the public site. Keep it separate from the existing photo carousel.
- [ ] 52. Decide whether audience accounts and a membership directory are needed; define privacy, discoverability, blocking/reporting, and account deletion before building fan profiles or follows.
- [ ] 53. If fan contributions are enabled, add moderation, reporting, consent, and retention controls before publishing user-generated content.
- [ ] 54. Choose a donation/payment provider and define country/currency, fees, refunds, webhook verification, and failure states; store no card details in Collective.
- [ ] 55. Validate fan-store scope and fulfillment responsibilities before integrating a commerce provider; keep order and payment data private and least-privileged.
- [ ] 56. Define event notification preferences, opt-in/opt-out, channel, and delivery limits before implementing notifications.
- [ ] 57. Evaluate Google Meet/rehearsal links as a small integration only after calendar ownership and permissions are clear; do not make video-call hosting part of the platform MVP.

### Phase 7: Release Readiness and Operations

**Deliverable:** the platform can be deployed, maintained, and used without relying on developer-only data or undocumented manual steps.

- [ ] 58. Add automated checks for type/build, lint, core public behavior, authentication, role permissions, and backend access policies.
- [ ] 59. Complete keyboard, screen-reader, contrast, reduced-motion, and responsive checks for public and private workflows.
- [ ] 60. Add pagination or bounded queries for growing event, media, setlist, transaction, and inventory collections.
- [ ] 61. Add route-level code splitting and defer large media/PDF code where it measurably improves load time.
- [ ] 62. Configure production environment variables, domain/routing, HTTPS, storage policies, and safe error reporting without leaking private data.
- [ ] 63. Configure database/storage backups and document a restore test and retention policy.
- [ ] 64. Add user-facing privacy/contact information and document data export/deletion and account offboarding procedures.
- [ ] 65. Test deployment and recovery with a staging band and non-sensitive sample data before onboarding real members.
- [ ] 66. Run a cross-browser and real-device acceptance pass, fix release-blocking issues, and record known limitations.
- [ ] 67. Gather feedback from the band, prioritize issues by impact, and publish the next iteration plan.

## Release Gates

- **Public-site baseline:** Phases 0-1 are usable and have responsive/accessibility checks recorded.
- **Managed public site:** Phase 2 content is editable by an authorized user and public/private data boundaries are tested.
- **Private beta:** Phases 3-5 pass role and cross-band access tests, musician workflow tests, and accounting calculation checks.
- **First release:** the dedicated Videos page/section (task 51) and Phase 7 operational, privacy, accessibility, backup, and deployment checks are complete. Fan accounts, user-generated content, payments/store, notifications, and rehearsal links in Phase 6 remain out of scope unless explicitly selected.

## Progress Summary

Counts cover the 67 numbered implementation tasks. Checked items reflect functionality already found in the repository; partial implementations remain unchecked.

| Workstream | Done | To do | Total |
|---|---:|---:|---:|
| Product and technical foundation | 5 | 0 | 5 |
| Public website and responsive baseline | 9 | 2 | 11 |
| Backend, CMS, and public content | 0 | 9 | 9 |
| Identity and private workspace | 0 | 9 | 9 |
| Musician tools | 0 | 9 | 9 |
| Accounting and inventory | 0 | 7 | 7 |
| Public media, community, and revenue extensions | 0 | 7 | 7 |
| Release readiness and operations | 0 | 10 | 10 |
| **Total** | **14** | **53** | **67** |

**Overall tracked progress:** 14 of 67 tasks complete (about 21%). This is task completion, not a time estimate; task sizes vary. Supabase is selected for initial development; production cost and operational checks remain open.

Last reviewed: November 10, 2026