/* Sadna 8 – scroll engine: canvas frame sequences, text beats, labels, expanding card, parallax. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const portraitMQ = matchMedia('(max-aspect-ratio: 1/1)');
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = t => t * t * (3 - 2 * t);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const top = $('#top'), bar = $('#bar');

  /* ---------- frame sequences ---------- */
  // crop = share of the full 16:9 frame width that the mobile ("m") frames keep (centered).
  const SEQ = {
    smash: { count: 90, crop: 0.62, map: p => clamp((p - 0.06) / 0.8), mz: 1.4 },
    // build: on wide screens shrink the (black-backed) frame so the title and price have room
    build: { count: 90, crop: 0.56, map: p => smooth(clamp((p - 0.44) / 0.4)), fit: 0.68, shift: 0.08, mz: 0.9 },
  };
  // layer heights (share of frame height) in the first "build" frame, x = burger edge (share of width)
  const LABELS = [
    { t: 'לחמניית בריוש', y: .12, side: 'r', x: .655 },
    { t: 'בצל', y: .28, side: 'l', x: .34 },
    { t: 'חמוצים', y: .37, side: 'r', x: .65 },
    { t: 'עגבנייה', y: .465, side: 'l', x: .34 },
    { t: 'חסה', y: .555, side: 'r', x: .69 },
    { t: 'רוטב הבית', y: .66, side: 'l', x: .345 },
    { t: "גבינת צ'דר", y: .735, side: 'r', x: .66 },
    { t: 'הקציצה', y: .80, side: 'l', x: .325 },
  ];

  class Sequence {
    constructor(scene, name) {
      this.scene = scene; this.name = name; this.cfg = SEQ[name];
      this.canvas = $('canvas', scene); this.ctx = this.canvas.getContext('2d', { alpha: false });
      this.frames = []; this.cur = 0; this.target = 0; this.tf = null; this.loading = false;
      this.dir = portraitMQ.matches ? 'm' : 'd';
    }
    url(i) { return `assets/seq/${this.name}/${this.dir}/${String(i + 1).padStart(3, '0')}.webp`; }
    load() {
      if (this.loading) return; this.loading = true;
      const n = this.cfg.count, order = [], seen = new Set();
      for (let step = 32; step >= 1; step = step >> 1)       // coarse-to-fine so scrubbing works early
        for (let i = 0; i < n; i += step) if (!seen.has(i)) { seen.add(i); order.push(i); }
      if (!seen.has(n - 1)) order.splice(1, 0, n - 1);
      let k = 0; const next = () => {
        if (k >= order.length) return;
        const i = order[k++], img = new Image();
        img.decoding = 'async';
        img.onload = () => { this.frames[i] = img; if (Math.abs(i - this.cur) < 3 || i === 0) this.draw(true); next(); };
        img.onerror = next; img.src = this.url(i);
      };
      for (let c = 0; c < 4; c++) next();                     // 4 parallel fetches
    }
    nearest(i) {
      for (let d = 0; d < this.cfg.count; d++) {
        if (this.frames[i - d]) return this.frames[i - d];
        if (this.frames[i + d]) return this.frames[i + d];
      }
      return null;
    }
    resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2), r = this.canvas.getBoundingClientRect();
      this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr);
      this.dpr = dpr; this.draw(true);
    }
    draw(force) {
      const i = Math.round(this.cur);
      if (!force && i === this.drawn) return;
      const img = this.nearest(i); if (!img) return;
      this.drawn = i;
      const { canvas: c, ctx } = this, cw = c.width, ch = c.height, iw = img.naturalWidth, ih = img.naturalHeight;
      const portrait = this.dir === 'm';
      const fit = this.cfg.fit;
      const s = portrait ? Math.min((cw * (this.cfg.mz || 1)) / iw, (ch * 0.78) / ih)
              : fit ? Math.min((ch * fit) / ih, cw / iw * 1.6) : Math.max(cw / iw, ch / ih);
      const dw = iw * s, dh = ih * s, dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2 + (portrait ? -ch * 0.03 : fit ? ch * (this.cfg.shift || 0) : 0);
      ctx.fillStyle = '#070a08'; ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, dx, dy, dw, dh);
      if (portrait || dw < cw - 2 || dh < ch - 2) {             // melt the frame edges into the black page
        let g;
        if (dh < ch - 2) {
          const fade = dh * (portrait ? 0.18 : 0.12);
          g = ctx.createLinearGradient(0, dy, 0, dy + fade);
          g.addColorStop(0, '#070a08'); g.addColorStop(1, 'rgba(7,10,8,0)');
          ctx.fillStyle = g; ctx.fillRect(0, dy - 1, cw, fade + 1);
          g = ctx.createLinearGradient(0, dy + dh - fade, 0, dy + dh);
          g.addColorStop(0, 'rgba(7,10,8,0)'); g.addColorStop(1, '#070a08');
          ctx.fillStyle = g; ctx.fillRect(0, dy + dh - fade, cw, fade + 1);
        }
        if (dw < cw - 2) {
          const fx = dw * 0.14;
          g = ctx.createLinearGradient(dx, 0, dx + fx, 0); g.addColorStop(0, '#070a08'); g.addColorStop(1, 'rgba(7,10,8,0)');
          ctx.fillStyle = g; ctx.fillRect(dx - 1, 0, fx, ch);
          g = ctx.createLinearGradient(dx + dw - fx, 0, dx + dw, 0); g.addColorStop(0, 'rgba(7,10,8,0)'); g.addColorStop(1, '#070a08');
          ctx.fillStyle = g; ctx.fillRect(dx + dw - fx, 0, fx + 1, ch);
        }
      }
      this.tf = { s, dx, dy, iw, ih, portrait };
      if (!this.shown) { this.shown = true; c.classList.add('on'); }
    }
    // full-frame fraction -> CSS px inside the stage
    toScreen(fx, fy) {
      const t = this.tf; if (!t) return null;
      const crop = t.portrait ? this.cfg.crop : 1;
      const ix = ((fx - (1 - crop) / 2) / crop) * t.iw, iy = fy * t.ih;
      return { x: (t.dx + ix * t.s) / this.dpr, y: (t.dy + iy * t.s) / this.dpr };
    }
  }

  /* ---------- scenes ---------- */
  const scenes = $$('.scene').map(el => {
    const name = $('canvas', el)?.dataset.seq;
    return { el, seq: name ? new Sequence(el, name) : null, beats: $$('.beat', el), p: 0 };
  });
  const progress = el => { const r = el.getBoundingClientRect(); return clamp(-r.top / (r.height - innerHeight)); };

  function beat(el, p) {
    const a = +el.dataset.in, b = +el.dataset.out, f = Math.min((b - a) * 0.28, 0.09);
    let o = p < a ? 0 : p < a + f ? (p - a) / f : p < b - f ? 1 : p < b ? (b - p) / f : 0;
    if (el.hasAttribute('data-start-visible') && p < a + f) o = 1;
    if (b >= 1 && p >= a + f) o = 1;                         // a scene's last beat holds until the scene leaves
    o = smooth(clamp(o));
    const leaving = p > (a + b) / 2, y = (1 - o) * (leaving ? -50 : 50);
    el.style.opacity = o.toFixed(3);
    el.style.transform = `translate3d(0,${y.toFixed(1)}px,0) scale(${(0.97 + 0.03 * o).toFixed(4)})`;
    el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
  }

  // labels for the build scene
  const build = scenes.find(s => s.seq?.name === 'build');
  const labelEls = [];
  if (build) {
    const host = $('[data-labels]', build.el);
    LABELS.forEach((l, i) => {
      const d = document.createElement('div');
      d.className = 'label ' + l.side; d.setAttribute('aria-hidden', 'true');
      d.innerHTML = `<i></i><span>${l.t}</span>`;
      host.appendChild(d); labelEls.push({ d, l, i });
    });
  }
  function placeLabels(p) {
    const seq = build.seq;
    labelEls.forEach(({ d, l, i }) => {
      const pt = seq.toScreen(l.x, l.y); if (!pt) return;
      const pin = 0.06 + i * 0.038, pout = 0.43;
      let o = clamp((p - pin) / 0.05) * (1 - clamp((p - pout) / 0.05));
      o = smooth(o);
      const W = seq.canvas.clientWidth, slide = (1 - o) * 24 * (l.side === 'r' ? 1 : -1);
      const w = d.offsetWidth || 0, m = 8;                     // keep every label fully on screen
      if (l.side === 'r') { d.style.left = Math.min(pt.x, W - w - m) + 'px'; d.style.right = 'auto'; }
      else { d.style.right = Math.min(W - pt.x, W - w - m) + 'px'; d.style.left = 'auto'; }
      d.style.top = pt.y + 'px';
      d.style.opacity = o.toFixed(3);
      d.style.transform = `translate3d(${slide.toFixed(1)}px,-50%,0)`;
    });
  }

  /* ---------- melt card ---------- */
  const melt = $('#melt'), card = $('[data-melt]'), meltCopy = $('[data-melt-copy]');
  function meltFrame() {
    const p = progress(melt), e = smooth(clamp(p / 0.55));
    const narrow = innerWidth < 720;
    const iy = (narrow ? 14 : 18) * (1 - e), ix = (narrow ? 6 : 14) * (1 - e), r = 36 * (1 - e);
    card.style.clipPath = `inset(${iy.toFixed(2)}% ${ix.toFixed(2)}% round ${r.toFixed(1)}px)`;
    const o = smooth(clamp((p - 0.45) / 0.2));
    meltCopy.style.opacity = o.toFixed(3);
    meltCopy.style.transform = `translate3d(0,${((1 - o) * 40).toFixed(1)}px,0)`;
  }

  /* ---------- parallax depth layers ---------- */
  const layers = $$('[data-depth]').map(el => ({ el, d: parseFloat(el.dataset.depth), host: el.closest('section') }));
  function parallax() {
    const vh = innerHeight;
    for (const l of layers) {
      const r = l.host.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      const off = (r.top + r.height / 2) - vh / 2;
      l.el.style.transform = `translate3d(0,${(-off * l.d * 0.5).toFixed(1)}px,0)`;
    }
  }

  /* ---------- lazy looping videos ---------- */
  const vids = $$('video[data-lazy-video]');
  const vio = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) {
      if (!v.dataset.ready) {
        $$('source', v).forEach(s => { s.src = s.dataset.src; });
        v.load(); v.dataset.ready = 1;
        v.addEventListener('playing', () => v.previousElementSibling?.matches('img,picture') && (v.style.opacity = 1), { once: true });
      }
      if (!reduce) v.play().catch(() => {});
    } else if (v.dataset.ready) v.pause();
  }), { rootMargin: '400px 0px' });
  vids.forEach(v => vio.observe(v));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !reduce) vids.forEach(v => { if (v.dataset.ready) { const r = v.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) v.play().catch(() => {}); } });
  });

  /* ---------- reveal + counter ---------- */
  const rio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
  $$('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 3) * 90 + 'ms'; rio.observe(el); });
  const num = $('[data-count]');
  if (num && !reduce) {
    const cio = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; cio.disconnect();
      const to = +num.dataset.count, t0 = performance.now();
      const step = t => { const k = clamp((t - t0) / 1400); num.textContent = (to * (1 - Math.pow(1 - k, 3))).toFixed(1); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }, { threshold: .6 });
    cio.observe(num);
  }

  /* ---------- today's hours ---------- */
  try {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })).getDay();
    $(`.hours li[data-day="${d}"]`)?.classList.add('today');
  } catch (e) {}

  /* ---------- reduced motion: static story, no sequences ---------- */
  if (reduce) {
    const still = $('#build .still'); if (still) still.src = 'assets/seq/build/' + (portraitMQ.matches ? 'm' : 'd') + '/090.webp';
    $$('.scene canvas').forEach(c => c.remove());
    addEventListener('scroll', () => { top.classList.toggle('solid', scrollY > 40); bar.classList.toggle('show', scrollY > innerHeight); }, { passive: true });
    return;
  }

  /* ---------- main loop ---------- */
  // start loading the hero sequence right away, the next one once the page is idle
  scenes[0]?.seq?.load();
  const idle = window.requestIdleCallback || (f => setTimeout(f, 1200));
  addEventListener('load', () => idle(() => scenes.forEach(s => s.seq?.load())));

  let running = false;
  function frame() {
    running = false;
    const y = scrollY, vh = innerHeight;
    top.classList.toggle('solid', y > 40);
    bar.classList.toggle('show', y > vh);
    let again = false;
    for (const s of scenes) {
      const r = s.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) continue;
      const p = progress(s.el); s.p = p;
      s.beats.forEach(b => beat(b, p));
      const dim = s.dim || (s.dim = $('[data-dim]', s.el) || false);
      if (dim) dim.style.opacity = (1 - smooth(clamp(p / 0.2))).toFixed(3);
      if (s.seq) {
        s.seq.load();
        s.seq.target = s.seq.cfg.map(p) * (s.seq.cfg.count - 1);
        const diff = s.seq.target - s.seq.cur;
        s.seq.cur += Math.abs(diff) < 0.05 ? diff : diff * 0.22;   // eased scrubbing
        if (Math.abs(s.seq.target - s.seq.cur) > 0.05) again = true;
        s.seq.draw();
        if (s.seq.name === 'build') placeLabels(p);
      }
    }
    const hint = $('[data-hint]'); if (hint) hint.style.opacity = String(1 - clamp(y / 200));
    const mr = melt.getBoundingClientRect(); if (mr.bottom > 0 && mr.top < vh) meltFrame();
    parallax();
    if (again) tick();
  }
  const tick = () => { if (!running) { running = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', tick, { passive: true });
  const onResize = () => {
    const dir = portraitMQ.matches ? 'm' : 'd';
    scenes.forEach(s => { if (!s.seq) return; if (s.seq.dir !== dir) { s.seq.dir = dir; s.seq.frames = []; s.seq.loading = false; s.seq.load(); } s.seq.resize(); });
    tick();
  };
  addEventListener('resize', onResize);
  onResize();
})();
