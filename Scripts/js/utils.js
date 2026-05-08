// utils.js - General utility functions and Chess logic

const isValidString = (s) => typeof s === "string" && s.length > 0;

const signum = (v) => (
  (v = +v),
  isNaN(v) ? "NaN" : (v > 0 ? "+" : "") + (v || 0)
);

/** True when a value is non-null, non-undefined, and non-empty-string. */
const hasValue = (value) =>
  value !== null && value !== undefined && value !== "";

const toNumberOr = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const generateUniqueID = () => crypto.randomUUID();

function capitalize(str) {
  if (!isValidString(str)) return "";
  return str.replace(
    /\S+/g,
    (w) => w[0].toUpperCase() + w.slice(1).toLowerCase(),
  );
}

function formatName(name) {
  if (!isValidString(name)) return "";
  const parts = name.split(", ");
  if (parts.length !== 2) return name.trim();
  const [last, first] = parts;
  return `${first.trim()} ${last.trim()}`.trim();
}

function isEmpty(array) {
  return !array || array.length === 0;
}

/* --- Unicode Variant Helpers --- */
const buildSpecialMap = (startCode, rangeStart = 97, rangeEnd = 122) => {
  const map = {};
  for (let i = rangeStart; i <= rangeEnd; i++) {
    map[String.fromCharCode(i)] = startCode + (i - rangeStart);
  }
  return map;
};

const SPECIAL_P = Object.freeze(buildSpecialMap(0x249c));
const SPECIAL_W = Object.freeze(buildSpecialMap(0xff41));

// Allocated once at module level, shared across all toUnicodeVariant calls
const UNICODE_OFFSETS = Object.freeze({
  m: [0x1d670, 0x1d7f6],
  b: [0x1d400, 0x1d7ce],
  i: [0x1d434, 0x00030],
  bi: [0x1d468, 0x00030],
  c: [0x1d49c, 0x00030],
  bc: [0x1d4d0, 0x00030],
  g: [0x1d504, 0x00030],
  d: [0x1d538, 0x1d7d8],
  bg: [0x1d56c, 0x00030],
  s: [0x1d5a0, 0x1d7e2],
  bs: [0x1d5d4, 0x1d7ec],
  is: [0x1d608, 0x00030],
  bis: [0x1d63c, 0x00030],
  o: [0x24b6, 0x2460],
  p: [0x249c, 0x2474],
  w: [0xff21, 0xff10],
  u: [0x2090, 0xff10],
});

const VARIANT_ALIASES = Object.freeze({
  monospace: "m",
  bold: "b",
  italic: "i",
  "bold italic": "bi",
  script: "c",
  "bold script": "bc",
  gothic: "g",
  "gothic bold": "bg",
  doublestruck: "d",
  sans: "s",
  "bold sans": "bs",
  "italic sans": "is",
  "bold italic sans": "bis",
  parenthesis: "p",
  circled: "o",
  fullwidth: "w",
});

const UNICODE_SPECIAL = Object.freeze({
  m: { " ": 0x2000, "-": 0x2013 },
  i: { h: 0x210e },
  g: { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 },
  o: {
    0: 0x24ea,
    1: 0x2460,
    2: 0x2461,
    3: 0x2462,
    4: 0x2463,
    5: 0x2464,
    6: 0x2465,
    7: 0x2466,
    8: 0x2467,
    9: 0x2468,
  },
  p: SPECIAL_P,
  w: SPECIAL_W,
});

function toUnicodeVariant(str, variant, flags) {
  if (!isValidString(str)) return "";

  const getType = (v) => VARIANT_ALIASES[v] || (UNICODE_OFFSETS[v] ? v : "m");
  const type = getType(variant);
  const flagArr = isValidString(flags)
    ? flags.split(",").map((f) => f.trim())
    : [];
  const underline = flagArr.includes("underline");
  const strike = flagArr.includes("strike");
  let result = "";

  for (const k of str) {
    const specialCode = UNICODE_SPECIAL[type]?.[k];
    if (specialCode) {
      result += String.fromCodePoint(specialCode);
    } else {
      // O(1) char/digit lookup via charCode arithmetic
      const code = k.charCodeAt(0);
      const ci =
        code >= 65 && code <= 90
          ? code - 65
          : code >= 97 && code <= 122
            ? code - 71
            : -1;
      if (ci > -1) {
        result += String.fromCodePoint(ci + UNICODE_OFFSETS[type][0]);
      } else {
        const ni = code >= 48 && code <= 57 ? code - 48 : -1;
        result +=
          ni > -1 ? String.fromCodePoint(ni + UNICODE_OFFSETS[type][1]) : k;
      }
    }
    if (underline) result += "\u0332";
    if (strike) result += "\u0336";
  }
  return result;
}

/* --- Loader UI Helpers --- */
function showLoader(target) {
  const el = document.querySelector(target);
  if (!el) return;
  if (typeof el._oldLoaderValue === "undefined") {
    el._oldLoaderValue = el.innerHTML;
  }
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "inline";
  el.innerHTML = "Loading";
}

function hideLoader(target) {
  const el = document.querySelector(target);
  if (!el) return;
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "none";
  if (typeof el._oldLoaderValue !== "undefined") {
    el.innerHTML = el._oldLoaderValue;
    delete el._oldLoaderValue;
  }
}

/* --- Chess Specific Logic --- */

