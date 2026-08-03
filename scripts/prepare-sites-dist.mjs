import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, ".output");
const outputServer = path.join(outputDir, "server");
const outputPublic = path.join(outputDir, "public");
const distDir = path.join(root, "dist");
const distPublic = path.join(distDir, "public");
const distServer = path.join(distDir, "server");

if (!existsSync(outputServer)) {
  throw new Error("Missing .output/server. Run vite build before preparing Sites dist.");
}

if (!existsSync(outputPublic)) {
  throw new Error("Missing .output/public. Run vite build before preparing Sites dist.");
}

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(outputPublic, distPublic, { recursive: true });
await cp(outputServer, distServer, { recursive: true });
await cp(
  path.join(outputServer, "index.mjs"),
  path.join(distServer, "index.js"),
);

const serverWrangler = path.join(distServer, "wrangler.json");
if (existsSync(serverWrangler)) {
  const wranglerConfig = JSON.parse(
    await import("node:fs/promises").then(({ readFile }) =>
      readFile(serverWrangler, "utf8"),
    ),
  );
  wranglerConfig.main = "server/index.js";
  if (wranglerConfig.assets) {
    wranglerConfig.assets.directory = "public";
  }
  const { writeFile } = await import("node:fs/promises");
  await writeFile(
    path.join(distDir, "wrangler.json"),
    `${JSON.stringify(wranglerConfig, null, 2)}\n`,
  );
}

console.log("Prepared Sites dist with server entry and public assets.");
