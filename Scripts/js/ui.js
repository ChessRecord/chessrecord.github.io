// ui.js - Global UI behaviors (Dropdowns, etc.)

/* --- Dropdown Logic --- */
const hideDropdown = () => {
  const dropdown = document.querySelector(".dropdown");
  if (dropdown) dropdown.classList.remove("show");
};
const showDropdown = () => {
  const dropdown = document.querySelector(".dropdown");
  if (dropdown) dropdown.classList.toggle("show");
};

/* --- Global UI Helpers --- */
function refreshTitle() {
  document.querySelectorAll(".title").forEach(function (titleElement) {
    const content = titleElement.textContent.trim().toLowerCase();
    if (!content || content === "none") {
      titleElement.style.display = "none";
    } else {
      titleElement.style.display = "";
    }
  });
}

/* --- Global UI Initializer --- */
const initGlobalUI = () => {
  const optionsButton = document.querySelector(".options");
  const dropdown = document.querySelector(".dropdown");

  if (optionsButton) {
    optionsButton.addEventListener("click", (e) => {
      e.stopPropagation();
      showDropdown();
    });
  }

  if (dropdown) {
    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target)) {
        hideDropdown();
      }
    });
  }
};

document.addEventListener("DOMContentLoaded", initGlobalUI);
