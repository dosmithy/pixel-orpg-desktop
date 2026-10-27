# Pixel ORPG for the desktop

One Electron window onto the live game at https://pixel-orpg.online, packaged for Windows (NSIS
installer, x64), macOS (dmg, Apple Silicon) and Linux (AppImage, x64). Landing page:
https://download.pixel-orpg.online.

The game isn't bundled. Its Realm turns away a client of another version, so a packed copy would
stop working at the next deploy; loading the site keeps the app current with no updates of its own.
A new release is only needed for a new Electron (or a new domain or logo).

## What the app adds over a browser tab

- The host's Game isn't slowed while its window is hidden (`backgroundThrottling: false`, and
  macOS's App Nap held off).
- No browser shortcuts: Ctrl+W, Ctrl+R and the rest reach the game (no menu on Windows and Linux).
- Links to the game's own pages (the Wiki) open in an app window; any other link in the browser.
- Closing in the middle of a Game asks first (the game's `beforeunload`, which Electron would
  otherwise turn into a close that silently does nothing).
- A "can't reach the server" page with a retry.
- `PixelORPGDesktop/<version>` on the user agent, for the game to tell it's in here.

## Working on it

```sh
pnpm install
pnpm start    # compile and open the app
pnpm dist     # build this OS's installer into release/
```

`build/icon.png` is the game's `assets/brand/logo.png` doubled pixel for pixel on a 1024 canvas;
`site/logo.png` is the logo as it is.

## Releasing

Bump `version` in `package.json`, commit, and push a tag:

```sh
git tag v0.1.0 && git push origin v0.1.0
```

`.github/workflows/release.yml` builds on Windows, macOS and Ubuntu and puts `PixelORPG-win.exe`,
`PixelORPG-mac.dmg` and `PixelORPG-linux.AppImage` on the tag's Release. The landing page links to
`releases/latest/download/<file>`, so it never needs changing.

Nothing is signed. The dmg is signed ad-hoc (`identity: "-"`) so Apple Silicon runs it at all, but
not notarized; the landing page walks players past each OS's warning.

## The landing page

`site/` is deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to `main` that
touches it. One-time setup:

1. Repo Settings → Pages → Source: **GitHub Actions**.
2. Cloudflare DNS for pixel-orpg.online: a `CNAME` record `download` → `dosmithy.github.io`, DNS only
   (grey cloud).
3. Once the certificate is issued, Settings → Pages → **Enforce HTTPS**.
