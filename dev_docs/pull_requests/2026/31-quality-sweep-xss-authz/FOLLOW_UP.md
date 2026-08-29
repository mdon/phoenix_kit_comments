# PR #31 follow-up — Quality sweep: stored XSS, authorization gaps, test harness

Triaged 2026-08-28 as part of the four-repo quality sweep. The review's verdict
was "merged, no changes required" — it found no defects in the PR and verified
the XSS fix independently by running the five payloads through the merged
renderer. It left exactly one thing open, which this pass closes.

## Fixed (Batch 1 — 2026-08-28)

- ~~**Not verified here:** the integration suite (8 tests, including
  `test/integration/reactions_test.exs`, "which is where the row-locking dedup
  fix is actually exercised") needed Postgres, which the review environment did
  not have. The reaction-counter fixes were reviewed by reading only, with the
  note: "Worth running that file against a real database before relying on the
  counter behaviour."~~ Run against a real database: **22 integration tests, 0
  failures**, `reactions_test.exs` included. The row-locking dedup, the
  `delete_all`-vs-decrement drift fix, and the repeat-click notification path
  are now exercised rather than read.

## Skipped (with rationale)

None — the review raised no findings to defer.

## Files touched

None. The open item was a verification gap, not a code gap.

## Verification

| Step | Result |
|---|---|
| `mix test test/integration/` | 22 tests, 0 failures (the previously-unrunnable half) |
| `mix test` | 90 tests, 0 failures |
| `mix precommit` | passes |

## Open

None.
