const http = require("http");
const fs = require("fs");
const path = require("path");

const WEB_ROOT = path.resolve(__dirname, "..", "dist", "web");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  let pathname = url.pathname;

  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  // Expo Go manifest requests — still support for mobile app users
  const platform = req.headers["expo-platform"];
  if (platform === "ios" || platform === "android") {
    const manifestPath = path.join(path.resolve(__dirname, "..", "static-build"), platform, "manifest.json");
    if (fs.existsSync(manifestPath)) {
      res.writeHead(200, { "content-type": "application/json", "expo-protocol-version": "1", "expo-sfv-version": "0" });
      res.end(fs.readFileSync(manifestPath));
      return;
    }
  }

  // Try exact file first
  let filePath = path.join(WEB_ROOT, pathname);
  const safePath = path.normalize(filePath);
  if (!safePath.startsWith(WEB_ROOT)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  // If directory or not found, serve index.html (SPA routing)
  let target = safePath;
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    target = path.join(WEB_ROOT, "index.html");
  }

  if (!fs.existsSync(target)) {
    res.writeHead(404); res.end("Not Found"); return;
  }

  const ext = path.extname(target).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  // Cache static assets aggressively, HTML never
  const isHtml = ext === ".html" || !ext;
  res.writeHead(200, {
    "content-type": contentType,
    "cache-control": isHtml ? "no-cache" : "public, max-age=31536000, immutable",
  });
  res.end(fs.readFileSync(target));
});

const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`Serving Expo web build on port ${port}`);
});
