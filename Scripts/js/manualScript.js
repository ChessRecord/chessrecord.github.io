// Attach games to the global window object
window.games = JSON.parse(localStorage.getItem("chessGames")) || [];

window.addEventListener("load", () => {
  const gameForm = document.getElementById("gameForm");
  if (gameForm) {
    gameForm.addEventListener("submit", addGame);
  }
});

function addGame(event) {
  event.preventDefault(); // Prevent form submission
  showLoader("#addGame span");

  const result = document.getElementById("result").value;

  if (result === "0") {
    alert("Please select a result!");
    hideLoader("#addGame span");
    return;
  }

  const playerWhite = formatName(capitalize(document.getElementById("playerWhite").value));
  const playerBlack = formatName(capitalize(document.getElementById("playerBlack").value));

  const whiteRating = parseInt(document.getElementById("whiteRating").value) || 0;
  const blackRating = parseInt(document.getElementById("blackRating").value) || 0;

  const time = document.getElementById("time").value || "";

  const tournament = document.getElementById("tournament").value;
  const round = parseInt(document.getElementById("round").value) || 1;
  const date = document.getElementById("date").value;

  const game = {
    id: generateUniqueID(),
    white: playerWhite,
    whiteRating: Number(whiteRating),
    whiteTitle: abbreviateTitle(document.getElementById("whiteTitle").value.toUpperCase()),
    black: playerBlack,
    blackRating: Number(blackRating),
    blackTitle: abbreviateTitle(document.getElementById("blackTitle").value.toUpperCase()),
    result: result,
    tournament: tournament,
    round: Number(round),
    time: time,
    date: date,
    gameLink: document.getElementById("gameLink").value,
  };

  if (window.games.some(g => 
    (g.white === playerWhite || g.black === playerBlack) && 
    g.date === date && 
    g.tournament === tournament && 
    g.round === round)) {
    hideLoader("#addGame span");
    alert("Game already exists or player conflict in this round!");
    return;
  }

  window.games.push(game);
  saveGames();
  event.target.reset();
  hideLoader("#addGame span");

  alert(
    `${toUnicodeVariant(
      game.whiteTitle,
      "bold sans",
      "sans"
    )} ${playerWhite} vs ${toUnicodeVariant(
      game.blackTitle,
      "bold sans",
      "sans"
    )} ${playerBlack} Game Added!`
  );
}
