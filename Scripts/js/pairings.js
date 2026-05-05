// =============================================================================
// Constants
// =============================================================================

const PROXY_URL = "https://proxy.caticuchess.workers.dev/";

const PLAYER_PROFILE_KEYS = new Set([
  "Name",
  "Title",
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
  "Year of birth",
]);

// =============================================================================
// Storage
//
// Two scopes with distinct lifetimes:
//   PersistentStorage — localStorage; survives tab/browser close.
//                       Holds only the URL so the input is pre-filled on
//                       every future visit.
//   SessionStorage    — sessionStorage; cleared when the tab closes.
//                       Holds rounds and playerData for instant within-session
//                       restores. Always verified against a fresh fetch before
//                       deciding whether to re-render.
// =============================================================================

const PersistentStorage = {
  KEY: "chessResultsUrl",
  get() {
    return localStorage.getItem(this.KEY);
  },
  set(value) {
    localStorage.setItem(this.KEY, String(value ?? ""));
  },
  clear() {
    localStorage.removeItem(this.KEY);
  },
};

const SessionStorage = {
  KEYS: { rounds: "pairingsRounds", playerData: "pairingsPlayerData" },
  get(key) {
    return sessionStorage.getItem(this.KEYS[key]);
  },
  getJSON(key) {
    try {
      return JSON.parse(this.get(key));
    } catch {
      return null;
    }
  },
  set(key, value) {
    sessionStorage.setItem(
      this.KEYS[key],
      typeof value === "object" ? JSON.stringify(value) : String(value ?? ""),
    );
  },
  clear(...keys) {
    keys.forEach((storageKey) =>
      sessionStorage.removeItem(this.KEYS[storageKey]),
    );
  },
};

// =============================================================================
// Utilities
// =============================================================================

/**
 * Builds a chess-results.com profile URL for a given start number by
 * replacing the `snr` query parameter in the source URL.
 */
function buildOpponentProfileUrl(baseUrl, startNo) {
  const snr = Number(startNo);
  if (!baseUrl || !startNo || isNaN(snr) || snr <= 0) return null;
  try {
    const parsedUrl = new URL(baseUrl);
    parsedUrl.searchParams.set("snr", String(snr));
    return parsedUrl.toString();
  } catch {
    if (typeof baseUrl !== "string") return null;
    const snrEncoded = encodeURIComponent(String(snr));
    if (baseUrl.includes("snr="))
      return baseUrl.replace(/([?&]snr=)[^&]*/, "$1" + snrEncoded);
    return baseUrl + (baseUrl.includes("?") ? "&" : "?") + "snr=" + snrEncoded;
  }
}

/**
 * Formats a projected rating change as "+N" or "-N".
 * Returns "" when calcChange signals the result is indeterminate.
 * score: 1 = win, 0.5 = draw, 0 = loss.
 */
function formatRatingDelta(playerRating, oppRating, score) {
  const delta = calcChange(playerRating, oppRating, score);
  return delta === "" ? "" : (delta >= 0 ? "+" : "") + delta;
}

/**
 * Normalises fractional-point notation from the server format
 * (e.g. "1,5" → "1½", "0,5" → "½").
 */
