# Follow-up Items for PR #38

Triaged 2026-08-24 against `main` (`899475b`). Reviewers: Codex, Gemini, four Claude triage passes.

## Fixed (Batch 1 — 2026-08-24, commit 899475b)

- ~~No `@spec` on `update_comment/3` for its new opts contract~~ — added (`lib/phoenix_kit_comments.ex`).

## Open — for Max to decide

- **Codex / Gemini: double delivery to a host that is subscribed AND hosts the component** (direct `send/2` + PubSub). The edit path mirrors the existing create/delete contract deliberately; changing it (e.g. `broadcast_from/4`, or dropping the direct send for all three actions) changes the documented host contract for create/delete too. Keep as is, or change all three together?
- **Component-level test for the `:updated` host message** — needs a host LiveView harness this repo does not have (its tests are context-level). Add the harness?

## Files touched

| File | Change |
|------|--------|
| `lib/phoenix_kit_comments.ex` | `@spec update_comment/3` |

## Verification

`mix precommit` green (2 pre-existing dialyzer entries skipped via the ignore file); `test/integration/edit_broadcast_test.exs`: 5 tests, 0 failures.

## Open

See above.
