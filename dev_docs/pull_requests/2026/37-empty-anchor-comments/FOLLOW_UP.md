# PR #37 follow-up — `allow_empty_content` for server-created anchor comments

Triaged 2026-08-28 as part of the four-repo quality sweep. The review found no
correctness defects and fixed its one MEDIUM (missing docs + tests) at review
time. Everything re-verified against current code; nothing left open.

## Fixed (pre-existing)

- ~~**IMPROVEMENT - MEDIUM:** the flag shipped with no documentation and no
  test coverage — `create_comment/4`'s moduledoc documented `:inserted_at` and
  `:attachment_file_uuids` but said nothing about `:allow_empty_content`.~~
  Documented at `lib/phoenix_kit_comments.ex:424` with the same "server-side
  callers only" caveat, and `test/integration/empty_anchor_comments_test.exs`
  passes 5 tests: the flag creates and persists an empty comment;
  `precheck_create/5` agrees with `create_comment/4` ahead of upload; an empty
  comment without the flag is still `{:error, :empty_comment}`;
  `allow_empty_content: false` does not open the hatch; and editing such a
  comment later still fails the content-or-media check.
- ~~The narrowness argument for the hatch.~~ Re-verified: the exact
  `attrs[:allow_empty_content] == true` comparison is still in both places
  that read it (`:507` threading it into `Comment.changeset/3` as
  `allow_empty:`, and `:583` short-circuiting `validate_has_body/2`), so
  `false`, `nil`, `"true"` and an absent key all still enforce the normal
  rule.

## Skipped (with rationale)

- **`update_comment/3` does not inherit the create-time escape hatch.**
  Documented by the review as expected behaviour rather than fixed: routing
  edits through the same hatch would let a client-editable path re-open a hole
  meant for server-only creation. It fails closed, which is the right
  direction. Confirmed still the case, and pinned by the fifth test in the
  file.

## Files touched

None. This pass was verification only.

## Verification

| Step | Result |
|---|---|
| `mix test test/integration/empty_anchor_comments_test.exs` | 5 tests, 0 failures |
| `mix test` | 99 tests, 0 failures |
| `mix precommit` | passes |

## Open

None.
