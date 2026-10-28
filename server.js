const http = require("http");
const fs = require("fs");
const path = require("path");
const https = require("https");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const CACHE_FILE = path.join(ROOT, "cache", "foods.json");

const DATA_URL = "https://thebigclimatedatabase.com/";
const CONCITO_URL = "https://concito.dk/denstoreklimadatabase";

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 CONCITO-student-prototype/1.0",
        "Accept": "text/html,application/xhtml+xml"
      },
      timeout: 20000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        resolve(fetchText(next));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} while fetching ${url}`));
        return;
      }
      res.setEncoding("utf8");
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => resolve(body));
    });
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", reject);
  });
}

function decodeEntities(str) {
  const named = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
    nbsp: " ", ndash: "–", mdash: "—", rsquo: "’",
    lsquo: "‘", ldquo: "“", rdquo: "”"
  };
  return String(str)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => named[n.toLowerCase()] ?? m);
}

function stripHtml(html) {
  return decodeEntities(
    String(html)
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function parseNumber(value) {
  const cleaned = String(value).trim().replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeHeader(s) {
  return String(s)
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z]/g, "");
}

function parseBigClimateDatabase(html) {
  const tableMatch = html.match(/<table\b[\s\S]*?<\/table>/i);
  if (!tableMatch) throw new Error("Could not find the food data table.");

  const rows = [...tableMatch[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map(m => [...m[1].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)]
      .map(c => stripHtml(c[1])))
    .filter(r => r.length);

  if (rows.length < 2) throw new Error("Food table was found but contained no data rows.");

  const header = rows[0].map(normalizeHeader);
  const index = {};
  header.forEach((h, i) => index[h] = i);

  const pickIndex = (...keys) => {
    for (const key of keys) {
      if (key in index) return index[key];
    }
    return -1;
  };

  const idx = {
    name: pickIndex("productname"),
    country: pickIndex("country"),
    category: pickIndex("category"),
    total: pickIndex("total"),
    agriculture: pickIndex("agriculture"),
    iluc: pickIndex("iluc"),
    processing: pickIndex("processing"),
    packaging: pickIndex("packaging"),
    transport: pickIndex("transport"),
    retail: pickIndex("retail"),
    id: pickIndex("id")
  };

  const required = ["name", "country", "category", "total", "id"];
  for (const key of required) {
    if (idx[key] < 0) {
      throw new Error(`Missing expected column: ${key}`);
    }
  }

  const foods = rows.slice(1).map(cells => ({
    id: cells[idx.id] || "",
    name: cells[idx.name] || "",
    country: cells[idx.country] || "",
    category: cells[idx.category] || "",
    total: parseNumber(cells[idx.total]),
    agriculture: idx.agriculture >= 0 ? parseNumber(cells[idx.agriculture]) : null,
    iluc: idx.iluc >= 0 ? parseNumber(cells[idx.iluc]) : null,
    processing: idx.processing >= 0 ? parseNumber(cells[idx.processing]) : null,
    packaging: idx.packaging >= 0 ? parseNumber(cells[idx.packaging]) : null,
    transport: idx.transport >= 0 ? parseNumber(cells[idx.transport]) : null,
    retail: idx.retail >= 0 ? parseNumber(cells[idx.retail]) : null
  })).filter(x =>
    x.id &&
    x.name &&
    x.country &&
    x.category &&
    Number.isFinite(x.total)
  );

  // De-duplicate in case the page contains repeated rows.
  const unique = [...new Map(foods.map(x => [x.id, x])).values()];

  if (unique.length < 100) {
    throw new Error(
      `Only ${unique.length} food records were parsed. The source page structure may have changed.`
    );
  }

  return unique;
}

function readCache() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    return Array.isArray(parsed.foods) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(foods) {
  const payload = {
    fetchedAt: new Date().toISOString(),
    source: DATA_URL,
    foods
  };
  fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

let inMemory = null;

async function getFoods(forceRefresh = false) {
  if (!forceRefresh && inMemory) return { ...inMemory, mode: "memory" };

  if (!forceRefresh) {
    const cached = readCache();
    if (cached) {
      inMemory = cached;
      return { ...cached, mode: "cache" };
    }
  }

  const html = await fetchText(DATA_URL);
  const foods = parseBigClimateDatabase(html);
  const cached = writeCache(foods);
  inMemory = cached;
  return { ...cached, mode: "live" };
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let requested = decodeURIComponent(url.pathname);
  if (requested === "/") requested = "/index.html";

  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404); res.end("Not found"); return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif"
    }[ext] || "application/octet-stream";
    res.writeHead(200, {"Content-Type": type});
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/foods") {
    try {
      const refresh = url.searchParams.get("refresh") === "1";
      const result = await getFoods(refresh);
      sendJson(res, 200, {
        source: DATA_URL,
        concitoSource: CONCITO_URL,
        fetchedAt: result.fetchedAt,
        mode: result.mode,
        count: result.foods.length,
        foods: result.foods
      });
    } catch (error) {
      const cached = readCache();
      if (cached) {
        inMemory = cached;
        sendJson(res, 200, {
          source: DATA_URL,
          concitoSource: CONCITO_URL,
          fetchedAt: cached.fetchedAt,
          mode: "cache-after-live-error",
          warning: error.message,
          count: cached.foods.length,
          foods: cached.foods
        });
      } else {
        sendJson(res, 502, {
          error: "Could not load the official database.",
          detail: error.message,
          source: DATA_URL,
          concitoSource: CONCITO_URL
        });
      }
    }
    return;
  }

  if (url.pathname === "/api/sources") {
    sendJson(res, 200, {
      database: DATA_URL,
      concito: CONCITO_URL,
      note: "Food values are parsed from The Big Climate Database. The CONCITO page is included as the official project/source reference."
    });
    return;
  }

  serveStatic(req, res);
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log("");
    console.log("CONCITO Food Search is running");
    console.log(`Open: http://localhost:${PORT}`);
    console.log("Data source:", DATA_URL);
    console.log("CONCITO source:", CONCITO_URL);
    console.log("");
  });
}

module.exports = {
  parseBigClimateDatabase,
  normalizeHeader,
  stripHtml
};
