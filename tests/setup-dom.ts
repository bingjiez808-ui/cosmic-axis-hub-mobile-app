/**
 * Bun test preload — installs a happy-dom window/document into the
 * global scope so component tests that import React can render.
 * Registered via `bunfig.toml` -> [test] preload.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (typeof globalThis.document === "undefined") {
  GlobalRegistrator.register({
    url: "http://localhost/",
    width: 1440,
    height: 900,
  });
}
