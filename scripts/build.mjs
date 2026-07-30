import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { createServiceWorker } from "./service-worker.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

await build({ root });

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(
        ...(await listFiles(resolve(directory, entry.name), relativePath)),
      );
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

const offlineFiles = (await listFiles(dist))
  .filter((path) => path !== "sw.js" && !path.startsWith("server/"))
  .sort();
const requiredOfflineAssets = [
  ["application entry point", (path) => /^assets\/index-.*\.js$/.test(path)],
  ["application styles", (path) => /^assets\/index-.*\.css$/.test(path)],
  ["solver worker", (path) => /^assets\/solver-worker-.*\.js$/.test(path)],
  ["application page", (path) => path === "index.html"],
  ["install manifest", (path) => path === "manifest.webmanifest"],
  ["application icon", (path) => path === "app-icon.svg"],
];
const missingOfflineAssets = requiredOfflineAssets
  .filter(([, matches]) => !offlineFiles.some(matches))
  .map(([label]) => label);

if (missingOfflineAssets.length) {
  throw new Error(
    `Offline build is missing: ${missingOfflineAssets.join(", ")}.`,
  );
}

const cacheHash = createHash("sha256");

for (const path of offlineFiles) {
  cacheHash.update(path);
  cacheHash.update(await readFile(resolve(dist, path)));
}

const cacheVersion = cacheHash.digest("hex").slice(0, 12);
const precacheUrls = ["./", ...offlineFiles.map((path) => `./${path}`)];
const serviceWorker = createServiceWorker(cacheVersion, precacheUrls);

await writeFile(resolve(dist, "sw.js"), serviceWorker);
await mkdir(resolve(dist, "server"), { recursive: true });

const worker = `export default {
  async fetch(request, env) {
    if (env.ASSETS) return env.ASSETS.fetch(request);

    const html = ${JSON.stringify(await readFile(resolve(dist, "index.html"), "utf8"))};
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    return new Response("Not found", { status: 404 });
  }
};
`;

await writeFile(resolve(dist, "server", "index.js"), worker);
console.log("Chromaflow Vite production bundle created.");
