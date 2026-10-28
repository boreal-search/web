# Boreal Search: screen and state inventory

Design-agnostic checklist of every screen and state, for the look-and-feel rework. Sources: `src/routes/**`, `src/lib/answer.ts`, the web-answers handover, `architecture.md`. Items marked _(inferred)_ are not in code; _(in progress)_ screens do not exist in the repo yet, so their spec is from the brief.

Roles in code today: platform admin (global), org `owner`, org `member`. The rename to Platform admin / Org admin / Member is in progress; current UI shows raw `owner` / `member`.

## Screens

### Global shell (`+layout.svelte`)

- Who: all. Header: "Boreal" link, primary nav, user email, Log out (POST button) or "Log in" link.
- Nav items (signed in): Data sources, Search, "Manage {org name}" (one per owned org), Admin (platform admin only). Anon: no nav, only Log in.
- [ ] Anon vs signed in header; many owned orgs (nav grows); long org name / long email
- [ ] No active-page indicator exists today; no sign-out confirmation; no mobile layout (single flex row)
- [ ] In progress: add Account link, Sign up link for anon; "not in an org" state must still render nav

### Error page (`+error.svelte`)

- Who: all. Shows status code, message, "Back to dashboard" link.
- Codes raised: 403 "Platform admins only" / "Only org owners can manage members"; 404 "Data source not found" / "Org not found" / unknown route; 502 engine message (data source page); 500 generic "Something went wrong."
- [ ] 403, 404, 500, 502 variants; long message; anon 404 (link goes to dashboard, which redirects to login)
- [ ] Redirect-to-login for anon is a 303, not an error page

### `/login`

- Who: anon (signed-in users are redirected to `/`).
- Purpose: sign in by password or by emailed magic link.
- Data: `redirectTo` (same-origin relative path only, else `/`).
- Fields: Work email (required), Password (optional; blank means magic link). Button label switches: "Email me a sign-in link" / "Sign in"; busy: "Sending…" / "Signing in…".
- Actions: submit; (in progress) links to /signup and /forgot.
- [ ] Idle; submitting (button disabled)
- [ ] Success, magic link: "Check {email} for a sign-in link. You can close this tab." (form replaced)
- [ ] Validation: 400 "Enter a valid email address." (email kept)
- [ ] Wrong password: 400 with Supabase message verbatim (e.g. invalid credentials), email kept, password cleared
- [ ] Magic-link send failure: 500 with Supabase message (e.g. rate limit)
- [ ] GAP: `/auth/confirm` redirects to `/login?error=invalid_link` but the page never reads or shows it. Needs an "invalid or expired link" state
- [ ] Preserved redirect: arriving from a protected URL; no message explains why
- [ ] Redirect after success: 303 to `redirectTo`

### `/auth/confirm` (no UI; GET handler)

- Who: anyone with an emailed link. Exchanges `code` or `token_hash`+`type` (magiclink, email, signup, recovery, invite, email_change), redirects to `next` (safe path, default `/`).
- [ ] Success: lands on `next`; failure: lands on `/login?error=invalid_link` (see gap above)
- [ ] In progress: `type=recovery` should land on `/account/password`; `type=signup` should land signed in _(inferred)_

### `/logout`

- POST only, no UI; redirects to `/login`. [ ] Consider a "signed out" notice _(inferred)_

### `/` Data sources (dashboard)

- Who: member+ (any signed-in user). Anon redirects to `/login?redirectTo=…`.
- Purpose: list corpora the user's orgs can search.
- Data per row: name (link), description, status, document count, page count. Footer link "Search these data sources →".
- [ ] Loading: none shown (server load); decide on skeleton/streaming
- [ ] Engine error: red banner "Could not reach the engine: {status message | Engine unreachable}", page still renders with empty list
- [ ] Empty, no grants: "No data sources are available to your organisation yet. Ask an admin to grant your org access."
- [ ] Empty, grants exist but engine returned none (or engine down): shorter text without the "ask an admin" line
- [ ] Many items; long names/descriptions; status values are raw engine strings (values not enumerated in web code, check engine docs)
- [ ] In progress: user with no org membership gets the "not in an org yet" empty state (see below)

### "Not in an org yet" empty state _(in progress)_

- Who: signed-in user with zero memberships. Appears on `/`, `/search`, and probably `/account` access.
- Today: indistinguishable from "no grants" (same empty copy). Needs: explanation, what to do (ask for an invite / use a work email on a claimed domain), who to contact, sign out / change account.
- [ ] Applies to Data sources, Search (form disabled), and nav (no Manage links)
- [ ] Pending invite for their email is claimed only when the email is confirmed; unconfirmed user needs "confirm your email" copy _(inferred)_

