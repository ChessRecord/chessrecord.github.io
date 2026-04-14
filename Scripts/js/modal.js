// modal.js

const Modal = (() => {
  function getBackdrop() {
    let el = document.getElementById("blur");
    if (!el) {
      el = document.createElement("div");
      el.id = "blur";
      el.className = "blur hidden";
      document.body.appendChild(el);
    }
    return el;
  }

  // Accepts raw HTML string. Resolves with the data-modal-action value, or null on dismiss.
  function open(html) {
    return new Promise((resolve) => {
      const backdrop = getBackdrop();
      backdrop.innerHTML = html;
      backdrop.classList.replace("hidden", "visible");

      const finish = (value) => {
        backdrop.removeEventListener("click", onClick);
        document.removeEventListener("keydown", onKeydown);
        backdrop.classList.replace("visible", "hidden");
        backdrop.innerHTML = "";
        resolve(value);
      };

      const onClick = (e) => {
        if (e.target === backdrop) { finish(null); return; }
        const el = e.target.closest("[data-modal-action]");
        if (el) finish(el.dataset.modalAction === "cancel" ? null : el.dataset.modalAction);
      };

      const onKeydown = (e) => {
        if (e.key === "Escape") { e.preventDefault(); finish(null); }
      };

      backdrop.addEventListener("click", onClick);
      document.addEventListener("keydown", onKeydown);
    });
  }

  // Built-in confirmation dialog helper.
  // buttons: Array of { action, label, classes }
  function confirm({ icon = "", title = "", buttons = [] } = {}) {
    const iconHtml = icon ? `<i class="${icon}"></i>` : "";
    const buttonsHtml = buttons
      .map(({ action, label, classes = "btn" }) =>
        `<button class="${classes}" data-modal-action="${action}">${label}</button>`)
      .join("");
    return open(`
      <div class="confirmation">
        <div class="cancel" data-modal-action="cancel" title="Cancel">&times;</div>
        ${iconHtml}
        ${title ? `<h3>${title}</h3>` : ""}
        <div class="options">${buttonsHtml}</div>
      </div>`);
  }

  function hide() {
    const backdrop = getBackdrop();
    backdrop.classList.replace("visible", "hidden");
    backdrop.innerHTML = "";
  }

  return { open, confirm, hide };
})();


const Toast = (() => {
  const DURATION = 4000;

  function getContainer() {
    let el = document.getElementById("toastContainer");
    if (!el) {
      el = document.createElement("div");
      el.id = "toastContainer";
      document.body.appendChild(el);
    }
    return el;
  }

  function show(message, duration = DURATION) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
      <span>${message}</span>
      <button class="toast-dismiss" aria-label="Dismiss">&times;</button>
      <div class="toast-progress" style="animation-duration:${duration}ms"></div>`;

    const dismiss = () => {
      clearTimeout(timer);
      toast.classList.add("toast-out");
      toast.addEventListener("animationend", () => toast.remove(), { once: true });
    };

    toast.querySelector(".toast-dismiss").addEventListener("click", dismiss);
    const timer = setTimeout(dismiss, duration);
    getContainer().appendChild(toast);
  }

  return { show };
})();
