/**
 * modal.js — Centralised modal system
 *
 * Usage:
 *   const result = await Modal.confirm({ ... });
 *   Modal.alert({ ... });
 *   Modal.hide();
 *
 * Replaces the inline modal code previously embedded in importJSON().
 * Requires: modal.css, Font Awesome (for icons).
 */

const Modal = (() => {
  // ─── Internals ────────────────────────────────────────────────────────────

  /** Lazily create (or reuse) the #blur backdrop element. */
  function getBackdrop() {
    let backdrop = document.getElementById("blur");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "blur";
      backdrop.className = "blur hidden";
      document.body.appendChild(backdrop);
    }
    return backdrop;
  }

  /** Show the backdrop and inject dialog HTML into it. */
  function mount(html) {
    const backdrop = getBackdrop();
    backdrop.innerHTML = html;
    backdrop.classList.replace("hidden", "visible");
    return backdrop;
  }

  /** Hide the backdrop and clear its contents. */
  function hide() {
    const backdrop = getBackdrop();
    backdrop.classList.replace("visible", "hidden");
    backdrop.innerHTML = "";
  }

  /**
   * Core builder — renders a modal and resolves a Promise with the button id
   * that was clicked (or null for cancel / Escape / backdrop).
   *
   * @param {Object} opts
   * @param {string}   [opts.icon]     Font Awesome classes, e.g. "fa-solid fa-triangle-exclamation warning-big"
   * @param {string}   [opts.title]    Heading text
   * @param {string}   [opts.body]     Optional paragraph text below the heading
   * @param {Array}    opts.buttons    Array of { id, label, classes } descriptors
   * @returns {Promise<string|null>}   Resolves with the clicked button id, or null on dismiss
   */
  function open({ icon = "", title = "", body = "", buttons = [] }) {
    return new Promise((resolve) => {
      const iconHtml = icon ? `<i class="${icon}"></i>` : "";

      const bodyHtml = body ? `<p>${body}</p>` : "";

      const buttonsHtml = buttons
        .map(
          ({ id, label, classes = "btn" }) =>
            `<button class="${classes}" id="${id}">${label}</button>`,
        )
        .join("");

      const html = `
        <div class="confirmation" role="dialog" aria-modal="true" aria-label="${title}">
          <div class="cancel" id="modalCancelBtn" title="Close">&times;</div>
          ${iconHtml}
          ${title ? `<h3>${title}</h3>` : ""}
          ${bodyHtml}
          <div class="options">${buttonsHtml}</div>
        </div>
      `;

      const backdrop = mount(html);

      // ── Focus trap: put focus inside the dialog ──────────────────────────
      const dialog = backdrop.querySelector(".confirmation");
      const firstFocusable = dialog.querySelector("button");
      firstFocusable?.focus();

      // ── Resolve helper ───────────────────────────────────────────────────
      const finish = (value) => {
        backdrop.removeEventListener("click", onClick);
        document.removeEventListener("keydown", onKeydown);
        hide();
        resolve(value);
      };

      // ── Click handler (event delegation) ────────────────────────────────
      const onClick = (e) => {
        // Dismiss on bare backdrop click
        if (e.target === backdrop) {
          finish(null);
          return;
        }

        const el = e.target.closest("[id]");
        if (!el) return;

        if (el.id === "modalCancelBtn") {
          finish(null);
        } else {
          finish(el.id);
        }
      };

      // ── Keyboard handler ─────────────────────────────────────────────────
      const onKeydown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          finish(null);
        }
      };

      backdrop.addEventListener("click", onClick);
      document.addEventListener("keydown", onKeydown);
    });
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Show a two-action confirmation dialog.
   * Returns a Promise that resolves to the clicked button id or null.
   *
   * Common use-case (replaces the inline modal from importJSON):
   *
   *   const choice = await Modal.confirm({
   *     icon:    "fa-solid fa-triangle-exclamation warning-big",
   *     title:   "Do you want to replace or append your games?",
   *     confirm: { id: "appendBtn",  label: "Append"  },
   *     cancel:  { id: "replaceBtn", label: "Replace", classes: "btn outline" },
   *   });
   *
   *   if (choice === "appendBtn")  { ... }
   *   if (choice === "replaceBtn") { ... }
   *   if (choice === null)         { /* dismissed *\/ }
   */
  function confirm({
    icon = "fa-solid fa-triangle-exclamation warning-big",
    title = "Are you sure?",
    body = "",
    confirm: confirmBtn = {
      id: "confirmBtn",
      label: "Confirm",
      classes: "btn",
    },
    cancel: cancelBtn = {
      id: "cancelActionBtn",
      label: "Cancel",
      classes: "btn outline",
    },
  } = {}) {
    return open({
      icon,
      title,
      body,
      buttons: [cancelBtn, confirmBtn],
    });
  }

  /**
   * Show an informational alert with a single dismiss button.
   * Returns a Promise that resolves when dismissed.
   *
   *   await Modal.alert({ title: "Done!", body: "Games imported successfully." });
   */
  function alert({
    icon = "fa-solid fa-circle-info",
    title = "",
    body = "",
    okLabel = "OK",
  } = {}) {
    return open({
      icon,
      title,
      body,
      buttons: [{ id: "modalOkBtn", label: okLabel, classes: "btn" }],
    });
  }

  /**
   * Programmatically close any open modal.
   */
  function hideModal() {
    hide();
  }

  return { confirm, alert, hide: hideModal, _open: open };
})();