### `/search`

- Who: member+.
- Purpose: query selected corpora, optionally draft a cited, verified answer.
- Inputs: Query (required, search input); Data sources checkboxes (name + page count; all ticked by default, last selection kept after submit); Options (collapsed): Results (1-50, default 10, does not persist), Rerank (default on, does not persist); "Draft an answer from the top results" checkbox (default on).
- Submit disabled while searching or when no data sources; label "Searching…"; extra status "Searching and drafting an answer; this can take a few seconds." when answer is on.
- Results card (ordered, 1-based rank, anchor `#result-n`): page image (lazy, links to PDF), document title (link to PDF `#page=n`), "#rank · Page n · {data_source_id}" (shows raw id, handover says show name), snippet (optional). Count + "{retrieval_ms} ms, reranked".
- Answer block: heading, verification label, answer text with `[n]` as links to cards, details list of unsupported claims (with cited ref), footer "{model} · drafted in X ms · verified in Y ms".
- Pre-search
  - [ ] Initial (no results yet); engine error banner above form (list failed) and "None available." with submit disabled
  - [ ] No data sources granted / not in an org
- Validation (400, inline above button)
  - [ ] "Enter a query."; "Select at least one data source."; (top_k clamped silently, no message)
- Errors on submit
  - [ ] 403 "No access to data source(s): …" (also logged as forbidden)
  - [ ] 502 "{status} {detail}" for engine 400/401/404/422 (e.g. unknown data sources 404); 503 reads "Search is temporarily unavailable: …"; unreachable reads "Engine unreachable"
  - [ ] Session expired mid-use: redirect to login _(inferred)_
- Results
  - [ ] Loading (disabled button + status text); no separate skeleton; answer and results arrive together, handover prefers results first or an answer loading state (undecided)
  - [ ] Zero results: "Nothing matched." (fewer than top_k is normal, reranker drops low pages)
  - [ ] 1 result ("1 result" singular); many (up to 50) with lazy images; long titles; missing snippet
  - [ ] Image failed/expired (signed URL ~4 h) _(inferred; no onerror handling)_; `target=_blank` PDF opens new tab
  - [ ] `li:target` outline when a citation is clicked (only focus cue for it); no scroll offset rule
- Answer states
  - [ ] Verified: label "{n}/{n} claims verified"
  - [ ] Partial: "{s}/{t} claims verified" in warning colour + collapsible "N unsupported claim(s)" list (singular/plural)
  - [ ] Unverified: "Unverified" (verification null) or "Unverified (no claims checked)" (total 0). Never styled as verified
  - [ ] Abstained: answer text shown plus "· the sources don't cover this question". It is an answer, not an error; results still shown
  - [ ] Answer unavailable: engine 400 on `answer:true` is retried without it; muted "Answer unavailable ({reason}); showing results only."
  - [ ] Citations: `[n]` outside 1..result count renders as plain text; text is multi-line (`pre-line`), long answers; model output rendered as text, never HTML
  - [ ] Answer requested off: no answer block at all
- Latency (handover): search ~0.6 s p50; draft +1-2 s; verify +~2 s

### `/data-sources/[id]`

- Who: member+ whose org is granted that source; otherwise 404 (deliberately hides existence).
- Purpose: corpus detail: ingestion jobs and documents.
- Data: back link, name, description, "Status · N documents · N pages"; Ingestion jobs table (type, status, progress done/total or —, created local datetime, error in red) plus "N active" count for queued/running (last 20 jobs); Documents table (title linked to PDF, filename, pages or —, status), total count, Previous/Next links (page size 50, `?offset=`).
- [ ] Not granted / unknown: 404 error page; engine 404: same
- [ ] Engine error/unreachable: 502 error page (whole page lost, not a banner)
- [ ] No jobs: "No jobs recorded."; no documents: "No documents."
- [ ] Job states: queued, running, failed (error text, long), done; progress partial
- [ ] Many documents: pagination first/middle/last page; offset beyond total shows empty (no "back" cue unless offset>0)
- [ ] Wide tables (5 columns) on narrow screens; long filenames/titles
- [ ] Jobs are not auto-refreshed _(inferred)_; ingestion detail is technical (decide if members should see it)
- [ ] Document `pdf_url` signed and expiring; stale after ~4 h on an open tab

### `/admin` (Platform admin only)

