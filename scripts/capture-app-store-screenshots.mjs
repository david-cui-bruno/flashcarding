#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

export const screenshotNames = [
  "01-library.png",
  "02-new-deck.png",
  "03-review.png",
  "04-study.png",
  "05-metrics-or-pro.png",
];

const screenshotPrompts = [
  "Show the populated Decks library",
  "Show the new-deck source entry screen",
  "Show generated-card review/triage",
  "Show an active study card",
  "Show Metrics or the Dory Pro plan",
];

const acceptedDimensions = {
  "6.9": [
    [1260, 2736],
    [1290, 2796],
    [1320, 2868],
  ],
  "6.1": [
    [1170, 2532],
    [1125, 2436],
    [1080, 2340],
  ],
};

export function acceptedPortraitDimensions(deviceClass) {
  const dimensions = acceptedDimensions[deviceClass];
  if (!dimensions) {
    throw new Error(`Unknown device class ${deviceClass}; expected 6.9 or 6.1`);
  }
  return dimensions.map(([width, height]) => [width, height]);
}

export function assertAcceptedScreenshot(properties, deviceClass) {
  if (properties.hasAlpha) {
    throw new Error("Screenshot still contains an alpha channel");
  }

  const accepted = acceptedPortraitDimensions(deviceClass).some(
    ([width, height]) =>
      properties.width === width && properties.height === height,
  );
  if (!accepted) {
    throw new Error(
      `${properties.width}x${properties.height} is not accepted for the ${deviceClass}-inch set`,
    );
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed${result.stderr ? `: ${result.stderr.trim()}` : ""}`,
    );
  }

  return result.stdout ?? "";
}

function inspectScreenshot(path) {
  const output = run(
    "sips",
    ["-g", "pixelWidth", "-g", "pixelHeight", "-g", "hasAlpha", path],
    { capture: true },
  );
  const width = Number(output.match(/pixelWidth: (\d+)/)?.[1]);
  const height = Number(output.match(/pixelHeight: (\d+)/)?.[1]);
  const hasAlpha = output.match(/hasAlpha: (yes|no)/)?.[1] === "yes";

  if (!width || !height || !/hasAlpha: (yes|no)/.test(output)) {
    throw new Error(`Could not inspect ${basename(path)} with sips`);
  }

  return { width, height, hasAlpha };
}

function captureScreenshot(udid, outputPath, deviceClass) {
  const rawPath = `${outputPath}.raw.png`;
  run("xcrun", ["simctl", "io", udid, "screenshot", rawPath]);

  try {
    run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      rawPath,
      "-pix_fmt",
      "rgb24",
      outputPath,
    ]);
  } finally {
    if (existsSync(rawPath)) unlinkSync(rawPath);
  }

  const properties = inspectScreenshot(outputPath);
  assertAcceptedScreenshot(properties, deviceClass);
  return properties;
}

function isSimulatorBooted(udid) {
  const devices = JSON.parse(
    run("xcrun", ["simctl", "list", "devices", "--json"], {
      capture: true,
    }),
  ).devices;

  return Object.values(devices)
    .flat()
    .some((device) => device.udid === udid && device.state === "Booted");
}

function parseArgs(argv) {
  const [udid, outputDirectory, deviceClass, ...rest] = argv;
  const appIndex = rest.indexOf("--app");
  const appPath = appIndex >= 0 ? rest[appIndex + 1] : undefined;

  if (!udid || !outputDirectory || !deviceClass) {
    throw new Error(
      "Usage: node scripts/capture-app-store-screenshots.mjs <simulator-udid> <output-dir> <6.9|6.1> [--app <App.app>]",
    );
  }

  acceptedPortraitDimensions(deviceClass);
  if (appIndex >= 0 && !appPath) throw new Error("--app requires an .app path");
  return {
    udid,
    outputDirectory: resolve(outputDirectory),
    deviceClass,
    appPath: appPath ? resolve(appPath) : undefined,
  };
}

async function main() {
  const { udid, outputDirectory, deviceClass, appPath } = parseArgs(
    process.argv.slice(2),
  );
  mkdirSync(outputDirectory, { recursive: true });

  if (!isSimulatorBooted(udid)) {
    run("xcrun", ["simctl", "boot", udid]);
  }
  run("xcrun", ["simctl", "bootstatus", udid, "-b"]);
  if (appPath) {
    if (!existsSync(appPath)) throw new Error(`App bundle not found: ${appPath}`);
    run("xcrun", ["simctl", "install", udid, appPath]);
  }
  run("xcrun", ["simctl", "launch", udid, "com.learndory.app"]);

  const input = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (let index = 0; index < screenshotNames.length; index += 1) {
      const name = screenshotNames[index];
      await input.question(
        `\n${index + 1}/5 ${screenshotPrompts[index]}. Press Return to capture ${name}: `,
      );
      const outputPath = resolve(outputDirectory, name);
      const properties = captureScreenshot(udid, outputPath, deviceClass);
      console.log(
        `Captured ${name}: ${properties.width}x${properties.height}, alpha=no`,
      );
    }
  } finally {
    input.close();
  }

  const manifest = screenshotNames
    .map((name) => `${name}: ${readFileSync(resolve(outputDirectory, name)).byteLength} bytes`)
    .join("\n");
  console.log(`\nCompleted ${deviceClass}-inch screenshot set:\n${manifest}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
