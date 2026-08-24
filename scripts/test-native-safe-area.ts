import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appShell = readFileSync("components/app-shell.tsx", "utf8");
const marketing = readFileSync("app/page.tsx", "utf8");

assert.match(
  appShell,
  /pt-\[env\(safe-area-inset-top\)\]/,
  "native app chrome must clear the iPhone status area",
);
assert.match(
  marketing,
  /env\(safe-area-inset-top\)/,
  "the native marketing header must clear the iPhone status area",
);

console.log("native safe-area behavior ok");