- Who: platform admin; others get 403 error page, anon redirect to login.
- Purpose: list all orgs, create an org.
- Data: Orgs table (name linking to manage, slug, member count, granted corpus ids joined by commas or —); Create org form (Name, Slug with hint "lower-case letters, digits and dashes; used in URLs").
- [ ] No orgs: "No orgs yet."; many orgs; long names; many corpus ids in a cell (shows raw ids)
- [ ] Validation 400: "Enter a name and a slug (lower-case letters, digits and dashes, 2–63 chars)."; taken slug: `The slug "x" is taken.`; other DB errors verbatim; inputs kept
- [ ] Success: redirect to the new org's manage page (no confirmation notice)
- [ ] 403 for non-admin
- [ ] In progress: copy "Platform admin" in headings; per-field help text on Name and Slug (slug is permanent? unspecified)

### `/orgs/[slug]/manage` (Org admin; Platform admin sees more)

- Who: org owner (becoming "Org admin") or platform admin. Plain member: 403 "Only org owners can manage members". Unknown/invisible org: 404.
- Purpose: manage members and invites; admins also manage corpus access, email domains, settings.
- Page-level feedback: one slot for error (`role=alert`) or notice (`role=status`) from the last action; inputs mostly retained.
- Members section: table email (+ display name), role select (member/owner) + Change button, Remove button; "Add a member" form (Email, Role, Add) with help text; Pending invites table (email, role, invited date, Revoke) only if any.
- Platform admin only sections (hidden entirely from owners today; consider showing as locked with explanation): Corpus access (checkboxes of engine corpora, Save access), Email domains (list with Remove, add form, shows default role), Settings (store query text in analytics checkbox; role for domain auto-joins select).
- Notices (success): "{email} is now a {role}."; "Invited {email}; they join when they sign in."; "Invite for {email} saved, but the email was not sent ({reason}). They join when they sign in at {origin}/login." (partial success, treated as notice not error); "Member removed."; "Invite for {email} revoked."; "Corpus access saved."; "New sign-ups from @{domain} will join {org}."; "Removed @{domain}."; "Settings saved."
- Errors: "Enter a valid email and role."; "Invalid email."; "No such member." (404); DB messages verbatim (e.g. last-owner trigger, RLS denial); "Only platform admins can change this." (403); "Could not reach the engine: …" (502 on save grants); "Enter a domain like acme.com."; "{domain} is already claimed by an org."; "Pick a default role."; "Invalid domain."
- [ ] Empty states: no members (cannot normally happen), no invites (section omitted), no domains (list omitted, no empty copy), engine has no data sources: "The engine has no data sources."
- [ ] Engine down in Corpus access: red banner + "Granted: ids or none" with the form hidden
- [ ] Member row: current user's own row (can remove/demote self? last owner blocked by DB, message is raw DB text); user with no profile email shows user id
- [ ] Destructive actions (Remove, Revoke, Remove domain) have no confirmation today
- [ ] Many members/invites/domains; long emails; role change has separate Change button per row
- [ ] Notice vs error persistence: a notice from one form sits at top, far from the form that caused it
- [ ] In progress: role names Platform admin / Org admin / Member (stored values stay owner/member; display mapping needed); help text for each field (role meanings, what auto-join does, what query logging stores, what an invite does); "Platform admin only" labels on the three admin sections

### `/signup` _(in progress)_

- Who: anon. Purpose: create an account with email + password.
- Fields: email, password (rules unspecified; Supabase config minimum is not set in repo), possibly confirm _(inferred)_. Config: `enable_confirmations = false` locally, so confirmation is likely on in production.
- [ ] Idle; submitting; validation (bad email, weak/short password); email already registered (should not leak, decide); rate limit
- [ ] Success: "Check your email" state with the address, resend link _(inferred)_, wrong-address back link
- [ ] Domain auto-join and invites apply only after confirmation: explain after confirm
- [ ] Link to /login

### `/forgot` _(in progress)_

- Who: anon. Purpose: request a password reset email.
- [ ] Idle; submitting; invalid email validation
- [ ] Always the same result message ("If an account exists for that address, we sent a reset link") whether or not the account exists; never an error for unknown email; rate limit message must not leak existence
- [ ] Link back to login

### `/account/password` _(in progress)_

- Who: signed-in user arriving via the reset link (recovery session) or from /account. Purpose: set a new password.
- [ ] Idle; submitting; mismatch / too short / same-as-old; success then redirect or notice
- [ ] Expired or reused reset link (lands on login error today; needs dedicated copy)
- [ ] Signed in via recovery only: no current password is asked _(inferred)_

### `/account` _(in progress)_

- Who: any signed-in user. Data: email (read-only), change-password form requiring current password.
- [ ] Idle; wrong current password; weak new password; success notice; submitting
- [ ] Possibly show org memberships and roles _(inferred; not in brief)_; user with no org
- [ ] Magic-link-only users have no password: "set a password" variant without current password _(inferred)_

