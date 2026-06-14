const { app, BrowserWindow, shell, nativeImage } = require("electron");
const path = require("path");

// Dory is a server-backed web app (Supabase + generation are remote), so the desktop
// app is a focused native window onto the deployed site rather than a bundled server.
// Auth cookies persist in Electron's own profile, so the long-lived session means you
// stay signed in across launches. Swap APP_URL to https://learndory.com once the
// domain is live (or set DORY_URL in the environment).
const APP_URL = process.env.DORY_URL || "https://cardstock-framewise-health.vercel.app";
const APP_ORIGIN = new URL(APP_URL).origin;

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 480,
    minHeight: 600,
    title: "Dory",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0f172a", // slate — avoids a white flash before the app paints
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(APP_URL);

  // Keep navigation inside the app; send anything off-origin (external links) to the
  // user's real browser instead of trapping it in the app window.
  const isExternal = (url) => {
    try {
      return new URL(url).origin !== APP_ORIGIN;
    } catch {
      return false;
    }
  };
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternal(url)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (isExternal(url)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  // Dev dock icon (the packaged .app uses build.mac.icon instead).
  const iconPath = path.join(__dirname, "icon.png");
  if (process.platform === "darwin" && app.dock) {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) app.dock.setIcon(img);
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// macOS keeps the app alive (dock) when all windows are closed.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
