// =============================================================================
// Constants
// =============================================================================

const PROXY_URL = "https://proxy.caticuchess.workers.dev/";

const PLAYER_INFO_KEYS = new Set([
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
// Storage — session-scoped cache (cleared automatically when the tab closes)
// =============================================================================

const Storage = {
  KEYS: {
    url: "chessResultsUrl",
    rounds: "pairingsRounds",
    playerData: "pairingsPlayerData",
  },

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
    keys.forEach((k) => sessionStorage.removeItem(this.KEYS[k]));
  },
};

// =============================================================================
// Utilities
// =============================================================================

/** True when a value is non-null, non-undefined, non-empty-string, and non-zero. */
function hasValue(v) {
  return v !== null && v !== undefined && v !== "" && v !== 0;
}

/**
 * Builds a chess-results.com profile URL for a given start number by
 * replacing the `snr` query parameter in the source URL.
 */
function buildOpponentProfileUrl(baseUrl, startNo) {
  const n = Number(startNo);
  if (!baseUrl || !startNo || isNaN(n)) return null;

  try {
    const u = new URL(baseUrl);
    u.searchParams.set("snr", String(n));
    return u.toString();
  } catch {
    if (typeof baseUrl !== "string") return null;
    const snr = encodeURIComponent(String(n));
    if (baseUrl.includes("snr="))
      return baseUrl.replace(/([?&]snr=)[^&]*/, "$1" + snr);
    return baseUrl + (baseUrl.includes("?") ? "&" : "?") + "snr=" + snr;
  }
}

/**
 * Formats a projected rating change as "+N" or "-N".
 * Returns "" when calcChange signals the result is indeterminate.
 * score: 1 = win, 0.5 = draw, 0 = loss.
 */
function formatRatingDelta(playerRating, oppRating, score) {
  const delta = calcChange(playerRating, oppRating, score);
  if (delta === "") return "";
  return (delta >= 0 ? "+" : "") + delta;
}

/**
 * Normalises fractional-point notation from the server format
 * (e.g. "1,5" → "1½", "0,5" → "½").
 */
function normalisePoints(raw) {
  return raw.replace(/,5/g, "&#189;").replace(/0&#189;/g, "&#189;");
}

// =============================================================================
// Data acquisition
// =============================================================================

/** Fetches raw HTML through the CORS proxy and returns it as a string. */
async function fetchPage(url) {
  const res = await fetch(PROXY_URL + url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching page.`);
  return res.text();
}

/**
 * Extracts player metadata from the info table (index 4).
 * Only known keys defined in PLAYER_INFO_KEYS are retained.
 */
function parsePlayerInfo($html) {
  const info = {};
  $html
    .find("table")
    .eq(4)
    .find("tr")
    .each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length < 2) return;
      const key = $(cells[0]).text().trim().replace(/:$/, "");
      if (PLAYER_INFO_KEYS.has(key)) info[key] = $(cells[1]).text().trim();
    });
  return info;
}

/**
 * Extracts all pairings from the results table (index 5).
 * Column positions are derived dynamically from the <th> headers so the
 * parser adapts automatically to any column ordering the server returns.
 */
function parsePairings($html, url) {
  const table = $html.find("table").eq(5);
  const rows = table.find("tr");

  // Map header labels; empty <th> cells are the title column
  const headers = table
    .find("tr")
    .first()
    .find("th")
    .map((_, th) => $(th).text().trim() || "Title")
    .get();

  const resultIdx = headers.indexOf("Res.");

  const pairings = [];

  rows.each((i, row) => {
    // Skip the header row and the interleaved blank rows
    if (i === 0 || i % 2 === 0) return;

    const cells = $(row)
      .find("td")
      .map((_, td) => $(td).text().trim())
      .get();
    if (cells.length < headers.length) return;

    // Index cell values by their column header for readable access below
    const col = Object.fromEntries(headers.map((k, idx) => [k, cells[idx]]));

    const $resultCell = $(row).find(`td:eq(${resultIdx})`);
    const playerColor = $resultCell.find("div.FarbesT").length
      ? "Black"
      : $resultCell.find("div.FarbewT").length
        ? "White"
        : "";

    pairings.push({
      round: col["Rd."],
      boardNo: col["Bo."],
      playerStartNo: col["SNo"],
      opponentTitle: col["Title"],
      opponentName: col["Name"],
      opponentRating: parseInt(col["Rtg"]) || 0,
      opponentFederation: col["FED"],
      opponentClub: col["Club/City"],
      opponentPoints: col["Pts."],
      result: col["Res."],
      playerColor,
      opponentProfileUrl: buildOpponentProfileUrl(url, col["SNo"]),
    });
  });

  return pairings;
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
  if (!url.includes("chess-results.com")) {
    throw new Error("Please enter a valid Chess-Results URL.");
  }

  const { playerInfo, pairings } = await scrapeChessResults(url);

  const rating = parseInt(playerInfo["Rating"]);
  if (isNaN(rating))
    throw new Error("Could not detect your rating from the page.");

  const rtgchg = parseFloat(
    (playerInfo["FIDE rtg +/-"] ?? "0").replace(/,/g, "."),
  );

  const rounds = pairings.map((p) => ({
    round: p.round,
    boardNo: p.boardNo,
    playerStartNo: p.playerStartNo,
    opponentTitle: p.opponentTitle,
    opponentName: p.opponentName,
    opponentRating: p.opponentRating,
    opponentFederation: p.opponentFederation,
    opponentClub: p.opponentClub,
    opponentPoints: normalisePoints(p.opponentPoints),
    result: p.result,
    playerColor: p.playerColor,
    opponentProfileUrl: p.opponentProfileUrl,
    win: formatRatingDelta(rating, p.opponentRating, 1),
    draw: formatRatingDelta(rating, p.opponentRating, 0.5),
    loss: formatRatingDelta(rating, p.opponentRating, 0),
  }));

  return { playerInfo, rating, rtgchg, rounds };
}

// =============================================================================
// Presentation
// =============================================================================

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
  {
    header: "Round",
    isPresent: (r) => hasValue(r.round),
    render: (r) => `<td>${r.round}</td>`,
  },
  {
    header: "Board",
    isPresent: (r) => hasValue(r.boardNo),
    render: (r) => `<td>${r.boardNo}</td>`,
  },
  {
    header: "Start",
    isPresent: (r) => hasValue(r.playerStartNo),
    render: (r) => `<td>${r.playerStartNo}</td>`,
  },
  {
    header: "Name",
    isPresent: (r) => hasValue(r.opponentName),
    render: (r) => `<td>
      <span class="title">${r.opponentTitle || ""}</span>
      ${
        r.opponentProfileUrl
          ? `<a href="${r.opponentProfileUrl}" target="_blank">${r.opponentName}</a>`
          : r.opponentName
      }
    </td>`,
  },
  {
    header: "Rating",
    isPresent: (r) => hasValue(r.opponentRating),
    render: (r) =>
      `<td>${
        r.opponentRating
          ? `<span class="tooltip" style="height:100%;width:100%;">
            ${r.opponentRating}
            <span class="tooltiptext">
              Win: ${r.win}<br>Draw: ${r.draw}<br>Loss: ${r.loss}
            </span>
          </span>`
          : r.opponentRating
      }</td>`,
  },
  {
    header: "Federation",
    isPresent: (r) =>
      hasValue(r.opponentFederation) && r.opponentFederation.trim() !== "",
    render: (r) => `<td>${r.opponentFederation || ""}</td>`,
  },
  {
    header: "Club/City",
    isPresent: (r) => hasValue(r.opponentClub),
    render: (r) => `<td>${r.opponentClub}</td>`,
  },
  {
    header: "Points",
    isPresent: (r) => hasValue(r.opponentPoints),
    render: (r) => `<td>${r.opponentPoints}</td>`,
  },
  {
    // Result is always rendered; the colour indicator lives inside the cell.
    header: "Result",
    isPresent: () => true,
    render: (r) => {
      const colorSpan =
        r.playerColor === "Black"
          ? '<span class="box-black"></span>'
          : r.playerColor === "White"
            ? '<span class="box-white"></span>'
            : "";
      return `<td class="result-cell">${colorSpan}${r.result ? `<span>${r.result}</span>` : ""}</td>`;
    },
  },
];

/**
 * Renders (or updates) the player header above the table.
 * Format: #[Rank] <Title> [Name] [New Rating] [Federation]
 * New rating is derived by applying the FIDE rtg +/- to the base rating.
 */
function renderPlayerHeader(playerData, url) {
  const { name, title, rank, rating, rtgchg, federation } = playerData;
  if (!name) return;

  $("#player-name").length || $("#pairings-table").before('<div id="player-name"></div>');

  const rankHtml = rank ? `<span class="player-rank">#${rank}</span> ` : "";
  const fedHtml = federation
    ? ` <span class="player-federation">${federation}</span> `
    : "";
  const titleHtml = title ? `<span class="title">${title}</span> ` : "";

  let ratingHtml = "";
  if (Number.isFinite(rating)) {
    const newRating = Math.round(
      rating + (Number.isFinite(rtgchg) ? rtgchg : 0),
    );
    const changeStr =
      Number.isFinite(rtgchg) && rtgchg !== 0
        ? `(<span class="player-rtgchg">${rtgchg > 0 ? "+" : ""}${rtgchg}</span>)`
        : "";
    ratingHtml = ` <span class="player-rating">${newRating} ${changeStr}</span>`;
  }

  const nameHtml = url
    ? `<a href="${url}" id="player-name-link" target="_blank"><strong>${name}</strong></a>`
    : `<strong>${name}</strong>`;

  $("#player-name").html(
    `${rankHtml}${fedHtml}${titleHtml}${nameHtml}${ratingHtml}`,
  );
}

/**
 * Renders the pairings table into #pairings-table.
 * Any column whose values are absent across every round is omitted.
 */
function renderPairingsTable(rounds, playerData, url) {
  renderPlayerHeader(playerData, url);

  const visible = PAIRINGS_COLUMNS.filter((col) =>
    rounds.some((r) => col.isPresent(r)),
  );

  const thead = `<thead><tr>${visible.map((c) => `<th>${c.header}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rounds
    .map((r) => `<tr>${visible.map((c) => c.render(r)).join("")}</tr>`)
    .join("")}</tbody>`;

  $("#pairings-table").html(`
    <table>${thead}${tbody}</table>
    <div class="note">*) Rating difference of more than 400. It was limited to 400.</div>
  `);
}

// =============================================================================
// UI controller
// =============================================================================

/**
 * Resolves the URL from the input field or session cache, fetches results,
 * renders the table, and updates the cache — all three atomically on success.
 * The URL is never persisted until a fetch fully succeeds, so a failed request
 * can never leave the cache in a state where the URL points to different data.
 * The loader is always dismissed on exit, whether the fetch succeeds or fails.
 */
async function showPairingsTableFromInput() {
  let url = $("#url-input").val().trim();

  if (!url) {
    url = Storage.get("url") ?? "";
    if (url) $("#url-input").val(url);
  }
  if (!url) return;

  showLoader("#searchURL span");
  try {
    const { playerInfo, rating, rtgchg, rounds } = await getChessResults(url);

    const playerData = {
      url, // embedded for integrity check on restore
      name: playerInfo["Name"] ?? "",
      title: playerInfo["Title"] ?? "",
      rank: playerInfo["Rank"] ?? "",
      rating,
      rtgchg,
      federation: playerInfo["Federation"] ?? "",
    };

    renderPairingsTable(rounds, playerData, url);

    // All three writes happen together — only after a successful fetch.
    Storage.set("url", url);
    Storage.set("rounds", rounds);
    Storage.set("playerData", playerData);
  } catch (err) {
    alert("No Pairings found for this URL.");
    console.error(err);
  } finally {
    hideLoader("#searchURL span");
  }
}

$(function () {
  // Restore last rendered table from cache only when all three keys are present
  // and the URL embedded in playerData matches the stored URL, ensuring the
  // rounds and player header always belong to the same fetch.
  const storedUrl = Storage.get("url");
  const cachedRounds = Storage.getJSON("rounds");
  const cachedPlayerData = Storage.getJSON("playerData");

  if (storedUrl) $("#url-input").val(storedUrl);

  if (cachedRounds && cachedPlayerData && cachedPlayerData.url === storedUrl) {
    renderPairingsTable(cachedRounds, cachedPlayerData, storedUrl);
  }

  $("#chess-resultsForm").on("submit", (e) => {
    e.preventDefault();
    showPairingsTableFromInput();
  });
});
