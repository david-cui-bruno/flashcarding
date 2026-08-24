import assert from "node:assert/strict";
import { isPublicPath } from "../lib/supabase/proxy";

assert.equal(isPublicPath("/"), true);
assert.equal(isPublicPath("/opengraph-image"), true);
assert.equal(isPublicPath("/api/billing/revenuecat"), true);
assert.equal(isPublicPath("/api/billing/revenuecat/"), false);
assert.equal(isPublicPath("/library"), false);

console.log("proxy public paths ok");
