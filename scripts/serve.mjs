import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const host = "127.0.0.1";
const port = 4173;
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
};

export function startServer({ rootDirectory = projectRoot } = {}) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${host}:${port}`);
    const pathname = decodeURIComponent(
      url.pathname === "/" ? "/index.html" : url.pathname,
    );
    const filePath = resolve(rootDirectory, `.${pathname}`);
    const pathFromRoot = relative(rootDirectory, filePath);

    if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    try {
      const file = await stat(filePath);
      if (!file.isFile()) throw new Error("Not a file");
      response.writeHead(200, {
        "content-type":
          contentTypes[extname(filePath)] || "application/octet-stream",
      });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });

  return new Promise((resolveServer, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolveServer(server);
    });
  });
}

const isDirectRun =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const rootDirectory = process.argv.includes("--dist")
    ? resolve(projectRoot, "dist")
    : projectRoot;
  await startServer({ rootDirectory });
  console.log(`Chromaflow preview listening at http://${host}:${port}`);
}
