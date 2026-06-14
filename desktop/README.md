# Dory — desktop (Electron)

A thin native macOS window onto the deployed Dory web app. Loads the live site, so
it needs internet (no offline study). Your login persists across launches.

## Run (dev)
    npm install
    npm start

## Build a Dory.app
    npm run build
    # → dist/mac*/Dory.app   (unsigned: first launch, right-click → Open)
    # copy Dory.app into /Applications

## Notes
- App URL lives in `main.js` (`APP_URL`). Swap to https://learndory.com once the
  domain is wired, or run with `DORY_URL=https://… npm start`.
- `icon.png` is a placeholder (the old card-stack mark). Replace it with the
  blue-tang icon once the logo is finalized, then rebuild.