const TITLE_MAP = Object.freeze({
  grandmaster: "GM",
  internationalmaster: "IM",
  fidemaster: "FM",
  candidatemaster: "CM",
  womangrandmaster: "WGM",
  womaninternationalmaster: "WIM",
  womanfidemaster: "WFM",
  womancandidatemaster: "WCM",
  nationalmaster: "NM",
});

const TIME_CONTROL_ICONS = Object.freeze({
  Bullet: '<i class="fa-solid fa-bolt-lightning"></i><span class="gap"></span>',
  Blitz: '<i class="fa-solid fa-bolt-lightning"></i><span class="gap"></span>',
  Rapid: '<i class="fa-solid fa-clock"></i><span class="gap"></span>',
  Classical:
    '<i class="fa-solid fa-hourglass-half"></i><span class="gap"></span>',
  Unknown: "",
});

function abbreviateTitle(title) {
  if (!isValidString(title)) return "";
  const normalized = title.toLowerCase().replace(/\s+/g, "");
  return TITLE_MAP[normalized] || title;
}

function parseTimeControl(tc) {
  const cleanTC = String(tc).toLowerCase().replace(/\s+/g, "");
  let initialTime, increment;
  if (cleanTC.includes("+")) {
    [initialTime, increment] = cleanTC.split("+").map(Number);
  } else if (cleanTC.includes("|")) {
    [initialTime, increment] = cleanTC.split("|").map(Number);
  } else if (cleanTC.includes("min")) {
    initialTime = Number(cleanTC.replace("min", ""));
    increment = 0;
  } else {
    initialTime = Number(cleanTC);
    increment = 0;
  }
  return { initialTime, increment };
}

function classifyTimeControl(initial, increment) {
  if (![initial, increment].every((n) => Number.isFinite(n) && n >= 0))
    return "Unknown";
  const initialSeconds = initial * 60;
  const estimatedMinutes = (initialSeconds + increment * 40) / 60;
  if (initial < 3 && estimatedMinutes < 7) return "Bullet";
  if (initial < 10 && estimatedMinutes < 25) return "Blitz";
  if (initial < 30 && estimatedMinutes < 60) return "Rapid";
  return "Classical";
}

function getTimeControlCategory(timeControl) {
  try {
    const { initialTime, increment } = parseTimeControl(timeControl);
    return classifyTimeControl(initialTime, increment);
  } catch {
    return "Unknown";
  }
}

const cleanResult = (result) =>
  result.trim().replace(/½/g, "1/2").replace(/\s+/g, "");

function formatResult(result) {
  if (!isValidString(result)) return "*";
  switch (cleanResult(result)) {
    case "1-0":
      return "1 - 0";
    case "0-1":
      return "0 - 1";
    case "1/2-1/2":
      return "½ - ½";
    default:
      return result.trim();
  }
}

/**
 * Normalises fractional-point notation from the server format
 * (e.g. "1,5" → "1½", "0,5" → "½").
 */
const normalisePoints = (raw) =>
  isValidString(raw) ? raw.replace(/0?,5/g, "&#189;") : "";

function normalizeResult(result) {
  if (!isValidString(result)) return "*";
  const cleaned = cleanResult(result);
  switch (cleaned) {
    case "1-0":
    case "0-1":
    case "1/2-1/2":
      return cleaned;
    default:
      return "*";
  }
}

// Rating Calculator logic
function saveGames() {
  localStorage.setItem("chessGames", JSON.stringify(window.games));
}

const getTagRegex = (() => {
  const cache = new Map();
  return (tag) => {
    if (!cache.has(tag)) cache.set(tag, new RegExp(`\\[${tag}\\s"([^"]*)"\\]`));
    return cache.get(tag);
  };
})();

function pgnToJson(pgn) {
  if (!isValidString(pgn)) return [];
  const games = pgn.split(/\n\n(?=\[Event)/).filter(Boolean);
  return games.map((game, idx) => {
    const getTag = (tag) => game.match(getTagRegex(tag))?.[1] ?? "";
    const resultStr = getTag("Result").trim();
    const normalizedResult = resultStr === "1/2-1/2" ? "½-½" : resultStr;
    const roundParts = getTag("Round").split(".");
    return {
      white: getTag("White").trim() || "Unknown",
      whiteRating: Math.max(0, toNumberOr(getTag("WhiteElo"), 0)),
      whiteTitle: getTag("WhiteTitle").trim() || "",
      black: getTag("Black").trim() || "Unknown",
      blackRating: Math.max(0, toNumberOr(getTag("BlackElo"), 0)),
      blackTitle: getTag("BlackTitle").trim() || "",
      result: normalizedResult,
      tournament:
        (getTag("StudyName") || getTag("Event")).trim().split(":").pop() ||
        "Unknown",
      round: Math.max(1, toNumberOr(roundParts[0] || NaN, idx + 1)),
      board:
        toNumberOr(getTag("Board"), 0) || toNumberOr(roundParts[1], 0) || null,
      time: getTag("TimeControl").trim() || "*",
      date: getTag("Date")?.replace(/\./g, "-") || "",
      gameLink: getTag("ChapterURL") || getTag("Site") || "",
    };
  });
}

function expectedScore(myRating, oppRating) {
  return 1 / (1 + Math.pow(10, (oppRating - myRating) / 400));
}

function calcChange(myRating, oppRating, result, k = 40) {
  if (oppRating === 0) return "";
  const E = expectedScore(myRating, oppRating);
  return Math.round(k * (result - E) * 10) / 10;
}
