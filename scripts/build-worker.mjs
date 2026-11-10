// Bundles the Auto mode worker and the migration script into single files for the Pi
// bundle, so the Pi needs neither tsx nor the TypeScript sources.
//
//   node scripts/build-worker.mjs <output directory>
//
// better-sqlite3 stays external: it is a native module and is loaded from the
// node_modules next to the output (the standalone server's).

import path from "node:path";
import { build } from "esbuild";

const outdir = path.resolve(process.argv[2] ?? ".next/standalone");

await build({
    entryPoints: { worker: "worker/index.ts", migrate: "scripts/migrate.ts" },
    outdir,
    outExtension: { ".js": ".cjs" },
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    external: ["better-sqlite3"],
    tsconfig: "tsconfig.json",
    logLevel: "info",
});
