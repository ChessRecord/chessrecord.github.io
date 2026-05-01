(function () {
  document.querySelectorAll(".custom-select").forEach(initSelect);

  function initSelect(wrapper) {
    const select = wrapper.querySelector("select");

    // ── Selected-value display ───────────────────────────────────────────
    const selected = document.createElement("div");
    selected.className = "select-selected";
    selected.textContent = select.options[select.selectedIndex].text;
    wrapper.appendChild(selected);

    // ── Options list (index 0 is the placeholder — skip it) ─────────────
    const items = document.createElement("div");
    items.className = "select-items select-hide";

    Array.from(select.options)
      .slice(1)
      .forEach((option, i) => {
        const item = document.createElement("div");
        item.textContent = option.text;
        item.dataset.index = i + 1; // preserves the real select index
        items.appendChild(item);
      });

    wrapper.appendChild(items);

    // ── Delegate option clicks to the container ──────────────────────────
    items.addEventListener("click", ({ target }) => {
      const item = target.closest("[data-index]");
      if (!item) return;

      const index = Number(item.dataset.index);
      select.selectedIndex = index;
      selected.textContent = select.options[index].text;

      items
        .querySelector(".same-as-selected")
        ?.classList.remove("same-as-selected");
      item.classList.add("same-as-selected");

      close(items, selected);
    });

    // ── Toggle this dropdown open/closed ─────────────────────────────────
    selected.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = !items.classList.contains("select-hide");
      closeAll();
      if (!isOpen) {
        items.classList.remove("select-hide");
        selected.classList.add("select-arrow-active");
      }
    });
  }

  function close(items, selected) {
    items.classList.add("select-hide");
    selected.classList.remove("select-arrow-active");
  }

  function closeAll() {
    document.querySelectorAll(".custom-select").forEach((wrapper) => {
      close(
        wrapper.querySelector(".select-items"),
        wrapper.querySelector(".select-selected"),
      );
    });
  }

  document.addEventListener("click", closeAll);
})();
