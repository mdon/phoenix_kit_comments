# Quality sweep — phoenix_kit_comments (2026-08-28)

Playbook: `~/Desktop/Elixir/dev_docs/quality_sweep.md`. Phase 1 (PR catch-up)
is complete — all five untriaged PR folders now carry a `FOLLOW_UP.md`. This
file records Phase 2: what was found, what was fixed, and what is left.

Four triage agents ran against `lib/` + `test/` (security/error-handling,
translations/activity/tests, PubSub/cleanliness/API, host-integration
boundaries), plus the checks the playbook says to do by hand. **Every finding
below was verified against the code before being acted on** — several agent
claims did not survive that and are listed under "Rejected".

## Fixed (commits `e0e7155`, `594d252`, `7308364`)

### Correctness

- **Approve and Restore were wired to each other's context functions**
  (`web/index.ex`). With moderation on, Approve called `restore_comment/2`,
  which sets `pending` — so approving a pending comment did nothing while
  flashing "Comment approved", in the one configuration where approving is
  the point. Restore called `approve_comment/2`, publishing a deleted comment
  that had never been approved — the exact bug `restore_comment/2` exists to
  prevent. The audit trail was inverted to match. Found independently by all
  three code-triage agents.
- **`save_decoration` privilege escalation.** The permission check asked "do
  you own this COMMENT?", but the host record it renames is selected by
  looking the comment's own `metadata` up in the host's decorations map — and
  that metadata was client-supplied at create time. Posting a comment with
  `metadata[annotation_uuid]` set to someone else's annotation, then saving a
  decoration, renamed a record you have no rights to, via a `send_update` the
  host cannot distinguish from a legitimate one. Decoration keys are now
  dropped from client-supplied metadata (`client_metadata/2`): that link is
  the host's to make server-side.
- **Four handlers crashed the host LiveView on a malformed payload.**
  `update_comment_draft` and `giphy_search` stored a map into an assign and
  raised at RENDER time; `add_comment` raised `BadMapError` on `metadata=foo`;
  and `toggle_like` / `toggle_dislike` / `reply_to` / `begin_decoration_edit`
  all reached `to_string/1` on a map — closed at the one choke point,
  `find_comment_in_tree/2`.
- **`create_comment/4` raised on a malformed `parent_uuid`** instead of
  returning a changeset error (`depth_below/1`).
- **`link_with_annotation/2`** appended a client-set `annotation_uuid` to an
  href an admin clicks, with no format check — `?annotation=x&status=y` rode
  along. Now `Ecto.UUID.cast/1`.

### The JS hooks were dead on every LiveView navigation

Both hooks registered themselves from an inline `<script>`. That works on a
hard page load and does nothing on a navigation: morphdom does not execute an
inserted `<script>`, and the LiveSocket hooks map is fixed at construction.
Proven on the dev box before the change — navigating to Settings → Comments
logged `unknown hook found for "InsertAtCursor"` four times with two elements
waiting on it. They now ship via `js_sources/0` and are namespaced.
**AGENTS.md told contributors to use inline scripts**, so it was documenting
the broken pattern; corrected.

### Robustness

- **Role checks cost up to eight queries per comment, recursively per reply,
  on every re-render.** A fifty-comment thread was hundreds of role queries a
  render. Resolved once per render, exactly as `:pk_scope` beside it already
  was.
- **The module kill switch never reached embedded threads.** The component
  defaulted `enabled` to `true`, so hosts that embed it without passing
  `enabled=` kept accepting writes after an admin turned comments off.
- **Three guards that exist for "the database may be gone" only caught
  raises.** An unowned checkout raises but a dead pool *exits*, so
  `enabled?/0`, `broadcast_change/3` and `notify_resource_handler/4` did not
  hold in the case they were written for. The last one runs arbitrary host
  code *after* the comment has committed, so an exiting handler killed the
  LiveView for a comment that saved fine.
- **`count_comments/3` (both clauses) and `count_all_comments/1` degraded to
  zeros silently** — the treatment `count_replies/2` had already been given.
