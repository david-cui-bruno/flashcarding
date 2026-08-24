import assert from "node:assert/strict";
import {
  acceptedPortraitDimensions,
  assertAcceptedScreenshot,
  screenshotNames,
} from "./capture-app-store-screenshots.mjs";

assert.deepEqual(acceptedPortraitDimensions("6.9"), [
  [1260, 2736],
  [1290, 2796],
  [1320, 2868],
]);
assert.deepEqual(acceptedPortraitDimensions("6.1"), [
  [1170, 2532],
  [1125, 2436],
  [1080, 2340],
]);
assert.deepEqual(screenshotNames, [
  "01-library.png",
  "02-new-deck.png",
  "03-review.png",
  "04-study.png",
  "05-metrics-or-pro.png",
]);

assert.doesNotThrow(() =>
  assertAcceptedScreenshot(
    { width: 1320, height: 2868, hasAlpha: false },
    "6.9",
  ),
);
assert.throws(
  () =>
    assertAcceptedScreenshot(
      { width: 1320, height: 2868, hasAlpha: true },
      "6.9",
    ),
  /alpha channel/,
);
assert.throws(
  () =>
    assertAcceptedScreenshot(
      { width: 1179, height: 2556, hasAlpha: false },
      "6.1",
    ),
  /not accepted/,
);

console.log("App Store screenshot capture behavior ok");
