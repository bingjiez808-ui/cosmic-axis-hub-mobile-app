import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
  const wranglerConfig = JSON.parse(await readFile(serverWrangler, "utf8"));
  wranglerConfig.main = "server/index.js";
  if (wranglerConfig.assets) {
    wranglerConfig.assets.directory = "public";
  }
  await writeFile(
    path.join(distDir, "wrangler.json"),
    `${JSON.stringify(wranglerConfig, null, 2)}\n`,
  );
}

const serverIndex = path.join(distServer, "index.js");
const serverCode = await readFile(serverIndex, "utf8");
const assetFallbackCode =
  'if (env.ASSETS && isPublicAssetURL(url.pathname)) return env.ASSETS.fetch(cfRequest);\n\tif (isPublicAssetURL(url.pathname)) return Response.redirect(`https://raw.githubusercontent.com/bingjiez808-ui/cosmic-axis-hub-mobile-app/main/site-static${url.pathname}`, 302);';
await writeFile(
  serverIndex,
  serverCode
    .replace(
      "if (env.ASSETS && isPublicAssetURL(url.pathname)) return env.ASSETS.fetch(cfRequest);",
      assetFallbackCode,
    )
    .replace(
      "export { cloudflare_module_default as default };",
      `const staticAssetBase = "https://cdn.jsdelivr.net/gh/bingjiez808-ui/cosmic-axis-hub-mobile-app@main/site-static";
const htmlAssetRewriteHandler = {
\t...cloudflare_module_default,
\tasync fetch(request, env, context) {
\t\tconst response = await cloudflare_module_default.fetch(request, env, context);
\t\tconst contentType = response.headers.get("content-type") || "";
\t\tif (!contentType.includes("text/html")) return response;
\t\tconst html = await response.text();
\t\tconst rewritten = html
\t\t\t.replaceAll('"/assets/', '"' + staticAssetBase + "/assets/")
\t\t\t.replaceAll("'/assets/", "'" + staticAssetBase + "/assets/")
\t\t\t.replaceAll('"/images/', '"' + staticAssetBase + "/images/")
\t\t\t.replaceAll("'/images/", "'" + staticAssetBase + "/images/")
\t\t\t.replaceAll('"/icon-', '"' + staticAssetBase + "/icon-")
\t\t\t.replaceAll('"/apple-touch-icon.png', '"' + staticAssetBase + "/apple-touch-icon.png")
\t\t\t.replaceAll('"/favicon.ico', '"' + staticAssetBase + "/favicon.ico")
\t\t\t.replaceAll('"/manifest.webmanifest', '"' + staticAssetBase + "/manifest.webmanifest")
\t\t\t.replaceAll('"/sw.js', '"' + staticAssetBase + "/sw.js");
\t\treturn new Response(rewritten, response);
\t}
};
export { htmlAssetRewriteHandler as default };`,
    ),
);

console.log("Prepared Sites dist with server entry and public assets.");
