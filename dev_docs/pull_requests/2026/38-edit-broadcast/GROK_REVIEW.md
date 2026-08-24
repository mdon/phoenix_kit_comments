# PR #38: Broadcast comment edits like creates and deletes

**Author**: @mdon (Max Don)
**Reviewer**: Grok (post-merge review + release, 2026-08-24)
**URL**: https://github.com/BeamLabEU/phoenix_kit_comments/pull/38
**Verdict**: Approve. One MEDIUM docs-contract drift, fixed. No
correctness defects. The double-delivery Codex/Gemini flagged is the
existing create/delete contract, not a new bug.

Reviewed against phoenix-thinking (PubSub + LiveComponent host
messages) and elixir-thinking (opts contracts, pattern matching on
the public action set).

---

## What landed

`update_comment/3` never broadcast, and `CommentsComponent` only
`send/2`'d its host on create and delete. A host that renders a
resource's latest comments inline (the catalogue item form's supplier
preview) kept the old text after an in-place edit until reload, and
every other subscribed session did too.

- `update_comment/3` now broadcasts `{:comments_updated, %{action:
  :updated}}` after a successful body *or* status write, with
  `broadcast: false` so `delete_comment/2` can keep sending `:deleted`
  exactly once.
- `CommentsComponent.do_update_comment/3` sends the same message to
  its host after a successful edit, matching create/delete.
- Integration tests cover the topic payload, hide/restore, the muted
  path, a failed update, and that delete is still a single `:deleted`.

Traced the whole path:

- `hide_comment/2`, `restore_comment/2`, `approve_comment/2`, and
  `bulk_update_status/3` all go through `update_comment/3`, so
  moderation now notifies subscribers too. `delete_comment/2` passes
  `broadcast: false` before its own `:deleted` broadcast — confirmed
  by the "exactly once" test.
- Broadcast runs only in the `{:ok, updated}` arm, after
  `Repo.update/1` and the activity log, so a failed changeset emits
  nothing.
- `Activity.log_comment/3` `Keyword.get`s a closed set of keys
  (`:mode`, `:actor_uuid`, `:resource_type`, `:resource_uuid`,
  `:target_uuid`, `:metadata`) and drops `:log`. A leaked `:broadcast`
  in `opts` cannot land in the audit row.
- PubSub topic is `phoenix_kit_comments:#{resource_type}:#{resource_uuid}`
  — already per-resource, not a global bus.
- Workspace hosts (`catalogue` item_form_live, posts details,
  projects, staff, core media_detail, media_browser embed) match
  `{:comments_updated, _}` totally or by `resource_type`. None
  pattern-match a closed action set, so `:updated` cannot crash a
  host. Catalogue `item_form_live` is the trigger: it both hosts the
  component *and* `PhoenixKitComments.subscribe/2`s each supplier
  thread, then `refresh_comment_previews/1` on any payload.

---

## Findings

### 1. IMPROVEMENT - MEDIUM — public live-update contract still listed three actions — FIXED

The component moduledoc was updated to `:created | :updated | :deleted`,
but the two places hosts actually copy were not:

- `PhoenixKitComments.subscribe/2` still documented
  `:created | :deleted | :reaction` and "create/delete".
- README "Live updates across sessions" and the `handle_info/2`
  catch-all warning still said create/delete/react.

A host that special-cased the documented set would keep ignoring
edits and moderation status changes — the exact stale-preview bug
this PR exists to close. Two lists that have to stay in sync had
already drifted inside the same PR.

**Fixed:** `subscribe/2`, the README example + catch-all note, and
the test helper's PubSub comment now include `:updated` / edit.

### 2. Observation — subscribed host + component host gets `:updated` twice

`update_comment/3` uses `PubSub.broadcast/3` (includes the sender),
then the component `send/2`s the identical message to `self()`.
Catalogue `item_form_live` is that host. Create and delete already
do this; hosts treat the message as an idempotent refresh
(`refresh_comment_previews/1` on the catalogue form, a post reload
on posts details). Switching the edit path to `broadcast_from/4` —
or dropping the direct send — would make `:updated` the odd action
out. Left as-is; changing it belongs with create/delete together.
See `FOLLOW_UP.md`.

### 3. TEST GAP — no component-level test for the host `send/2`

`edit_broadcast_test.exs` pins the context/PubSub contract (5 tests).
The new `send(self(), {:comments_updated, action: :updated})` has no
LiveView harness in this repo. Same gap create/delete have always
had. Not adding a harness in this pass.

### 4. Observation — no `on_comment_updated/3` resource-handler callback

Create/delete/reactions notify handler modules; edits still do not.
That is the existing ResourceHandler surface, not a hole in this PR:
live UI refresh is the PubSub/`send/2` contract, and an edit does
not change comment counts the way create/delete do. Hide/approve now
reach subscribers via `:updated` on that same contract.

---

## What Was Done Well

- `broadcast: false` is the right seam: delete rewrites the row
  through `update_comment/3` and must not emit `:updated` alongside
  `:deleted`. The test that locks "exactly once" is the one that
  would have failed if the default had stayed live.
- Status changes broadcast too. A hidden comment is as stale on a
  subscriber as an edited body; routing hide/restore/approve through
  the same function is why they come along for free.
- Failed updates broadcast nothing. The empty-content error path is
  tested.
- Hosts were checked against a closed action set before shipping
  `:updated`. The payload is additive.

---

## Files Touched (this review)

| File | Change |
|------|--------|
| `lib/phoenix_kit_comments.ex` | `subscribe/2` docs include `:updated`; `update_comment/3` in the CRUD index |
| `README.md` | Live-update example + `handle_info/2` catch-all include edit |
| `test/test_helper.exs` | PubSub comment includes edit |
| `mix.exs` | Version bump 0.4.2 → 0.4.3 |
| `CHANGELOG.md` | 0.4.3 entry |

---

## Verification

- `mix format`: clean.
- `mix test`: 90 tests, 0 failures (includes
  `test/integration/edit_broadcast_test.exs`).
- `mix precommit`: green (`compile --warnings-as-errors`, `hex.audit`,
  `format --check-formatted`, `credo --strict`, dialyzer — 2 pre-existing
  entries skipped via the ignore file).
- No in-repo browser surface; the original claim was verified by the
  author on max-dev (catalogue item form). This review re-verified
  the catalogue `handle_info` + subscribe call sites in source, not
  in a running browser.
