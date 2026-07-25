import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "server"), { recursive: true });
await cp(resolve(root, "assets"), resolve(dist, "assets"), { recursive: true });
await cp(resolve(root, "index.html"), resolve(dist, "index.html"));

const worker = `export default {
  async fetch(request, env) {
    if (env.ASSETS) return env.ASSETS.fetch(request);

    const html = ${JSON.stringify(await readFile(resolve(root, "index.html"), "utf8"))};
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    return new Response("Not found", { status: 404 });
  }
};
`;

await writeFile(resolve(dist, "server", "index.js"), worker);
console.log("Chromaflow production bundle created.");
