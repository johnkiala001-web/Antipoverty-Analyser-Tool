console.log("BEFORE import");
const start = Date.now();
const mod = await import("./api/index.mjs");
console.log("AFTER import in", Date.now() - start, "ms");
console.log("default export type:", typeof mod.default);
console.log("import-only complete; no handler called");
