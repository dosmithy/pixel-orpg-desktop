/**
 * The game's look, from the game's own art at pixel-orpg.online: the pack images aren't kept in
 * this repo. The sky's clouds are plain images; the scroll, ribbon and button are put back together
 * from their 9-slice sheets on a canvas, as the game's ninepatch.ts does, which needs the game's
 * server to let this page read them (CORS on /art/). Until they load, or if they can't, the page
 * keeps a plain look (`no-art`).
 */
(() => {
  const ART = 'https://pixel-orpg.online/art/';

  // --- the 9-slice art: each sheet's pieces, and CSS pixels per sheet pixel ---------------------

  const BANNER = { cols: [[28, 128], [192, 256], [320, 404]], rows: [[60, 128], [192, 256], [320, 431]] };
  const RIBBON = { cols: [[2, 64], [128, 192], [256, 318]], rows: [[4, 4], [4, 64], [64, 64]] }; // the blue one, row 0
  const BUTTON = { cols: [[14, 64], [128, 192], [256, 306]], rows: [[17, 64], [128, 192], [256, 305]] };
  const KINDS = {
    scroll: { src: 'ui/banner', slice: BANNER, scale: 1 },
    ribbon: { src: 'ui/ribbons-small', slice: RIBBON, scale: 1 },
    button: { src: 'ui/button-blue', pressed: 'ui/button-blue-pressed', slice: BUTTON, scale: 0.8 },
  };

  const images = new Map();
  function image(name) {
    if (!images.has(name)) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = `${ART}${name}.png`;
      images.set(name, img.decode().then(() => img));
    }
    return images.get(name);
  }

  /** one axis laid out: the ends once (cut where they meet), the middle repeated between them */
  function layoutAxis([a, m, b], length, scale) {
    const first = Math.min(Math.round((a[1] - a[0]) * scale), Math.ceil(length / 2));
    const last = Math.min(Math.round((b[1] - b[0]) * scale), length - first);
    const spans = [{ band: 0, s0: 0, s1: first / scale, d0: 0, d1: first }];
    const tile = Math.max(1, Math.round((m[1] - m[0]) * scale));
    for (let d = first; d < length - last; d += tile) {
      const d1 = Math.min(d + tile, length - last);
      spans.push({ band: 1, s0: 0, s1: ((m[1] - m[0]) * (d1 - d)) / tile, d0: d, d1 });
    }
    const bw = b[1] - b[0];
    spans.push({ band: 2, s0: bw - last / scale, s1: bw, d0: length - last, d1: length });
    return spans.filter((s) => s.d1 > s.d0);
  }

  function canvasOf(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  /** a panel w×h device pixels: put together at a whole scale, pixel for pixel, then shrunk once */
  function ninePatch(img, slice, w, h, scale) {
    const n = Math.max(1, Math.ceil(scale));
    const whole = n === scale ? canvasOf(w, h) : canvasOf(Math.round((w * n) / scale), Math.round((h * n) / scale));
    const ctx = whole.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (const y of layoutAxis(slice.rows, whole.height, n)) {
      for (const x of layoutAxis(slice.cols, whole.width, n)) {
        const sx = slice.cols[x.band][0] + x.s0;
        const sy = slice.rows[y.band][0] + y.s0;
        ctx.drawImage(img, sx, sy, x.s1 - x.s0, y.s1 - y.s0, x.d0, y.d0, x.d1 - x.d0, y.d1 - y.d0);
      }
    }
    if (whole.width === w && whole.height === h) return whole;
    const panel = canvasOf(w, h);
    const out = panel.getContext('2d');
    out.imageSmoothingEnabled = true;
    out.imageSmoothingQuality = 'high';
    out.drawImage(whole, 0, 0, w, h);
    return panel;
  }

  async function paint(el) {
    const kind = KINDS[el.dataset.art];
    if (!kind) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(el.offsetWidth * dpr);
    const h = Math.round(el.offsetHeight * dpr);
    const key = `${w}x${h}@${dpr}`;
    if (w === 0 || h === 0 || el.dataset.drawn === key) return;
    el.dataset.drawn = key;
    const url = async (name) => ninePatch(await image(name), kind.slice, w, h, kind.scale * dpr).toDataURL();
    el.style.setProperty('--art', `url(${await url(kind.src)})`);
    if (kind.pressed) el.style.setProperty('--art-down', `url(${await url(kind.pressed)})`);
  }

  const root = document.documentElement;
  root.classList.add('no-art');
  const panels = Array.from(document.querySelectorAll('[data-art]'));
  Promise.all(Object.values(KINDS).flatMap((k) => [k.src, k.pressed].filter(Boolean).map(image)))
    .then(async () => {
      await Promise.all(panels.map(paint));
      root.classList.remove('no-art');
      // a panel drawn again whenever its size changes (the window, the font arriving)
      const watch = new ResizeObserver((entries) => entries.forEach((e) => paint(e.target).catch(() => {})));
      panels.forEach((el) => watch.observe(el));
      matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener('change', () => panels.forEach((el) => paint(el)));
    })
    .catch(() => {
      // the art can't be read (the game's server down, or not letting this page read it): keep the plain look
    });

  // --- the sky: the pack's clouds drifting, in two layers going opposite ways --------------------

  const CLOUD = { w: 576, h: 256 };
  // how many, CSS pixels per cloud pixel, CSS pixels a second (below 0, leftward), and how faded
  const LAYERS = [
    { count: 5, scale: 0.6, speed: -10, opacity: 0.75 },
    { count: 4, scale: 1, speed: 24, opacity: 1 },
  ];
  const sky = document.getElementById('clouds');
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const clouds = LAYERS.flatMap((layer) =>
    Array.from({ length: layer.count }, () => {
      const el = document.createElement('img');
      el.alt = '';
      el.src = `${ART}terrain/cloud-${1 + Math.floor(Math.random() * 8)}.png`;
      el.style.opacity = layer.opacity;
      el.style.width = `${CLOUD.w * layer.scale}px`;
      sky.append(el);
      return { el, layer, x: Math.random(), y: Math.random() };
    }),
  );
  function place(dt) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    for (const c of clouds) {
      const w = CLOUD.w * c.layer.scale;
      const h = CLOUD.h * c.layer.scale;
      c.x += (c.layer.speed * (calm.matches ? 0.5 : 1) * dt) / (W + w);
      // off one side, it comes back in at the other, somewhere else up the sky
      if (c.x > 1 || c.x < 0) {
        c.x -= Math.floor(c.x);
        c.y = Math.random();
      }
      c.el.style.transform = `translate(${c.x * (W + w) - w}px, ${c.y * (H + h / 2) - h / 2}px)`;
    }
  }
  let last = performance.now();
  const frame = (t) => {
    place(Math.min(0.1, (t - last) / 1000));
    last = t;
    requestAnimationFrame(frame);
  };
  place(0);
  requestAnimationFrame(frame);
})();
