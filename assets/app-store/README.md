# Dory App Store Screenshots

These folders contain real screenshots captured from the Dory iOS simulator build.
They are validated against Apple's current screenshot specification before commit.

- `iphone-6.9/`: 1260×2736, 1290×2796, or 1320×2868 portrait PNGs.
- `iphone-6.1/`: 1170×2532, 1125×2436, or 1080×2340 portrait PNGs.

Every image must have `hasAlpha: no` when inspected with `sips` and must show only
real application UI. The capture order is library, new deck, generated-card review,
study, then metrics or Pro.

Capture with:

```bash
node scripts/capture-app-store-screenshots.mjs \
  <simulator-udid> assets/app-store/iphone-6.9 6.9 \
  --app mobile/ios/App/build/Build/Products/Debug-iphonesimulator/App.app
```

The script launches Dory, prompts for each state, strips the simulator screenshot's
alpha channel losslessly, and rejects dimensions that App Store Connect will not
accept.
