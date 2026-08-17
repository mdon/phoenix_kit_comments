# PR #37 — Add `allow_empty_content` for server-created anchor comments

**Author:** alexdont (Sasha Don)
**Reviewer:** Claude (post-merge review, 2026-08-17)
**Verdict:** Approve. One MEDIUM gap (missing docs + test coverage), fixed.
No correctness defects found.

---

## `create_comment/4` accepts `:allow_empty_content`

Server-side callers can now pass `allow_empty_content: true` in `attrs` so a
newly-created anchor/topic comment (e.g. one whose visible text is actually
an annotation's own label, rendered as the thread's decoration) doesn't have
to duplicate that label into the comment body just to satisfy the
content-or-media requirement. Same shape as PR #36's `:inserted_at`
backdating: a flag read directly off `attrs`, threaded through as a
changeset `opts` keyword, never part of `cast`.

Traced the whole path:

- `insert_comment_with_attachments/3` (no-attachment clause,
  `lib/phoenix_kit_comments.ex:495`) turns `attrs[:allow_empty_content] ==
  true` into `Comment.changeset(attrs, has_media: false, allow_empty: ...)`.
  The attachment clause (line 506) doesn't thread it, but doesn't need to —
  `has_media: true` already makes content optional there via
  `resolve_has_media/2`.
- `validate_has_body/2` (`lib/phoenix_kit_comments.ex:567`), the cheap
  pre-upload check shared by both `create_comment/4` and
  `precheck_create/5`, short-circuits on the same flag — so a LiveView form
  using `precheck_create/5` ahead of `consume_uploaded_entries/3` gets the
  same answer `create_comment/4` would give.
- `Comment.changeset/3`'s `do_validate_content_or_media/2`
  (`lib/phoenix_kit_comments/schemas/comment.ex:204`) skips the check
  entirely when `opts[:allow_empty]` is truthy, otherwise falls through to
  the existing content/GIF/media check unchanged.
- The exact string `attrs[:allow_empty_content] == true` is checked (not
  merely truthy), so `false`, `nil`, `"true"`, or an absent key all still
  enforce the normal rule — no accidental widening from a stray non-boolean
  value.
- No shipped call site can reach this from client input.
  `CommentsComponent.do_create_comment/2` builds `base_attrs` from named,
  hand-picked fields (`content`, `parent_uuid`, `metadata`, `attribution`) —
  same as PR #36 found for `:inserted_at` — so raw form/JSON params never
  reach `attrs[:allow_empty_content]`. Unlike `:inserted_at`, the flag isn't
  even excluded from `cast` by field type (there's no matching schema
  field), but it's read *before* the changeset is built, so `cast` never
  sees it either way.
- Editing an anchor comment created this way still enforces the normal rule:
  `update_comment/3` calls `Comment.changeset/2` with no `opts`, so
  `allow_empty` defaults to falsy there. Confirmed this is not a live bug —
  the decoration-label edit flow (`save_decoration` /
  `maybe_forward_decoration_update`) never calls `update_comment/3` at all;
  it forwards the label to the parent LiveView via `send_update`, decoupled
  from the Comment row's `content`/`metadata`. If a host ever does call
  `update_comment/3` on one of these comments with `content: ""`, it will
  correctly fail closed rather than silently re-permitting an empty body —
  documented as expected behavior below rather than "fixed," since forcing
  edits through the same escape hatch would let a client-editable path
  re-open a hole meant for server-only creation.

### IMPROVEMENT - MEDIUM: shipped with no docs and no test coverage — FIXED

`create_comment/4`'s moduledoc documents `:inserted_at` and
`:attachment_file_uuids` but said nothing about `:allow_empty_content`, and
`test/` had zero coverage for the new flag (mirrors what PR #36's review
found for `:inserted_at` two commits ago).

**Fixed:**

- Added `:allow_empty_content` to `create_comment/4`'s doc
  (`lib/phoenix_kit_comments.ex`), same "server-side callers only, never
  pass user input here" caveat as `:inserted_at`.
- Added `test/integration/empty_anchor_comments_test.exs`, five cases
  against a real database (via `PhoenixKitComments.DataCase`):
  - `allow_empty_content: true` creates and persists a comment with no
    content, GIF, or media;
  - `precheck_create/5` allows the same empty body ahead of upload;
  - an empty comment without the flag is still rejected
    (`{:error, :empty_comment}`);
  - `allow_empty_content: false` does not open the escape hatch;
  - editing an anchor comment's content later, then clearing it again,
    still fails the content-or-media check on update (the update path
    doesn't inherit the create-time escape hatch).

All five pass against the real schema. `mix test`: 85 tests, 0 failures
(80 pre-existing + 5 new).

---

## What Was Done Well

- The escape hatch is narrow and consistent with the existing
  `:inserted_at` pattern: read off `attrs` before `cast`, unreachable
  through the shipped LiveView form, exact `== true` check rather than
  general truthiness.
- `validate_has_body/2` and `Comment.changeset/3` were kept in sync — the
  cheap pre-upload check and the changeset's own validation agree, so
  `precheck_create/5` can't diverge from what `create_comment/4` actually
  does.
- Left the attachment-clause path (`insert_comment_with_attachments/3` with
  files) alone rather than threading `allow_empty` through it too — it
  isn't needed there, and adding it would have been dead code.

## Files Touched (this review)

| File | Change |
|------|--------|
| `lib/phoenix_kit_comments.ex` | Documented `:allow_empty_content` on `create_comment/4` |
| `test/integration/empty_anchor_comments_test.exs` | New — 5 tests locking in the `allow_empty_content` contract |
| `mix.exs` | Version bump 0.4.1 → 0.4.2 |
| `CHANGELOG.md` | 0.4.2 entry |

## Verification

- `mix quality.ci` (format --check-formatted, credo --strict, dialyzer): clean.
- `mix test`: 85 tests, 0 failures.
- `hex.audit` skipped per project convention — fails on core's transitive
  hackney CVEs, not a release blocker; `quality.ci` is the real gate here.
