# PR #40 — Give the comment forms ids, so LiveView can recover them after a disconnect

**Author:** mdon (Max Don)
**Reviewer:** Claude (post-merge review, 2026-08-28)
**Verdict:** Approve. No correctness defects found.

---

## Three `<.form>`s in `CommentsComponent` gain stable `id`s

`<.form for={%{}}>` — used by the composer, the comment-edit form, and the
decoration-edit form — supplies no `id` of its own (only `for={@changeset}`
does). Without an id, LiveView can't perform its automatic form-recovery
after a disconnect/reconnect, so a comment half-typed when the socket
dropped was silently lost instead of restored. The PR's own description
traces this to warnings surfaced in a downstream host repo's test suite
(`phoenix_kit_catalogue`, which embeds this component on an item form's
Suppliers tab):

```
warning: Detected a form with phx-change but missing id:
    <form class="space-y-2" phx-target="3" phx-change="update_comment_draft" phx-submit="add_comment"></form>
```

Traced the fix independently rather than taking the description at face value:

- All three `<.form>` call sites in the file (`comments_component.ex:1435`,
  `:1500`/1502, `:1965`/1967) now carry an id — confirmed by grepping for
  every `<.form` in the file; none were missed.
- `render_comment/1` is a **function** component recursively called for the
  whole tree (`defp render_comment`, called from itself at line 1704 and
  from the template at `comments_component.html.heex:187`) — there is only
  ever one `CommentsComponent` LiveComponent instance per embed, so `@myself`
  (its CID) is constant across every comment in the tree. Uniqueness of
  `comment-edit-form-{cid}-{uuid}` and `decoration-form-{cid}-{uuid}`
  therefore rests entirely on `@comment.uuid`, which is fine *within* one
  component instance — and the PR description is upfront that this holds
  only "by how hosts embed it" (no two instances render the same comment on
  one page today), not by anything the component itself enforces.
- Both per-comment forms are guarded so at most one instance of each ever
  renders at a time — `@editing_uuid == @comment.uuid` for the edit form,
  `@decoration_editing?` (itself gated on
  `editing_decoration_uuid == {metadata_key, comment.uuid}`) for the
  decoration form — so there's no risk of two edit forms with the same id
  coexisting even transiently.
- The composer's `{cid}-{suffix}` needs the cid: a host can embed several
  `CommentsComponent`s on one page (the catalogue renders one per supplier
  thread), and `suffix` alone (`:top` / `:bottom` / a comment uuid for
  inline replies) would collide across those instances. Confirmed the three
  composer call sites can't collide with each other either: the top/bottom
  composer only renders when `composer_open_at == position and
  is_nil(reply_to)`, and the inline reply form only when `reply_to ==
  comment.uuid` — mutually exclusive with the top/bottom composer and with
  each other (`reply_to` is a single value), so only one composer form is
  ever mounted at once per component instance.
- This exact `#{@ctx.myself}-#{@suffix}` id pattern already existed pre-PR
  on the composer's audio-recorder and Giphy-search inputs
  (`comments_component.ex:2045`, `:2228`) — the PR extends an established
  convention rather than inventing a new one.

No test coverage was added, unlike prior PRs in this repo (#36, #37) that
added regression tests for shipped-without-tests gaps. Checked whether that
was feasible here first: this library has no `Endpoint`/`ConnCase`/
`live_isolated` harness anywhere in `test/` — it can't mount a LiveView host
to render this LiveComponent's actual DOM at all, so a `has_element?`-style
assertion on these ids isn't available the way it was for #36/#37's
context-level logic. The author verified manually instead (live on a dev
box, and against a downstream host's full suite going from 4 warnings to 0)
in lieu of automated coverage — reasonable given the constraint, not a gap
to fix here.

## What Was Done Well

- Fix is scoped to exactly the three forms that needed it — grepped the file
  to confirm no `<.form>` was missed and none already had an id.
- Id components chosen for the actual, verified risk in each case (cross-page
  same-comment collision doesn't need guarding against here; cross-instance
  collision on the composer does), rather than uniformly maximalist keys.
- Matches an id-naming convention that already existed in the same file
  (audio-recorder, Giphy-search), so the codebase doesn't now have two
  different schemes for "this component instance + this sub-item."
- PR description itself did the tracing (warning → root cause → verification
  against a real host app), leaving little for review to second-guess.

## Files Touched (this review)

| File | Change |
|------|--------|
| `mix.exs` | Version bump 0.4.3 → 0.4.4 |
| `CHANGELOG.md` | 0.4.4 entry |

## Verification

- `mix precommit` (compile --warnings-as-errors, deps.unlock --check-unused,
  hex.audit, quality.ci = format --check-formatted + credo --strict +
  dialyzer): clean.
- `mix test`: 90 tests, 0 failures.
