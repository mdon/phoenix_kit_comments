# PR #41 — Quality sweep: the moderation swap, a decoration escalation, and the LiveView tests that were missing

**Author:** mdon (Max Don)
**Reviewer:** Claude (post-merge review, 2026-08-29)
**Verdict:** Approve. The sweep's own claims hold up against the code. Six
follow-on defects found and fixed in this pass — five of them the open items
the sweep itself left on the table, one new.

---

## What the PR claims, checked against the code

Every claim in `dev_docs/QUALITY_SWEEP_2026-08-28.md` was verified by reading
the producing code rather than the description. All of them hold:

- **The Approve/Restore swap is really fixed.** `web/index.ex:141` now calls
  `approve_comment/2` and the `restore` handler calls `restore_comment/2`.
  The moderation-on case — the only configuration where the two differ — is
  pinned by `moderation_live_test.exs`.
- **The write gate is asked at event time, not read off an assign.**
  `handle_event/3`'s `@write_events` clause calls `writes_enabled?/1`, which
  re-reads the module switch; permitted writes re-enter under `{:write,
  event}`, a shape the guard (`event in @write_events`, all binaries) cannot
  match. The re-entry is sound: LiveView only ever calls `handle_event/3`
  with a binary event name, so nothing external can jump the gate by sending
  the tagged form.
- **`decoration_keys` is the right source for the drop list.**
  `comment_decorations` is rebuilt from data each render and is `%{}` before
  anything is decorated, so keying the drop on it dropped nothing in exactly
  the window an attacker wants. `decoration_keys/1` unions the static
  declaration with the registry, keeping the registry as a floor.
- **`js_sources/0` is safe against the declared floor.** The callback exists
  in core's `PhoenixKit.Module` behaviour and this module pins `~> 2.0`, so
  no core satisfying the pin lacks it — checked in `deps/phoenix_kit`, not
  taken from the description.
- **The `catch :exit, _` additions are in the right places.** Each sits
  beside an existing `rescue` on a guard whose stated purpose is "the
  database or PubSub may not be there" — an unowned checkout raises, a dead
  pool exits, and only the pair covers both.
- **The settings reads are cache-backed** (`PhoenixKit.Cache`, ETS), so
  re-reading `comments_enabled` per write event costs a term lookup, not a
  query. The gate's cost objection does not apply.

---

## BUG - HIGH: `giphy_search` was reachable by a logged-out visitor -- FIXED

`giphy_search` was not in `@write_events` and asked no `can_post?` question,
while `add_comment` beside it asks both. The picker never renders for an
anonymous viewer, but the markup is not the control — the component's cid is
addressable by anyone who can see the page, so a logged-out visitor could
drive outbound calls to api.giphy.com with query strings of their choosing,
against the host's quota and rating configuration.

The sweep found and fixed the "toggle off" half of this (`search_giphy/2`
now checks `giphy_enabled?/0`, not just the key), and listed the "not signed
in" half as open. It is the same event and the same reasoning.

**Fixed** in `comments_component.ex`: `giphy_search` joins `@write_events` —
which closes a second hole in the same breath, since a thread left open when
an admin turned comments off could still bill the host for searches — and a
`can_post?: false` clause refuses it ahead of the real handler.

**Test:** `comments_component_test.exs`, "a logged-out viewer cannot spend the
host's Giphy quota". Socket-level on purpose: the picker does not render for
an anonymous viewer, so a host page cannot distinguish "refused" from
"searched", and letting the unguarded path run would put a live request to
api.giphy.com in the suite.

## BUG - HIGH: single-row Approve published deleted comments -- FIXED

The sweep fixed this one control over — `bulk_approve/2` was added precisely
because bulk Approve published rows whose row menu deliberately hides
Approve. But the single-row handler was left taking whatever uuid the event
carried. Hiding the menu item is a rendering decision; `render_click(view,
"approve", %{"uuid" => deleted_uuid})` is one line, and a replayed event from
a stale page is not even hostile.

The rule was in `bulk_approve/2`, where only one of the two callers could
reach it. **Fixed** by moving it to the choke point every caller goes
through: `approve_comment/2` now has a `%Comment{status: "deleted"}` clause
returning `{:error, :comment_deleted}`, with a `@spec` and a doc that points
at `restore_comment/2`. `bulk_approve/2` loses its special case and simply
tallies the result, so the two paths cannot drift again.

**Test:** `moderation_live_test.exs`, "refuses a deleted comment instead of
publishing it", asserting the status, the flash, and the absence of a
`comments.comment_approved` row.

## BUG - MEDIUM: four moderation handlers flashed success unconditionally -- FIXED

`approve`, `hide`, `delete` and `restore` each called the context function
and discarded its return value, then flashed "Comment approved". The sweep
fixed exactly this in `do_bulk_action/3` and recorded the single-row half as
open. It matters more than it reads: `Activity.log_comment/3` only logs its
`{:ok, _}` clause, so a failed moderation left **nothing** behind — no audit
row, no log line — and told the admin it had worked. The finding above makes
the difference reachable rather than theoretical.