const normalisePoints = (raw) =>
  raw.replace(/,5/g, "&#189;").replace(/0&#189;/g, "&#189;");

// =============================================================================
// Data acquisition
// =============================================================================

/** Fetches raw HTML through the CORS proxy and returns it as a string. */
async function fetchPage(url) {
  const res = await fetch(PROXY_URL + url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching page.`);
  return res.text();
}

const LAYOUT_MISMATCH =
  "Chess-Results mismatch. Please verify the URL or tournament status.";

/**
 * Extracts player metadata from the info table.
 * The table is located by checking its own direct first-column cells for the
 * exact label "Name", preventing outer layout tables (whose cells contain all
 * descendant text) from matching. Only keys in PLAYER_INFO_KEYS are retained.
 */
function parsePlayerInfo($html) {
  const $table = $html
    .find("table")
    .filter((_, tableElement) =>
      $(tableElement)
        .children("tbody")
        .children("tr")
        .children("td:first-child")
        .toArray()
        .some((td) => $(td).text().trim().replace(/:$/, "") === "Name"),
    )
    .first();

  if (!$table.length) throw new Error(LAYOUT_MISMATCH);

  return Object.fromEntries(
    $table
      .children("tbody")
      .children("tr")
      .get()
      .map((row) => {
        const $cells = $(row).children("td");
        return [
          $cells.eq(0).text().trim().replace(/:$/, ""),
          $cells.eq(1).text().trim(),
        ];
      })
      .filter(([key]) => PLAYER_PROFILE_KEYS.has(key)),
  );
}

/**
 * Extracts all pairings from the results table.
 * The table is located by requiring at least one <th> in its first row (ruling
 * out layout tables) and those cells containing "Rd" and "Res". Column positions
 * are derived dynamically via .includes() so new columns are handled
 * automatically. children() traversal throughout prevents nested result-cell
 * tables from bleeding into the index mapping.
 */
function parsePairings($html, url) {
  const $table = $html
    .find("table")
    .filter((_, tableElement) => {
      const $firstRow = $(tableElement)
        .children("tbody")
        .children("tr")
        .first();
      if (!$firstRow.children("th").length) return false;
      const headers = $firstRow
        .children("th, td")
        .map((_, headerCell) => $(headerCell).text().trim())
        .get();
      return (
        headers.some((header) => header.includes("Rd")) &&
        headers.some((header) => header.includes("Res"))
      );
    })
    .first();

  if (!$table.length) throw new Error(LAYOUT_MISMATCH);

  const $rows = $table.children("tbody").children("tr");
  const headers = $rows
    .first()
    .children("th")
    .map((_, th) => $(th).text().trim() || "Title")
    .get();
  const colIdx = (keyword) =>
    headers.findIndex((header) => header.includes(keyword));

  const idx = {
    rd: colIdx("Rd"),
    bo: colIdx("Bo"),
    sno: colIdx("SNo"),
    title: colIdx("Title"),
    name: colIdx("Name"),
    rtg: colIdx("Rtg"),
    fed: colIdx("FED"),
    club: colIdx("Club"),
    pts: colIdx("Pts"),
    res: colIdx("Res"),
  };

  if (idx.rd < 0 || idx.res < 0) throw new Error(LAYOUT_MISMATCH);

  return $rows
    .filter((_, row) => !$(row).children("th").length)
    .get()
    .map((row) => {
      const $cells = $(row).children("td");
      const cell = (cellIndex) =>
        cellIndex >= 0 ? $cells.eq(cellIndex).text().trim() : "";
      const $resultCell = $cells.eq(idx.res);
      return {
        round: cell(idx.rd),
        boardNo: cell(idx.bo),
        playerStartNo: cell(idx.sno),
        opponentTitle: cell(idx.title),
        opponentName: cell(idx.name),
        opponentRating: parseInt(cell(idx.rtg)) || 0,
        opponentFederation: cell(idx.fed),
        opponentClub: cell(idx.club),
        opponentPoints: cell(idx.pts),
        result: cell(idx.res),
        playerColor: $resultCell.find("div.FarbesT").length
          ? "Black"
          : $resultCell.find("div.FarbewT").length
            ? "White"
            : "",
        opponentProfileUrl: buildOpponentProfileUrl(url, cell(idx.sno)),
      };
    })
    .filter((pairing) => pairing.round !== "");
}

/** Fetches and parses a chess-results.com player page. */
async function scrapeChessResults(url) {
  const $html = $("<div>").html(await fetchPage(url));
  return {
    playerInfo: parsePlayerInfo($html),
    pairings: parsePairings($html, url),
  };
}

// =============================================================================
// Data transformation
// =============================================================================

/**
 * Fetches, parses, and enriches a player's results page.
 * Each round is extended with projected rating deltas for win, draw, and loss.
 */
async function getChessResults(url) {
  if (!url.includes("chess-results.com"))
    throw new Error("Please enter a valid Chess-Results URL.");

  const { playerInfo, pairings } = await scrapeChessResults(url);

  const rating =
    parseInt(
      playerInfo["Rating"] ??
        playerInfo["Rating international"] ??
        playerInfo["Rating national"],
    ) || 0;

  const rtgchg = parseFloat(
    (playerInfo["FIDE rtg +/-"] ?? "0").replace(/,/g, "."),
  );

  const rounds = pairings.map((pairing) => ({
    ...pairing,
    opponentPoints: normalisePoints(pairing.opponentPoints),
    win: formatRatingDelta(rating, pairing.opponentRating, 1),
    draw: formatRatingDelta(rating, pairing.opponentRating, 0.5),
    loss: formatRatingDelta(rating, pairing.opponentRating, 0),
  }));

  return { playerInfo, rating, rtgchg, rounds };
}

/**
 * Shapes the raw playerInfo map and computed rating fields into the flat
 * playerData object used by the presentation layer.
 */
function buildPlayerData(playerInfo, rating, rtgchg, url) {
  return {
    url,
    name: playerInfo["Name"] ?? "",
    title: playerInfo["Title"] ?? "",
    rank: playerInfo["Rank"] ?? "",
    federation: playerInfo["Federation"] ?? "",
    points: playerInfo["Points"] ?? "",
    rating,
    rtgchg,
  };
}

// =============================================================================
// Presentation
// =============================================================================

/**
 * Factory for the common column shape: present when hasValue, renders as plain <td>.
 * Used for any column whose presence and display are both driven by a single field.
 */
const simpleCol = (header, key) => ({
  header,
  isPresent: (round) => hasValue(round[key]),
  render: (round) => `<td>${round[key]}</td>`,
});

/**
 * Column definitions for the pairings table.
 *
 * Each entry carries:
 *   header     — the <th> label
 *   isPresent  — (round) => bool: does this round have data for the column?
 *   render     — (round) => <td> HTML string
 *
 * A column is only included when at least one round returns true from isPresent.
 */
const PAIRINGS_COLUMNS = [
  simpleCol("Round", "round"),
  simpleCol("Board", "boardNo"),
  simpleCol("Start", "playerStartNo"),
  {
    header: "Name",
    isPresent: (round) => hasValue(round.opponentName),
    render: (round) => `<td>
      <span class="title">${round.opponentTitle || ""}</span>
      ${
        round.opponentProfileUrl
          ? `<a href="${round.opponentProfileUrl}" target="_blank">${round.opponentName}</a>`
          : round.opponentName
      }
    </td>`,
  },
  {
    header: "Rating",
    isPresent: (round) => hasValue(round.opponentRating),
    render: (round) =>
      `<td>${
        round.opponentRating
          ? `<span class="tooltip" style="height:100%;width:100%;">${round.opponentRating}
           <span class="tooltiptext">Win: ${round.win}<br>Draw: ${round.draw}<br>Loss: ${round.loss}</span>
         </span>`
          : "0"
      }</td>`,
  },
  {
    header: "Federation",
    isPresent: (round) => !!round.opponentFederation?.trim(),
    render: (round) => `<td>${round.opponentFederation}</td>`,
  },
  simpleCol("Club/City", "opponentClub"),
  simpleCol("Points", "opponentPoints"),
  {
    header: "Result",
    isPresent: () => true,
    render: (round) => {
      const colorSpan =
        round.playerColor === "Black"
          ? '<span class="box-black"></span>'
          : round.playerColor === "White"
            ? '<span class="box-white"></span>'
            : "";
      return `<td class="result-cell">${colorSpan}${round.result ? `<span>${round.result}</span>` : ""}</td>`;
    },
  },
];

/**
 * Renders (or updates) the player header above the table.
 * Format: #[Rank] [Federation] <Title> [Name] [New Rating] ([rtgchg]) — [Points]/[totalRounds]
 */
function renderPlayerHeader(playerData, url, totalRounds) {
  const { name, title, rank, rating, rtgchg, federation, points } = playerData;
  if (!name) return;

  if (!$("#player-profile").length)
    $("#pairings-table").before('<div id="player-profile"></div>');

  const newRating = Math.round(rating + (Number.isFinite(rtgchg) ? rtgchg : 0));
  const changeStr =
    Number.isFinite(rtgchg) && rtgchg !== 0
      ? `<span class="player-rtgchg">(${rtgchg > 0 ? "+" : ""}${rtgchg})</span>`
      : "";

  const pointsStr = points
    ? `<span class="gap"></span><span class="player-points">${normalisePoints(points)}${totalRounds ? ` / ${totalRounds}` : ""}</span>`
    : "";

  $("#player-profile").html(
    [
      rank ? `<span class="player-rank">#${rank}</span> ` : "",
      federation ? `<span class="player-federation">${federation}</span> ` : "",
      title ? `<span class="title">${title}</span> ` : "",
      url
        ? `<a href="${url}" id="player-profile-link" target="_blank"><strong>${name}</strong></a>`
        : `<strong>${name}</strong>`,
      Number.isFinite(rating)
        ? ` <span class="player-rating">${newRating} ${changeStr}</span>`
        : "",
      pointsStr,
    ].join(""),
  );
}

