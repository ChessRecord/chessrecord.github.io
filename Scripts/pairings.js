function expectedScore(myRating, oppRating) {
  return 1 / (1 + Math.pow(10, (oppRating - myRating) / 400));
}

function calcChange(myRating, oppRating, result, k = 40) {
  const E = expectedScore(myRating, oppRating);
  return Math.round(k * (result - E) * 10) / 10;
}

async function scrapeChessResults(url) {
  const proxy = "https://api.allorigins.win/raw?url=";
  const fullUrl = proxy + encodeURIComponent(url);

  const response = await fetch(fullUrl);
  const htmlText = await response.text();

  const $html = $("<div>").html(htmlText);
  const rows = $html.find("table").eq(4).find("tr");

  const pairings = [];

  rows.each((i, row) => {
    if (i % 2 === 1) {
      const cells = $(row)
        .find("td")
        .map((_, cell) => $(cell).text().trim())
        .get();

      if (cells.length >= 9) {
        const pairing = {
            round: cells[0],
            boardNo: cells[1],
            playerStartNo: cells[2],
            opponentTitle: cells[3],
            opponentName: cells[4],
            opponentRating: parseInt(cells[5]) || 0,
            opponentClub: cells[6],
            opponentPoints: cells[7],
            result: cells[8],
            playerColor: $(row).find("td:eq(8) div.FarbesT").length > 0 
              ? "Black" 
              : $(row).find("td:eq(8) div.FarbewT").length > 0 
              ? "White" 
              : ""
        };          

        pairings.push(pairing);
      }
    }
  });

  const playerInfo = {};
  const knownKeys = new Set([
    "Name",
    "Starting rank",
    "Rating",
    "Rating national",
    "Rating international",
    "Performance rating",
    "FIDE rtg +/-",
    "Points",
    "Rank",
    "Federation",
    "Club/City",
    "Ident-Number",
    "Fide-ID",
    "Year of birth"
  ]);

  const infoRows = $html.find("table").eq(3).find("tr");

  infoRows.each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length >= 2) {
      const key = $(cells[0]).text().trim().replace(/:$/, "");
      const value = $(cells[1]).text().trim();
      if (knownKeys.has(key)) {
        playerInfo[key] = value;
      }
    }
  });

  return { playerInfo, pairings };
}

async function handleFetch() {
  const url = document.getElementById("url-input").value.trim();
  const summary = document.getElementById("rating-summary");
  const error = document.getElementById("error");

  summary.textContent = "";
  error.textContent = "";

  if (!url.includes("chess-results.com")) {
    error.textContent = "❌ Please enter a valid Chess-Results URL.";
    return;
  }

  try {
    const { playerInfo, pairings } = await scrapeChessResults(url);
    //output.textContent = JSON.stringify({ playerInfo, pairings }, null, 2);

    const rating = parseInt(playerInfo["Rating"]);
    const rtgchg = parseFloat(playerInfo["FIDE rtg +/-"].replace(",", "."));
    if (isNaN(rating)) {
      error.textContent = "❌ Could not detect your rating from the page.";
      return;
    }

    const lastOpponent = pairings[pairings.length - 1];
    if (!lastOpponent) {
      summary.textContent = "No opponents found.";
      return;
    }

    const oppRating = lastOpponent.opponentRating;
    const win = calcChange(rating, oppRating, 1);
    const draw = calcChange(rating, oppRating, 0.5);
    const loss = calcChange(rating, oppRating, 0);

    summary.innerHTML = `
    <span class="inlineForm" style="width: 100%; display: flex;gap:5rem;align-items: center;">
    <span>
      🧠 ${playerInfo["Name"]}<span class="player-rating">${rating}</span><br>
      🎯 Opponent: ${lastOpponent.opponentTitle ? `<span class="title">${lastOpponent.opponentTitle}</span> ` : ''}${lastOpponent.opponentName} <span class="player-rating">${oppRating}</span><br>
      ♟️ Board: <strong>${lastOpponent.boardNo}</strong><br>
      🌗 Color: <strong>${lastOpponent.playerColor}</strong><br>
    </span>
    <span style="text-align: right;">
      🏆 Win: <strong>${rating + rtgchg + win}</strong> ${win >= 0 ? "+ " : "- "}${Math.abs(win)}<br>
      🤝 Draw: <strong>${rating + rtgchg + draw}</strong> ${draw >= 0 ? "+ " : "- "}${Math.abs(draw)}<br>
      🏳️ Loss: <strong>${rating + rtgchg + loss}</strong> ${loss >= 0 ? "+ " : "- "}${Math.abs(loss)}<br>
    </span>
    </span>
    `;
  } catch (err) {
    error.textContent = "❌ Error fetching or parsing data. See console.";
    console.error(err);
  }
}
