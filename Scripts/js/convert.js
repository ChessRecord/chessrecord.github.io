// PGN to JSON converter for your format
function pgnToJson(pgn) {
  const games = pgn.split(/\n\n(?=\[Event )/).filter(Boolean);
  return games.map((game, idx) => {
    const getTag = (tag) => {
      const match = game.match(new RegExp(`\\[${tag} "([^"]*)"\\]`));
      return match ? match[1] : "";
    };
    let resultStr = getTag("Result");
    if (resultStr === "1/2-1/2") resultStr = "½-½";
    return {
      white: getTag("White"),
      whiteRating: getTag("WhiteElo"),
      whiteTitle: "",
      black: getTag("Black"),
      blackRating: getTag("BlackElo"),
      blackTitle: "",
      result: resultStr,
      tournament: getTag("StudyName") || getTag("Event").split(":")[0],
      round: idx + 1,
      time: getTag("TimeControl"),
      date: getTag("Date") ? getTag("Date").replace(/\./g, "-") : "",
      gameLink: getTag("ChapterURL")
    };
  });
}

window.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('PGN-Form');
  const textarea = document.getElementById('PGN');
  const output = document.getElementById('JSON');

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const pgn = textarea.value.trim();
    if (!pgn) {
      alert('Please enter a PGN value.');
      return;
    }
    const json = pgnToJson(pgn);
    const formatted = JSON.stringify(json, null, 2);

    // Extract event name from first game
    let eventName = (pgn.match(/\[Event "([^"]*)"\]/) || [,'chess_event'])[1];
    if (eventName.includes(':')) {
      eventName = eventName.substring(0, eventName.lastIndexOf(':')).trim();
    }
    eventName = eventName.replace(/[^a-z0-9\-_ ]/gi, '_');
    const filename = eventName + '.json';

    const blob = new Blob([formatted], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  });
});