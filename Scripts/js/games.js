// Event listener for search input to filter games
const searchInput = document.getElementById("searchInput");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    window.searchTerm = e.target.value; // Store the search term
    displayGames(e.target.value);
  });
}

// Initialize the games variable from localStorage
window.games = JSON.parse(localStorage.getItem("chessGames")) || [];
window.searchTerm = ""; // Initialize the search term storage
// Call displayGames to render the games on page load
displayGames();
