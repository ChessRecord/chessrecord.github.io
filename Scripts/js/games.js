// games.js - Index page controller

/* --- Initialization --- */
window.games = JSON.parse(localStorage.getItem("chessGames")) || [];
window.searchTerm = "";

/* --- Search Logic --- */
const searchInput = document.getElementById("searchInput");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    window.searchTerm = e.target.value;
    displayGames(e.target.value);
  });
}

function toggleSearchParameters() {
  const searchParameters = document.getElementById("searchParameters");
  if (searchParameters) {
    searchParameters.style.display =
      searchParameters.style.display === "none" ? "block" : "none";
  }
}

const searchSettings = document.getElementById("searchSettings");
if (searchSettings) {
  searchSettings.addEventListener("click", toggleSearchParameters);
}

/* --- Initial Render --- */
document.addEventListener("DOMContentLoaded", () => {
  displayGames();
});
