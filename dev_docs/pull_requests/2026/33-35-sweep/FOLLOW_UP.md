# PRs #33, #34, #35 follow-up — sweep review

Triaged 2026-08-28 as part of the four-repo quality sweep. The review fixed
its one MEDIUM at review time and deliberately left two things for "next time
that file is open". This is that time, so both are done here.

## Fixed (pre-existing)

- ~~**PR #35: taking the PR's `resource_handler.ex` wholesale would have
  silently dropped `resolve_comment_resources/1` from the contract**, breaking
  hosts that implement it with `@impl true`.~~ Resolved by keeping main's
  seven-callback superset and grafting the PR's additions. Verified still in
  place: the callback is declared (`resource_handler.ex:86`), listed in
  `@optional_callbacks` (`:108`), `callbacks/0` exists (`:124`), and
  `test/resource_handler_test.exs:52` pins `{:resolve_comment_resources, 1}`
  in `callbacks/0` — a direct regression test for the resolution itself.
- ~~**PR #34, BUG - MEDIUM:** `count_replies/2` reported zeros silently — a
  failed query became `0` for every parent with nothing logged, and "0
  replies" is a *plausible* wrong answer rather than an obviously broken
  one.~~ Fixed on main; `Logger.warning` with the failure reason and the
  number of parents affected still present at `lib/phoenix_kit_comments.ex:816-828`.
- ~~**PR #33:** fuzzy `msgstr` entries silently falling back to English, and
  two plural forms that had dropped their `%{action}` interpolation.~~ Fixed
  in the PR; nothing to re-verify beyond the catalogues, which are unchanged.

## Fixed (Batch 1 — 2026-08-28)

- ~~**PR #34 note:** "The same shape exists in the pre-existing
  `count_comments/3` (`rescue _ -> 0`). Left alone: it is out of this PR's
  scope … but it is worth the same treatment next time that file is open."~~
  Done. Both `count_comments/3` clauses (the batch form and the single-uuid
  form) now log at `:warning` with the resource type, the count or uuid
  affected, and the exception message before degrading to zeros. The zeros
  stay — a listing that renders beats one that crashes — but they are now
  traceable. Found and given the same treatment: the private
  `count_all_comments/1`, which fed the moderation dashboard's totals from an
  identical silent `rescue _ -> 0`.
- ~~**PR #34:** "Test coverage for the metadata paths is the empty-match guard
  only; the query paths need a database, which this environment has not
  got."~~ Added `test/integration/metadata_test.exs` — 9 tests against a real
  database covering what the review could not reach:
  - `list_comments/3` with `:metadata` filters on every key given (ANDed, so
    two keys narrow rather than widen), and an empty or absent match is not a
    filter;
  - the `->>` text comparison means `1` and `"1"` are the same question — the
    property the review argued for over `@>` containment;
  - `update_metadata/2` merges without disturbing other keys, **and still
    applies to a row whose `metadata` is NULL** (the load-bearing `COALESCE` —
    this test fails without it), accepts a struct or a uuid, and reports
    `{:error, :not_found}` for a missing row;
  - `merge_metadata/3` retargets only matching rows, returns the count, stays
    scoped to its `resource_type`, and refuses an empty match rather than
    rewriting every comment of that type.

## Skipped (with rationale)

- **PR #34 notes on `apply_metadata_filter/2` (`->>` vs `@>`) and
  `merge_metadata/3` rewriting soft-deleted comments.** Both recorded by the
  review as deliberate and correct, not defects. The `->>` choice is now
  pinned by a test rather than only argued in prose.

## Files touched

| File | Change |
|---|---|
| `lib/phoenix_kit_comments.ex` | `count_comments/3` (both clauses) and `count_all_comments/1` log before degrading to zeros |
| `test/integration/metadata_test.exs` | New — 9 tests over the metadata read/write paths |

## Verification

| Step | Result |
|---|---|
| `mix test` | 99 tests, 0 failures |
| `mix test test/integration/` | 31 tests, 0 failures |
| `mix precommit` | passes |

## Open

None.
