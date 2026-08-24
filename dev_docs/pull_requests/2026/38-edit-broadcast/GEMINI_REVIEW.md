# PR #38 — Gemini review

**Reviewer**: Gemini (Antigravity `agy`, default model)
**Scope**: The single commit
**Date**: 2026-08-24
**Method**: Diff inlined

Verbatim output; every claim was re-verified against the code before acting — see `FOLLOW_UP.md` for the verdict on each.

---

**Defect: Double Broadcast to Parent LiveView**

* **File + Function:** `lib/phoenix_kit_comments/web/comments_component.ex` (`handle_event/3` edit handler)
* **What breaks:** Double broadcast / duplicate messages. `PhoenixKitComments.update_comment/3` now broadcasts `{:comments_updated, %{action: :updated, ...}}` over PubSub to the resource topic. If the parent LiveView subscribes to PubSub (as instructed in `CommentsComponent`'s moduledoc), it receives the update message twice on an edit: once from the PubSub broadcast and once from `send(self(), {:comments_updated, ...})`.
* **One-line fix:** Remove the explicit `send(self(), {:comments_updated, ...})` call in `CommentsComponent` (or pass `broadcast: false` to `update_comment/3`).
