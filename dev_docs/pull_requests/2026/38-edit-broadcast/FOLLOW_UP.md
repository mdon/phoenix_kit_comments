# Follow-up Items for PR #38

Triaged 2026-08-24 against `main` (`899475b`). Reviewers: Codex, Gemini, four Claude triage passes, Grok.

## Fixed (Batch 1 — 2026-08-24, commit 899475b)

- ~~No `@spec` on `update_comment/3` for its new opts contract~~ — added (`lib/phoenix_kit_comments.ex`).

## Fixed (Batch 2 — 2026-08-24, Grok review)

- ~~Public live-update contract still listed `:created | :deleted | :reaction`~~ — `subscribe/2`, README example, README `handle_info/2` catch-all warning, and the test helper comment now include `:updated` / edit.

## Open — for Max to decide

- **Codex / Gemini: double delivery to a host that is subscribed AND hosts the component** (direct `send/2` + PubSub). The edit path mirrors the existing create/delete contract deliberately; changing it (e.g. `broadcast_from/4`, or dropping the direct send for all three actions) changes the documented host contract for create/delete too. Keep as is, or change all three together? Grok re-verified: catalogue `item_form_live` is that host and treats the message as an idempotent `refresh_comment_previews/1`.
- **Component-level test for the `:updated` host message** — needs a host LiveView harness this repo does not have (its tests are context-level). Add the harness?

## Files touched

| File | Change |
|------|--------|
| `lib/phoenix_kit_comments.ex` | `@spec update_comment/3` (batch 1); `subscribe/2` docs (batch 2) |
| `README.md` | live-update example + catch-all include edit (batch 2) |

## Verification

See `GROK_REVIEW.md`.

## Open

See above.
