/**
 * Pixel ORPG on the desktop: one window onto the live game at https://pixel-orpg.online.
 *
 * The game itself is never bundled. The Realm turns away a client of another version, so a copy
 * packed in here would stop working at the next deploy; loading the site means the game is always
 * the one the Realm plays, and this app only needs a new release when Electron does.
 */
import { app, BrowserWindow, dialog, Menu, powerSaveBlocker, screen, session, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const GAME = 'https://pixel-orpg.online/';
const ORIGIN = new URL(GAME).origin;
const OFFLINE = path.join(import.meta.dirname, '../src/offline.html');
const BACKGROUND = '#0c0d12'; // the game page's own, so the window doesn't flash white while it loads

/** the game's own pages (the game, the Wiki), as against links out to the wider web */
const isGame = (url: string): boolean => {
  try {
    return new URL(url).origin === ORIGIN;
  } catch {
    return false;
  }
};

const openOutside = (url: string): void => {
  if (/^https?:/.test(url)) void shell.openExternal(url);
};

// the game can tell it runs in here, if it ever wants to (say, to hide its own Download link)
app.userAgentFallback = `${app.userAgentFallback} PixelORPGDesktop/${app.getVersion()}`;

// --- the main window's size and place, kept between launches --------------------------------

type Bounds = { x: number; y: number; width: number; height: number; maximized?: boolean };
const BOUNDS = path.join(app.getPath('userData'), 'window.json');

function savedBounds(): Bounds | undefined {
  try {
    const b = JSON.parse(fs.readFileSync(BOUNDS, 'utf8')) as Bounds;
    // only where a screen still is: a monitor unplugged since would leave the window off-screen
    const area = screen.getDisplayMatching(b).workArea;
    const visible = b.x < area.x + area.width && b.x + b.width > area.x && b.y < area.y + area.height && b.y + b.height > area.y;
    return visible ? b : undefined;
  } catch {
    return undefined;
  }
}

function keepBounds(win: BrowserWindow): void {
  const b: Bounds = { ...win.getNormalBounds(), maximized: win.isMaximized() };
  try {
    fs.writeFileSync(BOUNDS, JSON.stringify(b));
  } catch {
    // not worth bothering anyone over
  }
}

// --- every window's guards: the main one, and the Wiki's ---------------------------------------

app.on('web-contents-created', (_, contents) => {
  // links to the game's own pages (the Wiki's "open in a new tab") open in a window of their own,
  // anything else in the player's browser
  contents.setWindowOpenHandler(({ url }) => {
    if (isGame(url)) return { action: 'allow', overrideBrowserWindowOptions: { backgroundColor: BACKGROUND, autoHideMenuBar: true } };
    openOutside(url);
    return { action: 'deny' };
  });
  // a window never wanders off the game; the offline page's Retry goes back to it, so that's fine
  contents.on('will-navigate', (e, url) => {
    if (isGame(url)) return;
    e.preventDefault();
    openOutside(url);
  });
  // the game asks before a stray close throws a Game away (its `beforeunload`); Electron would
  // otherwise just refuse to close without a word, so the question is asked here
  contents.on('will-prevent-unload', (e) => {
    const win = BrowserWindow.fromWebContents(contents);
    const options = {
      type: 'question' as const,
      buttons: ['Leave', 'Stay'],
      defaultId: 1,
      cancelId: 1,
      message: 'Leave the game?',
      detail: "You'll drop out of the Game you're in.",
    };
    const choice = win ? dialog.showMessageBoxSync(win, options) : dialog.showMessageBoxSync(options);
    if (choice === 0) e.preventDefault();
  });
});

// --- the main window ---------------------------------------------------------------------------

function open(): void {
  const kept = savedBounds();
  const win = new BrowserWindow({
    width: kept?.width ?? 1280,
    height: kept?.height ?? 800,
    x: kept?.x,
    y: kept?.y,
    minWidth: 800,
    minHeight: 500,
    title: 'Pixel ORPG',
    backgroundColor: BACKGROUND,
    show: false,
    webPreferences: {
      // the host runs everyone's Game: it must not be slowed when its window is behind another
      backgroundThrottling: false,
    },
  });
  if (kept?.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.on('close', () => keepBounds(win));

  // the site can't be reached (no network, the server down): say so, with a way back
  win.webContents.on('did-fail-load', (_, code, _desc, url, isMainFrame) => {
    // -3 is a load cut short by another one, not a failure
    if (!isMainFrame || code === -3 || !isGame(url)) return;
    void win.loadFile(OFFLINE);
  });

  void win.loadURL(GAME);
}

// --- the app -----------------------------------------------------------------------------------

// the game uses Ctrl+W, Ctrl+R and the like for itself: on Windows and Linux there is no menu to
// take them; macOS keeps the app menu (Quit) and Edit (copy and paste in the chat)
Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }]) : null);

app.whenReady().then(() => {
  // only what the game asks for: fullscreen, and the keyboard while fullscreen (fullscreen.ts)
  const allowed = new Set(['fullscreen', 'keyboardLock']);
  session.defaultSession.setPermissionRequestHandler((_, permission, callback, details) => {
    callback(allowed.has(permission) && isGame(details.requestingUrl));
  });
  session.defaultSession.setPermissionCheckHandler((_, permission, origin) => allowed.has(permission) && isGame(origin));

  // macOS's App Nap would slow a host whose window is hidden, as a background tab would be
  powerSaveBlocker.start('prevent-app-suspension');

  open();
});

// the game is the window: closing it quits, on macOS too
app.on('window-all-closed', () => app.quit());
