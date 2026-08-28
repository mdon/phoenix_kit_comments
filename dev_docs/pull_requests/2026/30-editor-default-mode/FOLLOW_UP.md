# PR #30 follow-up — Open comment editors in the admin-configured default mode

Triaged 2026-08-28 as part of the four-repo quality sweep. Every finding in
`CLAUDE_REVIEW.md` was fixed by the reviewer at review time; this pass
re-verified each against current code, and found that the environment has
since moved underneath two of them.

## Fixed (pre-existing)

- ~~**BUG - CRITICAL:** `PhoenixKit.Settings.get_editor_mode/0` does not
  exist — every render of the component raised `UndefinedFunctionError`.~~
  Capability probe still in place at
  `lib/phoenix_kit_comments/web/comments_component.ex:2481`
  (`Code.ensure_loaded?/1` + `function_exported?/3`, `rescue` to the default),
  with the `@compile {:no_warn_undefined, ...}` pragma at `:86`.
  **Resolved at the source since the review:** core now exports the function
  (`phoenix_kit/lib/phoenix_kit/settings/settings.ex:1315`) and this module
  pins `~> 2.0` (lock resolves 2.13.7), so the probe now finds it and the
  setting is actually honoured. The probe stays as the guard for anyone on an
  older core.
- ~~**BUG - HIGH:** a string setting value would crash inside Leaf, whose
  `normalize_mode/2` has no catch-all.~~ `__normalize_editor_mode__/1` still
  funnels every value at `:2494-2500`, pinned to `@leaf_editor_modes` at `:91`
  with the four atoms, their string forms, and `:hybrid` for everything else.
- ~~**IMPROVEMENT - MEDIUM:** a settings read on every re-render for a value
  Leaf only honours once.~~ `assign_new(:editor_mode, &default_editor_mode/0)`
  at `:271` — one read per component lifetime.
- ~~**BUG - MEDIUM:** stale `:beamlab_ex_aws_sqs` lock entry broke
  `mix deps.unlock --check-unused` (step 2 of `mix precommit`).~~ Gate runs
  clean; the remaining `beamlab_ex_aws_sqs` strings in `mix.lock` are the
  legitimate `hex:` rename inside core's own `ex_aws_sqs` entry.
- ~~The documented `call_to_missing` entry in `.dialyzer_ignore.exs`.~~
  Correctly **removed** since the review — exactly as it anticipated ("with a
  note to delete it once the pin moves to a core that exports the function").
  `.dialyzer_ignore.exs` now carries only the Gettext opaque-struct skip, and
  dialyzer passes with 0 unnecessary skips.

## Skipped (with rationale)

- **OBSERVATION: mode changes don't reach an already-open editor.** Left as-is
  by the review on purpose — Leaf's `assign_new(:mode, ...)` protects a user's
  own in-editor mode toggle from parent re-renders, and forcing the new
  default would stomp on it. Re-confirmed: still Leaf's behaviour, still the
  right trade.
- **OBSERVATION: `@ctx` plumbing is correct.** Recorded by the review as a
  positive finding, not a defect. Nothing to do.

## Files touched

None. This pass was verification only.

## Verification

| Step | Result |
|---|---|
| `mix precommit` | passes (compile --warnings-as-errors, deps.unlock --check-unused, hex.audit, quality.ci) |
| `mix test` | 90 tests, 0 failures |
| `mix test test/integration/` | 22 tests, 0 failures |

## Open

None.