/**
 * Renders the pairings table into #pairings-table.
 * Any column whose values are absent across every round is omitted.
 */
function renderPairingsTable(rounds, playerData, url) {
  const totalRounds = rounds[rounds.length - 1]?.round ?? "";
  renderPlayerHeader(playerData, url, totalRounds);

  const visible = PAIRINGS_COLUMNS.filter((col) =>
    rounds.some((round) => col.isPresent(round)),
  );
  const thead = `<thead><tr>${visible.map((col) => `<th>${col.header}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rounds
    .map(
      (round) => `<tr>${visible.map((col) => col.render(round)).join("")}</tr>`,
    )
    .join("")}</tbody>`;
  const showNote =
    playerData.rating > 0 &&
    rounds.some(
      (round) =>
        round.opponentRating > 0 &&
        Math.abs(playerData.rating - round.opponentRating) > 400,
    );

  $("#pairings-table").html(`<table>${thead}${tbody}</table>`);
  $("#note").html(
    showNote
      ? "*) Rating difference of more than 400. It was limited to 400."
      : "",
  );
}

// =============================================================================
// UI controller
// =============================================================================

/**
 * Resolves the URL from the input field or persistent cache, fetches live
 * results, and updates the table only when the data has changed.
 *
 * If the freshly fetched rounds are byte-for-byte identical to what is already
 * in the session cache the DOM is left untouched — no flicker, no redundant
 * repaint. When data differs, or when there is no cache yet, both the table
 * and the session cache are updated.
 *
 * The loader is always dismissed on exit, whether the fetch succeeds or fails.
 */
async function showPairingsTableFromInput() {
  let url = $("#url-input").val().trim();
  if (!url) {
    url = PersistentStorage.get() ?? "";
    if (url) $("#url-input").val(url);
  }
  if (!url) return;

  showLoader("#searchURL span");
  try {
    const { playerInfo, rating, rtgchg, rounds } = await getChessResults(url);
    const playerData = buildPlayerData(playerInfo, rating, rtgchg, url);
    const liveRoundsJSON = JSON.stringify(rounds);
    const livePlayerDataJSON = JSON.stringify(playerData);

    if (
      liveRoundsJSON !== SessionStorage.get("rounds") ||
      livePlayerDataJSON !== SessionStorage.get("playerData")
    ) {
      renderPairingsTable(rounds, playerData, url);
      SessionStorage.set("rounds", rounds);
      SessionStorage.set("playerData", playerData);
    }
    PersistentStorage.set(url);
  } catch (err) {
    alert(err.message || "No Pairings found for this URL.");
    console.error(err);
  } finally {
    hideLoader("#searchURL span");
  }
}

$(function () {
  const storedUrl = PersistentStorage.get();
  const cachedRounds = SessionStorage.getJSON("rounds");
  const cachedPlayerData = SessionStorage.getJSON("playerData");

  if (storedUrl) $("#url-input").val(storedUrl);
  if (cachedRounds && cachedPlayerData && cachedPlayerData.url === storedUrl)
    renderPairingsTable(cachedRounds, cachedPlayerData, storedUrl);
  if (storedUrl) showPairingsTableFromInput();

  $("#chess-resultsForm").on("submit", (e) => {
    e.preventDefault();
    showPairingsTableFromInput();
  });
});
