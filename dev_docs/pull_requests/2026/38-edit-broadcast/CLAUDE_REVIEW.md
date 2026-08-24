# PR #38: Broadcast comment edits like creates and deletes

**Author**: @mdon
**Reviewers**: four Claude triage passes (read-only, claims re-verified in code)
**Date**: 2026-08-24
**URL**: https://github.com/BeamLabEU/phoenix_kit_comments/pull/38

## Findings

1. **NITPICK — `update_comment/3` gained an `opts` contract (`broadcast: false`) without a `@spec`.**
2. **Observation — a host that both hosts the component and subscribes to the resource topic receives `:updated` twice** (the component's direct `send/2` plus the PubSub broadcast). This is the same shape create and delete already have; hosts treat the message as a refresh signal.
3. **TEST GAP — the component's new `send(self(), {:comments_updated, action: :updated})` has no component-level test**; `edit_broadcast_test.exs` covers the context (5 tests incl. the muted path).
4. **Boundary trace (intact)**: every consumer in the workspace (`catalogue item_form_live`, posts, projects, staff, core media detail, `embed.ex`) matches `{:comments_updated, _}` totally or by resource type; none pattern-matches a closed action set, so `:updated` cannot crash a host.