**Fixed** by routing all four through one `moderate/4` helper whose `with`
includes `{:ok, _} <- fun.(comment, actor_opts(socket))`, flashing a
per-action error and logging the failure otherwise. This also collapses four
near-identical handler bodies, which the sweep listed under duplication.

The failure log prints `changeset.errors`, not the changeset: the struct
carries the comment body, and the sweep had already established (on the
settings-save path) that this class of log must not interpolate the value.

## BUG - MEDIUM: an edit or delete from an embedded thread logged no actor -- FIXED

`update_comment/3` and `delete_comment/2` forward the actor keys to the
activity log, and the admin page threads them via `actor_opts/1`. The
component did not: `do_update_comment/3` and `execute_delete/2` called them
with no opts at all, so every edit and delete made from an embedded thread —
the path ordinary users take, as opposed to the moderation dashboard —
recorded "a comment was edited" with nobody attached. The sweep listed this
as a known gap; the `actor_uuid/1` helper it needed already existed, added by
the same PR for the decoration payload.

**Fixed** in both functions. **Tests:** `comments_component_test.exs`, "an
edit records who made it" and "a delete records who made it", asserting the
`actor_uuid` on the resulting audit row — the assertion the file's own
moduledoc argues for, since asserting merely that a row exists passes against
a handler that drops the actor.

## IMPROVEMENT - MEDIUM: comment actions were unreachable on touch devices -- FIXED

Carried over from PR #36's `FOLLOW_UP.md` and still open. Edit, Delete and
Reply render at `opacity-0` and are revealed by `group-hover/comment`. A
device with no hover never matches it, so on a phone or tablet the controls
were present, focusable and completely invisible — and nothing the user could
do revealed them.

**Fixed** with `[@media(hover:none)]:opacity-100` alongside the existing
hover and focus variants on both controls, and `:opacity-60` on the
decoration row's pencil affordance. A coarse pointer gets the row at rest;
nothing changes for a mouse. This is a real media query rather than a width
breakpoint, so a small window on a laptop still behaves like a laptop.

## NITPICK: an error message for a reason nothing returns -- FIXED

`create_error_message(:module_disabled)` was added by this PR, but nothing in
`lib/` returns `{:error, :module_disabled}` — the create funnel has no such
clause, and the write gate flashes its own copy of the same string directly.
Removed. The msgid survives in the catalogues, since the gate still emits it.

---

## Deliberately not changed

- **`:status` on `create_comment/4`.** The sweep's open item #1. Dropping it
  from the cast would close the moderation bypass for a host that forwards
  raw user params, but it is a breaking change to a public API with
  legitimate server-side callers (the anchor-comment path from #37 among
  them), and the warning admonition the sweep added says so plainly. A
  release that changes it should say so in its own changelog entry, not ride
  along in a review pass.
- **A module-enabled gate inside `create_comment/4`.** Tempting while
  removing the dead `:module_disabled` clause, and it would put the kill
  switch at the one place every caller passes. But it changes the contract
  for server-side callers that legitimately write while the UI is off (three
  test files create comments without touching the setting), so it is a
  design decision for the maintainer, not a review fix.
- **The remaining items in the sweep's "known gaps" list** — an `Errors`
  module for the twenty user-facing message strings, `@spec` coverage on half
  the context API, the README's two contradictory handler lists, `attr`/`slot`
  declarations on the LiveComponent. All real, none defects; they are a
  backlog, and doing them inside a release pass would bury the four bug fixes
  above in noise.

---

## What was done well

- **The gate re-entry.** Tagging permitted writes `{:write, event}` so the
  guard clause cannot re-match is a genuinely neat way to keep one gate and
  zero changes to seven handler bodies. The alternative — a check at the top
  of each handler — is what let the giphy hole exist in the first place.
- **`decoration_keys` over `comment_decorations`.** Recognising that a
  registry built from data is empty in exactly the window that matters, and
  reaching for a static declaration instead, is the kind of finding that only
  comes from reading the producer.
- **The test harness earns its size.** A host page for the component
  (`Test.HostLive`) is what turns three of the fixes above from assertions
  into tests, and `LiveCase`'s moduledoc explaining why shared sandbox
  ownership is load-bearing — `Activity.log/2` rescues `OwnershipError` to
  `:ok`, so a non-shared sandbox makes every audit assertion pass vacuously —
  is exactly the note that stops someone "tidying" it into `async: true`.
- **The comments explain the failure, not the code.** Nearly every hunk in
  this PR says what went wrong and why the obvious alternative does not work.
  That is why this review could verify rather than re-derive.

---

## Verification

- `mix test` — 119 tests, 0 failures (115 before; the four new ones fail
  against the pre-fix code, checked individually).
- `mix precommit` — green (`compile --warnings-as-errors`,
  `deps.unlock --check-unused`, `hex.audit`, `format --check-formatted`,
  `credo --strict`, `dialyzer`).