- **Settings-save errors logged `Exception.message/1`**, and Ecto exceptions
  in that class interpolate the offending value — which on that path can be
  the Giphy API key. Now the struct name only.
- **`approve_comment/2` and `hide_comment/2` wrote two audit rows each.**
- **`phx-disable-with`** added to Delete, Remove-resource-path and
  Reset-defaults.

### i18n

- **`gettext("Edit")` had reached no catalogue at all.** The string was
  renamed from `"Edit comment"` and never re-extracted, so `et`/`ru` rendered
  English. Invisible to a `.po`-vs-`.po` check by construction: missing from
  all three symmetrically, and the stale entry replaced it 1-for-1 so the
  counts matched. Re-extracted and translated.
- **Status badges printed the raw DB enum** next to a filter dropdown showing
  the translated word — a Russian admin saw "Опубликовано" in the filter and
  "published" in the badge. Now `status_label/1`, per-clause with literal
  `gettext/1` so the extractor can see it.
- **`mix gettext.merge` guessed two translations wrong in each language** and
  marked them fuzzy — and fuzzy entries are ignored at runtime, so they would
  have rendered English regardless. Corrected by hand; both catalogues are now
  complete with zero fuzzy entries.
- **Resource-type filter labels** used `String.capitalize/1`, rendering
  `Catalogue_item_supplier`, while the module's own `humanize_resource_type/1`
  (used everywhere else) renders `Catalogue Item Supplier`.

## Rejected after verification

- **"`:depth` is castable, so nesting limits can be defeated."** It is always
  recomputed from the parent before insert. `:status` *is* a real hazard for a
  host that forwards raw params — documented as server-side-only on
  `create_comment/4`; see Open.
- **"Commented-out `def` at `comments_component.ex:1880`."** It is a host-wiring
  example inside a documentation comment block.
- **"`String.capitalize/1` in `humanize_resource_type/1`."** Applied per word
  to a programmatic slug, which is the permitted case.

## What an external panel found in the fixes

Four models reviewed the PR after the fixes were in. Verified before acting:

- **The kill switch still did not reach an open thread.** Reading the setting
  into an assign is only as fresh as the last render, and a `phx-submit`
  reaches `handle_event` directly — `update/2` does not run first. So a
  thread open when the admin flipped the switch kept accepting writes, which
  is the entire case the gate exists for. It now asks at event time;
  permitted writes re-enter under a `{:write, event}` tag the gate's guard
  cannot match, so every handler stays where it is and the question is still
  asked in exactly one place.
- **Bulk Approve published deleted comments.** The Approve/Restore swap this
  sweep is named for was still live one control over: `do_bulk_action` wrote
  the status directly, so bulk Approve set "published" on rows whose row menu
  deliberately hides Approve, and logged `comment_updated` instead of the
  moderation action. Both bulk paths now go through the same context
  functions as their single-row menu items.
- **The decoration fix was keyed on data.** `comment_decorations` is a
  registry of VALUES rebuilt each render — core's builder returns `%{}` until
  an annotation has a title — so dropping "the keys currently in it" dropped
  nothing on precisely the pages with nothing to show yet, and a comment
  planted in that window kept its forged link until a title appeared.
  `:decoration_keys` is the static declaration that does not move with the
  data. The component also never told the host WHO clicked, so the host could
  not answer the question the component cannot: `actor_uuid` now rides in the
  payload.
- **`viewer_is_admin?` was frozen for the component's lifetime**, so a host
  mounting with `current_user: nil` and sending the user after rendered every
  comment for a stranger.
- Smaller: the sibling decoration path skipped the label cap the other
  declares; `save_edit` took a non-binary body into `String.trim/1`; four
  settings reads on the render path rescued without catching `:exit`, as did
  the post-commit reaction hook; and the handler-exit log wrote
  `inspect(reason)`, which for a `GenServer.call` timeout carries the call
  arguments — the whole comment — into the log.

**Rejected:** that moving the hooks to `js_sources/0` could leave a host
without them. `js_sources/0` has been in core since 1.7.146 and this module
pins `~> 2.0`, so no core satisfying the pin lacks the callback.

