import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

// Run in Playwright's setup process so teardown works without killing a shell tree.
export async function startLocalServer(handle = async () => false) {
  const root = path.resolve("public");
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".webmanifest": "application/manifest+json" };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1:4173").pathname);
      if (await handle(request, response, pathname)) return;
      let file = path.resolve(root, `.${pathname}`);
      if (!file.startsWith(`${root}${path.sep}`) && file !== root) {
        response.writeHead(403).end(); return;
      }
      if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
      const content = await readFile(file);
      response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
      response.end(content);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(4173, "127.0.0.1", resolve);
  });
  return async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  };
}
export default async function setup() { return startLocalServer(); }
