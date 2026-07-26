import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

await build({ root });
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
