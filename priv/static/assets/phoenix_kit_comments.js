// phoenix_kit_comments JS hooks — folded into the host LiveSocket by core's
// :phoenix_kit_js_sources compiler (see PhoenixKit.Module.js_sources/0).
//
// These used to be inline <script> tags inside the component and settings
// templates. That works on a hard page load — the script runs during HTML
// parse, before app.js constructs the LiveSocket and snapshots
// window.PhoenixKitHooks — and fails on every LiveView NAVIGATION, because
// morphdom does not execute inserted <script> tags and the hooks map was
// fixed at construction. Verified on a dev box before this move: navigating
// to Settings -> Comments logged `unknown hook found for "InsertAtCursor"`
// four times and the template-variable inserter did nothing.
(function () {
  "use strict";

  window.PhoenixKitCommentsHooks = window.PhoenixKitCommentsHooks || {};

  // Audio recording in the comment composer.
  (function() {
    window.PhoenixKitCommentsHooks = window.PhoenixKitCommentsHooks || {};
    if (window.PhoenixKitCommentsHooks.PhoenixKitCommentsAudioRecorder) return;
    window.PhoenixKitCommentsHooks.PhoenixKitCommentsAudioRecorder = {
      mounted() {
        this.recording = false;
        this.recorder = null;
        this.stream = null;
        this.chunks = [];
        this._onToggle = () => {
          if (this.recording) this.stop(); else this.start();
        };
        window.addEventListener("phx-kit-comments-audio-toggle", this._onToggle);
      },
      destroyed() {
        window.removeEventListener("phx-kit-comments-audio-toggle", this._onToggle);
        this.cleanup();
      },
      async start() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          this.pushError("unsupported");
          return;
        }
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
          this.pushError("denied");
          return;
        }
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
        try {
          this.recorder = new MediaRecorder(this.stream, { mimeType });
        } catch (err) {
          this.cleanup();
          this.pushError("start_failed");
          return;
        }
        this.chunks = [];
        this.recorder.addEventListener("dataavailable", (ev) => {
          if (ev.data && ev.data.size > 0) this.chunks.push(ev.data);
        });
        this.recorder.addEventListener("stop", () => this.finalize(mimeType));
        this.recorder.start();
        this.recording = true;
        this.pushEventTo(this.el, "audio_recording_started", {});
      },
      stop() {
        if (this.recorder && this.recorder.state !== "inactive") {
          this.recorder.stop();
        }
      },
      finalize(mimeType) {
        const blob = new Blob(this.chunks, { type: mimeType });
        const ext = mimeType.indexOf("webm") >= 0 ? "webm" : "ogg";
        const name = "voice-" + new Date().toISOString().replace(/[:.]/g, "-") + "." + ext;
        const file = new File([blob], name, { type: mimeType });
        const uploadName = this.el.dataset.uploadName || "attachment";
        try {
          this.upload(uploadName, [file]);
        } catch (err) {
          this.pushError("attach_failed");
        }
        this.recording = false;
        this.cleanup();
        this.pushEventTo(this.el, "audio_recording_stopped", {});
      },
      cleanup() {
        if (this.stream) {
          this.stream.getTracks().forEach((t) => t.stop());
          this.stream = null;
        }
        this.recorder = null;
        this.chunks = [];
      },
      // A reason CODE, never prose. The server maps it to a translated
      // string: the old version pushed English sentences that landed in
      // the flash untranslated in every locale, and let any client paint
      // arbitrary text in the app's own error chrome.
      pushError(reason) {
        this.pushEventTo(this.el, "audio_recording_error", { reason: reason });
        this.cleanup();
        this.recording = false;
      }
    };
  })();

  // Template-variable insertion on the settings page.
  (function() {
    window.PhoenixKitCommentsHooks = window.PhoenixKitCommentsHooks || {};
    if (window.PhoenixKitCommentsHooks.PhoenixKitCommentsInsertAtCursor) return;
    window.PhoenixKitCommentsHooks.PhoenixKitCommentsInsertAtCursor = {
      mounted() {
        this._lastInput = null;
        this._lastCursorPos = 0;
        this._abortController = null;
        this.setup();
      },
      updated() { this.setup(); },
      destroyed() {
        if (this._abortController) this._abortController.abort();
      },
      colorBadges() {
        var container = this.el;
        var input = this._lastInput;
        var val = input ? input.value : "";
        container.querySelectorAll("[data-field]").forEach(function(badge) {
          var used = val && val.indexOf(badge.dataset.field) !== -1;
          badge.classList.remove("badge-success", "badge-ghost");
          badge.classList.add(used ? "badge-success" : "badge-ghost");
        });
      },
      setup() {
        if (this._abortController) this._abortController.abort();
        this._abortController = new AbortController();
        var signal = this._abortController.signal;
        var self = this;
        var container = this.el;
        var trackCursor = function(input) {
          self._lastInput = input;
          self._lastCursorPos = input.selectionStart;
          self.colorBadges();
        };
        container.querySelectorAll("textarea, input[type='text']").forEach(function(input) {
          input.addEventListener("focus", function() { trackCursor(input); }, { signal: signal });
          input.addEventListener("keyup", function() { trackCursor(input); }, { signal: signal });
          input.addEventListener("click", function() { trackCursor(input); }, { signal: signal });
          input.addEventListener("input", function() { self.colorBadges(); }, { signal: signal });
        });
        self.colorBadges();
        container.querySelectorAll("[data-field]").forEach(function(badge) {
          badge.style.cursor = "pointer";
          badge.addEventListener("click", function(e) {
            e.preventDefault();
            var input = self._lastInput || container.querySelector("textarea, input[type='text']");
            if (!input) return;
            var val = badge.dataset.field;
            var pos = self._lastCursorPos || 0;
            input.value = input.value.slice(0, pos) + val + input.value.slice(pos);
            var newPos = pos + val.length;
            self._lastCursorPos = newPos;
            input.selectionStart = input.selectionEnd = newPos;
            input.focus();
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }, { signal: signal });
        });
      }
    };
  })();
})();
