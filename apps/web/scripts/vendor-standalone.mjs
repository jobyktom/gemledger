// Hostinger publishes only .next/standalone/apps/web from a standalone build,
// but in a monorepo Next.js puts the traced node_modules at .next/standalone.
// Copy them in next to server.js so the app starts on its own.
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const standalone = join(import.meta.dirname, "..", ".next", "standalone");
const app = join(standalone, "apps", "web");
const rootModules = join(standalone, "node_modules");

if (existsSync(app) && existsSync(rootModules)) {
  cpSync(rootModules, join(app, "node_modules"), { recursive: true, dereference: true, force: false });
  console.log("Copied standalone node_modules into apps/web");
}
