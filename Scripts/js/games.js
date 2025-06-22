// Event listener for search input to filter games
const searchInput = document.getElementById("searchInput");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    displayGames(e.target.value);
  });
}

// Initialize the games variable from localStorage
window.games = JSON.parse(localStorage.getItem("chessGames")) || [];
// Call displayGames to render the games on page load
displayGames();