## Cross-cutting

- Navigation: current-page state absent; admin and manage links conditional on role; header repeated on every page; breadcrumbs only on data source detail ("← Data sources"). Logout is a POST form-button styled in the nav row.
- Auth redirects: unauthenticated access to any `(app)` route goes to `/login?redirectTo=<path+query>`; no explanatory message. Logged-in visit to `/login` redirects to `/`.
- Flash/notice messages: none global. Manage page uses one inline status/alert slot; login/search/admin use inline `form.error`. Define one pattern: placement, auto-dismiss or not, partial-success (invite saved, email not sent) style, success after redirect (create org shows none).
- Form validation: server-side only, via 400 `fail` with field values echoed back (passwords never). Browser `required` / `type=email` also apply. Errors are single strings, not per-field; no `aria-invalid` or field association. Parsers: slug `^[a-z0-9][a-z0-9-]{1,62}$`, email regex, domain regex, role owner|member (normalised lowercase/trimmed). Per-field help text is requested for admin pages.
- Progressive enhancement: forms work without JS; `use:enhance` shows busy state only on login and search.
- Engine failures: banner pattern ("Could not reach the engine: …") on dashboard, search, manage; full error page on data source detail. 503 has friendlier copy only on search; handover says "retry later".
- Signed engine URLs (`page_image_url`, `pdf_url`): expire after ~4 h; only fix is re-searching or reloading the page. Open tab left idle will show broken images and dead PDF links; no refresh affordance exists _(inferred)_. `pdf_url` carries `#page=n`.
- Emails (design the content/templates; Resend):
  - Invite (app-sent, only for emails without an account): subject "You're invited to {org} on Boreal Search"; body links to `/login`, "Sign in with {email} to accept". HTML + text. Send failure surfaces as a notice to the inviter.
  - Magic link / sign-in, signup confirmation, password reset, email change: sent by Supabase Auth over Resend SMTP, templates configured in Supabase (not in repo); links hit `/auth/confirm`. Reset and confirm templates are in progress.
- Data/units: scores are fused rank scores (~0.03), show rank not score (current UI does). Timings in ms; dates via `toLocaleString` / `toLocaleDateString` (browser locale).
- Responsive _(inferred)_: header is one flex row (nav + email + logout); tables with 4-5 columns on dashboard, data source, manage; result cards are image + text; `main` max 72rem. Needs phone behaviour for all of these.
- Keyboard/a11y _(inferred from code)_: citations are links to in-page anchors (needs focus target and visible focus); `role=alert` for errors, `role=status`/`aria-live` for notices and results; details/summary for options and unsupported claims; images have alt "Page n of {title}"; status colour (warn) is the only differentiator for partial verification besides label text; light and dark themes via `prefers-color-scheme` already exist (tokens: bg, fg, muted, border, accent, danger; `--warn` used but not defined).
- Locale: UI English only; documents may have French columns (engine strips them from snippets).

## Open questions for design

1. Where do results and answer sit relative to each other, and should results render first while the answer loads (handover suggests it)? Is the answer above or beside the cards?
2. How loud should "partial" and "unverified" be versus "verified"? Is the unsupported-claims list always visible or collapsed?
3. Does an abstained answer get its own treatment distinct from a normal answer?
4. Result card should show corpus name instead of raw id; show Act aliases (e.g. SARA) next to titles? Show rank only.
5. Corpus picker with many corpora: grouping, select all/none, persist per user? (engine is stateless; web does not persist selection today)
6. Are Options (Results count, Rerank) user-facing at all, or admin/debug?
7. Should members see ingestion jobs and raw status values on the data source page?
8. What does a user with no org see, and how do they get in (invite, domain, contact)? Is `/account` reachable and useful then?
9. Confirmation for destructive actions (remove member, revoke invite, remove domain)? Self-removal and last-owner warnings?
10. Show Platform admin-only sections to Org admins as locked/explained, or hide them?
11. One notice/error pattern across the app: inline vs toast, and how a redirect-after-success (create org, login) carries a message.
12. Mapping UI names to stored roles (owner shown as "Org admin"); does a user with both Platform admin and an org role show one badge or two?
13. Password rules (length, strength meter), confirm field, and show/hide toggle; whether sign-up with an existing email reveals that.
14. Login: keep the single combined email+optional-password form, or split password vs magic link? Where do Sign up and Forgot links go?
15. Invalid/expired link experience (`?error=invalid_link` is currently ignored) and the "signed out" message.
16. Expired signed URLs: silent fail, auto re-search, or an explicit "refresh results" prompt?
17. Mobile navigation pattern, and whether the nav needs an active-state and account menu (email + Account + Log out).