**Coverage note:** the component now has a host page in the test harness
(`Test.HostLive`). It had none, which is why none of the above was caught
here first.

> **Status, 2026-08-29:** the post-merge review of #41 closed items 2 and 3
> below and four of the "known gaps", and recorded why item 1 was left alone.
> See `dev_docs/pull_requests/2026/41-comments-quality-sweep/CLAUDE_REVIEW.md`.

## Open — needs a decision

1. **`:status` on `create_comment/4`.** Dropping it from the create cast would
   close the moderation bypass for hosts that forward user params, but it is a
   public API change and there are legitimate server-side callers. Documented
   as server-side-only for now.
2. ~~**Comment card actions are invisible on touch devices** (see PR #36's
   `FOLLOW_UP.md`). Edit/Delete/Reply are `opacity-0` until `:hover`, which
   touch never matches.~~ Fixed with a `[@media(hover:none)]` variant.
3. ~~**`giphy_search` is reachable by anonymous viewers** — it is not in
   `@write_events` and has no `can_post?` check, so a logged-out visitor can
   drive outbound calls against the host's Giphy quota with chosen query
   strings. The "toggle off" half of this was already fixed; the "not signed
   in" half was not.~~ Fixed: it now asks `can_post?` and is in `@write_events`.

## Open — known gaps, not yet done

- ~~**No LiveView tests exist at all** (no `Phoenix.LiveViewTest` anywhere in
  `test/`). The approve/restore swap and the missing `actor_uuid` threading
  would both have been caught by one test that clicks a button and asserts on
  the resulting activity row's `action` **and** `actor_uuid`. This is the
  single biggest coverage gap and the C7/C10 work the playbook prescribes.
  Note `Activity.log/2` rescues `DBConnection.OwnershipError` to `:ok`, so
  such tests need `shared: true` ownership or they pass vacuously.~~ Done in
  #41 itself (`test/support/live_case.ex` and three integration files).
- ~~**`actor_uuid` is not threaded** from `CommentsComponent`'s edit and delete
  paths, so the embedded thread — the path ordinary users take — logs "a
  comment was deleted" with nobody attached. The admin page threads it
  correctly.~~ Fixed, with tests asserting the actor on the resulting row.
- **`bulk_update_status/3` writes a different audit action** than the
  single-row path for the same operation.
- ~~**Nothing logs on the `:error` branch** of a moderation action, and the
  single-row handlers flash success unconditionally without checking the
  result — so a failed hide/delete leaves no trace anywhere and tells the
  admin it worked.~~ Fixed: all four route through one helper that flashes the
  outcome and logs failures. Single-row Approve also refused a deleted comment
  only in the bulk path; the rule moved into `approve_comment/2`.
- **Twenty user-facing error strings** across four private message functions
  have zero test coverage; they want an `Errors` module with per-atom tests.
- **Untested surfaces:** `escape_like_pattern/1` (a regression makes `%` a
  wildcard matching every comment), `list_all_comments/1`'s search branches,
  `per_page: 0` raises `ArithmeticError`, oversized/non-string content,
  malformed uuids, Unicode bodies, attachment caps.
- **Test smells that prove nothing:** several `assert is_binary/is_boolean`
  and `function_exported?` assertions that pass against a stub body — listed
  in the agent report; `enabled?/0`'s test asserts only that its rescue path
  returns a boolean.
- **Docs drift:** README carries two contradictory resource-handler callback
  lists (3 vs 7); the component's moduledoc documents 4 optional attrs while
  `update/2` accepts 17, including the entire decoration surface; the
  LiveComponent declares no `attr`/`slot`, so a host misspelling
  `current_user` silently gets "Sign in to post a comment".
- **Duplication** worth a helper: 8 copies of the authorization-gate
  boilerplate (and `check_authorization/1` is byte-identical in two modules),
  4 near-identical moderation handlers, the like/dislike surface duplicated
  pairwise five times.
- **`@spec` missing** on roughly half the public context API.
