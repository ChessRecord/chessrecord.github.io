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

/* --- Initial Render --- */
document.addEventListener("DOMContentLoaded", () => {
  displayGames();
});
