// Event listener for search input to filter games
const searchInput = document.getElementById("searchInput");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    window.currentSearchTerm = e.target.value; // Store the search term
    displayGames(e.target.value);
  });
}

// Initialize the games variable from localStorage
window.games = JSON.parse(localStorage.getItem("chessGames")) || [];
window.currentSearchTerm = ""; // Initialize the search term storage
// Call displayGames to render the games on page load
displayGames();
