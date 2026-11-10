/* =========================================================
   S ♥ H — romantic interactive letter
   Vanilla JS · no libraries · works from file://
   ========================================================= */
(() => {
  'use strict';

  /* ╔══════════════════════════════════════════════════════╗
     ║  EDIT HERE                                           ║
     ╚══════════════════════════════════════════════════════╝ */

  // 1) The Arabic message shown after photo 2 appears.
  //    One string = one line. Change, add or remove lines freely.
  //    (Words fade in one by one — splitting Arabic into single letters
  //    would break the cursive joining, so words are the smallest unit.)
  const ARABIC_MESSAGE = [
    'إلى مَن سكنَ قلبي قبل أن أعرفَ للحبِّ اسمًا،',
    'في يدكِ وجدتُ وطني، وفي عينيكِ وجدتُ أماني.',
    'كلُّ خاتمٍ في الدنيا يصغرُ أمامَ وعدٍ واحد: أنّي معكِ ما حييت.',
    'يا أمَّ مَيار وعلي، يا بيتي وطمأنينتي،',
    'أحبُّكِ اليومَ، وغدًا، وما بقيَ من العمر.',
    '— سلمان'
  ];

  // 2) Background music. Drop your own MP3 at this path (see assets/README.txt).
  //    If the file is missing/empty, a soft generated piano-and-pad
  //    melody (original, royalty-free) plays instead.
  const MUSIC_FILE = 'assets/romantic-music.mp3';
  const DEFAULT_VOLUME = 0.35;   // 0 – 1

  // 2b) What happens after the quiz:
  //     'video' = envelope returns → black hole into the seal → black → romantic_ring_cinematic.mp4
  //     'scene' = the earlier photo animation (hands, ring, pen, message)
  const FINALE = 'video';
  //     The black-hole sequence plays even if the device has "reduce motion" turned on.
  //     Set to true to respect that setting (then only a soft fade to black is used).
  const RESPECT_REDUCED_MOTION = false;

  // 3) Quiz. Answers are compared case-, accent- and space-insensitively.
  const QUESTIONS = [
    { key: 'loveName',     type: 'text',    title: "What's your love's name?",       placeholder: 'Write a name…', accept: ['salmane', 'salman', 'سلمان'] },
    { key: 'daughterName', type: 'text',    title: "What's your daughter's name?",   placeholder: 'Write a name…', accept: ['mayar', 'ميار'] },
    { key: 'sonName',      type: 'text',    title: "What's your son's name?",        placeholder: 'Write a name…', accept: ['ali', 'علي'] },
    { key: 'birthday',     type: 'date',    title: "What's your lover's birthday?",  accept: { y: 2006, m: 3, d: 3 } },
    { key: 'message',      type: 'message', title: 'A message to your lover',        placeholder: 'Write what your heart wants to say…', minLength: 3 }
  ];

  /* ---------------------------------------------------------
     Helpers
     --------------------------------------------------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOutCubic = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const bump = (t, c, w) => Math.max(0, 1 - Math.abs(t - c) / w);
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Saved answers (kept in memory for this visit)
  const answers = {};

  // warm the image cache so the cinematic scene never stutters
  ['assets/photo1.jpg', 'assets/photo1_clean.jpg', 'assets/ring.png', 'assets/photo2.jpg']
    .forEach((src) => { const i = new Image(); i.decoding = 'async'; i.src = src; });

  const screens = {
    envelope: $('#screen-envelope'),
    quiz: $('#screen-quiz'),
    scene: $('#screen-scene')
  };
  function showScreen(name) {
    Object.entries(screens).forEach(([k, el]) => {
      const on = k === name;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    document.body.classList.toggle('on-dark', name === 'scene');
    fx.setMood(name === 'scene' ? 'scene' : 'light');
  }

  /* =========================================================
     FX CANVAS — floating hearts, gold dust, sparks, reveal rim
     ========================================================= */
  const fx = (() => {
    const cv = $('#fx');
    const ctx = cv.getContext('2d');
    let w = 0, h = 0, dpr = 1, mood = 'light', last = performance.now();
    const ambient = [];
    const sparks = [];
    let rim = null;

    const count = () => (window.innerWidth < 640 ? 22 : 38);

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function make(initial) {
      const heart = Math.random() < .55;
      return {
        heart,
        x: Math.random() * w,
        y: initial ? Math.random() * h : h + 20,
        s: heart ? 5 + Math.random() * 9 : 1 + Math.random() * 1.8,
        vy: heart ? 10 + Math.random() * 16 : 4 + Math.random() * 10,
        ph: Math.random() * 6.28,
        sw: 6 + Math.random() * 16,
        a: heart ? .14 + Math.random() * .22 : .25 + Math.random() * .5,
        rot: (Math.random() - .5) * .6,
        tw: .5 + Math.random() * 1.6
      };
    }

    function heartPath(s) {
      ctx.beginPath();
      ctx.moveTo(0, s * .9);
      ctx.bezierCurveTo(-s * 1.3, -s * .1, -s * .7, -s * 1.1, 0, -s * .4);
      ctx.bezierCurveTo(s * .7, -s * 1.1, s * 1.3, -s * .1, 0, s * .9);
      ctx.closePath();
    }

    function spark(x, y, n = 1, spread = 1) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, sp = (10 + Math.random() * 60) * spread;
        sparks.push({ x: x + (Math.random() - .5) * 14, y: y + (Math.random() - .5) * 14,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10, life: 0, max: .6 + Math.random() * 1.1, s: .8 + Math.random() * 2.2 });
      }
    }

    function frame(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, w, h);
      const dark = mood === 'dark';

      if (mood === 'scene') ambient.length = 0;   // keep the cinematic scene clean
      while (mood !== 'scene' && ambient.length < count()) ambient.push(make(ambient.length < count() * .8));

      for (let i = ambient.length - 1; i >= 0; i--) {
        const p = ambient[i];
        p.y -= p.vy * dt; p.ph += dt * .8;
        const x = p.x + Math.sin(p.ph) * p.sw;
        if (p.y < -30) { ambient.splice(i, 1); continue; }
        const fade = clamp(Math.min(p.y + 30, h - p.y + 30) / 160);
        if (p.heart) {
          ctx.save(); ctx.translate(x, p.y); ctx.rotate(Math.sin(p.ph) * p.rot);
          ctx.globalAlpha = p.a * fade * (dark ? .75 : 1);
          ctx.fillStyle = dark ? '#e8bf7a' : (p.s > 9 ? '#e99aa8' : '#d98c98');
          heartPath(p.s); ctx.fill(); ctx.restore();
        } else {
          const tw = .55 + .45 * Math.sin(p.ph * p.tw * 2);
          ctx.globalAlpha = p.a * fade * tw * (dark ? 1 : .8);
          ctx.fillStyle = dark ? '#ffe2a8' : '#cfa357';
          ctx.beginPath(); ctx.arc(x, p.y, p.s, 0, 6.283); ctx.fill();
        }
      }

      ctx.globalCompositeOperation = 'lighter';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]; s.life += dt;
        if (s.life >= s.max) { sparks.splice(i, 1); continue; }
        s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= .985; s.vy = s.vy * .985 + 8 * dt;
        const k = 1 - s.life / s.max;
        ctx.globalAlpha = k * .95;
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.s * 4);
        g.addColorStop(0, 'rgba(255,244,214,1)'); g.addColorStop(.35, 'rgba(255,204,120,.7)'); g.addColorStop(1, 'rgba(255,170,80,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.s * 4, 0, 6.283); ctx.fill();
      }

      if (rim && rim.a > .003 && rim.r > 1) {
        ctx.globalAlpha = 1;
        ctx.lineWidth = 14; ctx.strokeStyle = `rgba(255,170,90,${rim.a * .18})`;
        ctx.beginPath(); ctx.arc(rim.x, rim.y, rim.r, 0, 6.283); ctx.stroke();
        ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,224,160,${rim.a * .75})`;
        ctx.shadowColor = 'rgba(255,190,100,.9)'; ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.arc(rim.x, rim.y, rim.r, 0, 6.283); ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    }

    window.addEventListener('resize', resize);
    resize();
    requestAnimationFrame(frame);

    return {
      spark,
      setMood: (m) => { mood = m; },
      setRim: (r) => { rim = r; }
    };
  })();

  /* =========================================================
     MUSIC — your MP3 if present, otherwise a soft generated piece
     ========================================================= */
  const Music = (() => {
    const btn = $('#music-btn'), vol = $('#music-vol');
    let mode = null;            // 'file' | 'synth'
    let audio = null, ctx = null, master = null, bus = null, timer = null;
    let on = false, started = false, volume = DEFAULT_VOLUME, step = 0, nextTime = 0;

    const EIGHTH = .74;
    const ARP = [0, 2, 1, 3, 2, 4, 3, 1];
    const PROG = [
      { bass: 45, notes: [57, 60, 64, 67, 71], pad: [57, 64, 67] },   // Am9
      { bass: 41, notes: [53, 57, 60, 64, 69], pad: [53, 60, 64] },   // Fmaj7
      { bass: 48, notes: [55, 59, 64, 67, 71], pad: [55, 64, 67] },   // Cmaj7
      { bass: 43, notes: [55, 59, 62, 64, 67], pad: [55, 62, 64] }    // G6/9
    ];
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

    function ui() {
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', on ? 'Turn music off' : 'Turn music on');
      vol.style.setProperty('--v', vol.value + '%');
    }

    function impulse(c, dur, decay) {
      const len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return buf;
    }

    function pluck(m, t, vel) {
      const f = mtof(m);
      const g = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = .4;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel * .16, t + .015);
      g.gain.exponentialRampToValueAtTime(.0001, t + 2.8);
      [['triangle', f, 1], ['sine', f * 2, .25]].forEach(([type, fr, a]) => {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = type; o.frequency.value = fr; og.gain.value = a;
        o.connect(og); og.connect(g); o.start(t); o.stop(t + 3);
      });
      g.connect(lp); lp.connect(bus);
    }
    function sustain(m, t, d, level, type) {
      const f = mtof(m), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 900;
      g.gain.setValueAtTime(.0001, t);
      g.gain.linearRampToValueAtTime(level, t + 1.8);
      g.gain.setValueAtTime(level, t + d);
      g.gain.linearRampToValueAtTime(.0001, t + d + 2.4);
      [-6, 6].forEach((det) => {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
        o.connect(g); o.start(t); o.stop(t + d + 2.6);
      });
      g.connect(lp); lp.connect(bus);
    }

    function schedule() {
      if (!ctx) return;
      while (nextTime < ctx.currentTime + .7) {
        const bar = Math.floor(step / 8) % PROG.length, i = step % 8, ch = PROG[bar];
        if (i === 0) {
          sustain(ch.bass, nextTime, EIGHTH * 8, .13, 'sine');
          ch.pad.forEach((n) => sustain(n, nextTime, EIGHTH * 8, .028, 'triangle'));
        }
        pluck(ch.notes[ARP[i]], nextTime, i === 0 ? 1 : .7);
        if (i % 2 === 0 && Math.random() < .34) {
          pluck(ch.notes[(Math.random() * ch.notes.length) | 0] + 12, nextTime + EIGHTH * .5, .45);
        }
        nextTime += EIGHTH; step++;
      }
    }

    function startSynth() {
      mode = 'synth';
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = ctx || new AC();
      master = ctx.createGain(); master.gain.value = 0;
      const comp = ctx.createDynamicsCompressor();
      const rev = ctx.createConvolver(); rev.buffer = impulse(ctx, 3.4, 2.6);
      const wet = ctx.createGain(); wet.gain.value = .55;
      const dry = ctx.createGain(); dry.gain.value = .75;
      bus = ctx.createGain();
      bus.connect(dry); bus.connect(rev); rev.connect(wet);
      dry.connect(master); wet.connect(master); master.connect(comp); comp.connect(ctx.destination);
      ctx.resume();
      nextTime = ctx.currentTime + .15; step = 0;
      timer = setInterval(schedule, 200); schedule();
      master.gain.setTargetAtTime(volume * .85, ctx.currentTime, 1.6);
    }

    function fadeFile(to, ms) {
      if (!audio) return;
      const el = audio, from = el.volume, t0 = performance.now();
      (function tick(now) {
        const k = clamp((now - t0) / ms);
        el.volume = clamp(lerp(from, to, k));
        if (k < 1 && el === audio) requestAnimationFrame(tick);
      })(t0);
    }

    function startFile() {
      mode = 'file';
      audio = new Audio();
      audio.loop = true; audio.preload = 'auto'; audio.volume = 0; audio.src = MUSIC_FILE;
      const fail = () => {
        if (mode !== 'file') return;
        audio = null; mode = null; startSynth();
      };
      audio.addEventListener('error', fail, { once: true });
      const p = audio.play();
      if (p && p.then) p.then(() => { if (audio) fadeFile(volume, 2500); }).catch(fail);
    }

    function start() {
      if (started) return;
      started = true; on = true; ui();
      startFile();
    }
    function pause() {
      on = false; ui();
      if (mode === 'file' && audio) { fadeFile(0, 500); const a = audio; setTimeout(() => { if (!on && a === audio) a.pause(); }, 520); }
      if (mode === 'synth' && master) { master.gain.setTargetAtTime(0, ctx.currentTime, .25); clearInterval(timer); setTimeout(() => { if (!on && ctx) ctx.suspend(); }, 1200); }
    }
    function resume() {
      on = true; ui();
      if (mode === 'file' && audio) { audio.play().catch(() => {}); fadeFile(volume, 900); }
      if (mode === 'synth' && ctx) {
        ctx.resume(); nextTime = ctx.currentTime + .1;
        clearInterval(timer); timer = setInterval(schedule, 200);
        master.gain.setTargetAtTime(volume * .85, ctx.currentTime, .6);
      }
    }
    function toggle() { if (!started) start(); else if (on) pause(); else resume(); }
    function setVolume(v) {
      volume = clamp(v);
      if (mode === 'file' && audio && on) audio.volume = volume;
      if (mode === 'synth' && master && on) master.gain.setTargetAtTime(volume * .85, ctx.currentTime, .08);
      ui();
    }

    btn.addEventListener('click', toggle);
    vol.addEventListener('input', () => setVolume(vol.value / 100));
    vol.value = Math.round(DEFAULT_VOLUME * 100); ui();

    return { start, pause, resume };
  })();

  /* =========================================================
     1. ENVELOPE
     ========================================================= */
  const envBtn = $('#envelope');
  let opened = false;

  async function openEnvelope() {
    if (opened) return;
    opened = true;
    Music.start();                         // user gesture → audio is allowed
    const fast = reduceMotion();
    envBtn.classList.add('is-spinning');   // 1. seal spins quickly
    await sleep(fast ? 400 : 1150);
    envBtn.classList.add('is-opening');    // 2. flap opens
    await sleep(fast ? 200 : 480);
    envBtn.classList.add('flap-behind');
    await sleep(fast ? 300 : 760);
    envBtn.classList.add('is-letter');     // 3. letter slowly emerges
    await sleep(fast ? 800 : 3000);
    envBtn.classList.add('is-presenting'); // 4. envelope fades away
    await sleep(fast ? 400 : 1000);
    startQuiz();                           // 5. quiz begins automatically
  }
  envBtn.addEventListener('click', openEnvelope);

  /* =========================================================
     2. QUIZ
     ========================================================= */
  const slot = $('#q-slot'), form = $('#quiz-form'), nextBtn = $('#next-btn'), nextLabel = $('#next-label');
  const progLabel = $('#progress-label'), progFill = $('#progress-fill'), progBar = $('#progress');
  let qi = 0, busy = false, getValue = () => '';

  const norm = (s) => String(s).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f\u064B-\u0652\u0640]/g, '')
    .replace(/[\s\-_'’.]+/g, '');

  const MONTHS = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2000, i, 1)));
  const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ----- calendar / date picker ----- */
  function buildCalendar(onPick) {
    const today = new Date();
    const view = { y: today.getFullYear(), m: today.getMonth() };
    let sel = null;

    const root = el('div', 'cal');
    root.setAttribute('role', 'group'); root.setAttribute('aria-label', 'Choose a date');
    const head = el('div', 'cal__head');
    const prev = el('button', 'cal__nav', '‹'); prev.type = 'button'; prev.setAttribute('aria-label', 'Previous month');
    const next = el('button', 'cal__nav', '›'); next.type = 'button'; next.setAttribute('aria-label', 'Next month');
    const mSel = el('select'); mSel.setAttribute('aria-label', 'Month');
    MONTHS.forEach((n, i) => mSel.append(new Option(n, i)));
    const ySel = el('select'); ySel.setAttribute('aria-label', 'Year');
    for (let y = today.getFullYear(); y >= 1930; y--) ySel.append(new Option(y, y));
    head.append(prev, mSel, ySel, next);

    const week = el('div', 'cal__week'); WEEK.forEach((d) => week.append(el('span', '', d)));
    const grid = el('div', 'cal__grid');
    const picked = el('p', 'cal__picked', 'Pick a day on the calendar');
    picked.setAttribute('aria-live', 'polite');
    root.append(head, week, grid, picked);

    function render() {
      mSel.value = view.m; ySel.value = view.y;
      grid.textContent = '';
      const first = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
      const days = new Date(view.y, view.m + 1, 0).getDate();
      for (let i = 0; i < first; i++) grid.append(el('span'));
      for (let d = 1; d <= days; d++) {
        const b = el('button', 'cal__day', String(d)); b.type = 'button';
        const date = new Date(view.y, view.m, d);
        b.disabled = date > today;
        b.setAttribute('aria-label', `${d} ${MONTHS[view.m]} ${view.y}`);
        if (sel && sel.y === view.y && sel.m === view.m && sel.d === d) { b.classList.add('is-selected'); b.setAttribute('aria-pressed', 'true'); }
        b.addEventListener('click', () => {
          sel = { y: view.y, m: view.m + 1, d };
          picked.textContent = `${d} ${MONTHS[view.m]} ${view.y}`;
          render(); onPick(sel);
        });
        grid.append(b);
      }
      const atMax = view.y === today.getFullYear() && view.m === today.getMonth();
      const atMin = view.y === 1930 && view.m === 0;
      next.disabled = atMax; prev.disabled = atMin;
    }
    const shift = (n) => {
      let m = view.m + n, y = view.y;
      if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
      if (y > today.getFullYear() || y < 1930) return;
      view.m = m; view.y = y; render();
    };
    prev.addEventListener('click', () => shift(-1));
    next.addEventListener('click', () => shift(1));
    mSel.addEventListener('change', () => { view.m = +mSel.value; render(); });
    ySel.addEventListener('change', () => { view.y = +ySel.value; render(); });
    render();
    return { root, get: () => sel };
  }

  function renderQuestion(i, dir = 'in') {
    const q = QUESTIONS[i];
    const wrap = el('div', 'q is-in');
    wrap.dataset.index = i;
    wrap.append(el('div', 'q__divider', '♥'));
    const title = el('h2', 'q__title', q.title); title.id = 'q-title'; wrap.append(title);

    const err = el('p', 'q__error'); err.id = 'q-error'; err.setAttribute('role', 'alert');
    let focusEl = null;

    if (q.type === 'text') {
      const f = el('div', 'field');
      const inp = el('input'); inp.type = 'text'; inp.placeholder = q.placeholder; inp.maxLength = 40;
      inp.setAttribute('aria-labelledby', 'q-title'); inp.setAttribute('aria-describedby', 'q-error');
      inp.setAttribute('autocapitalize', 'words'); inp.setAttribute('autocomplete', 'off'); inp.spellcheck = false;
      f.append(inp, el('span', 'field__glow'));
      wrap.append(f);
      getValue = () => inp.value;
      focusEl = inp;
      inp.addEventListener('input', hideError);
    } else if (q.type === 'date') {
      const cal = buildCalendar(hideError);
      wrap.append(cal.root);
      getValue = () => cal.get();
    } else {
      const f = el('div', 'field field--area');
      const ta = el('textarea'); ta.placeholder = q.placeholder; ta.maxLength = 1200; ta.rows = 6;
      ta.setAttribute('aria-labelledby', 'q-title'); ta.setAttribute('aria-describedby', 'q-error');
      const cnt = el('p', 'count', '0 / 1200');
      ta.addEventListener('input', () => { cnt.textContent = `${ta.value.length} / 1200`; hideError(); });
      f.append(ta, cnt);
      wrap.append(f);
      getValue = () => ta.value;
      focusEl = ta;
    }
    wrap.append(err);

    slot.textContent = '';
    slot.append(wrap);
    nextLabel.textContent = i === QUESTIONS.length - 1 ? 'Send with love' : 'Continue';
    progLabel.textContent = `${i + 1} / ${QUESTIONS.length}`;
    progFill.style.width = ((i + 1) / QUESTIONS.length) * 100 + '%';
    progBar.setAttribute('aria-valuenow', String(i + 1));
    if (focusEl && i > 0) setTimeout(() => focusEl.focus({ preventScroll: true }), 650);
    else if (focusEl) setTimeout(() => focusEl.focus({ preventScroll: true }), 1400);
  }

  function showError(msg) {
    const e = $('#q-error'); if (!e) return;
    e.textContent = msg; e.classList.add('is-shown');
    const q = $('.q', slot); q.classList.remove('shake'); void q.offsetWidth; q.classList.add('shake');
  }
  function hideError() { const e = $('#q-error'); if (e) e.classList.remove('is-shown'); }

  function validate(q, value) {
    if (q.type === 'text') {
      if (!String(value).trim()) return 'Write an answer first.';
      return q.accept.map(norm).includes(norm(value)) ? '' : "That's not quite it. Try again, my love.";
    }
    if (q.type === 'date') {
      if (!value) return 'Choose a date on the calendar.';
      const a = q.accept;
      return (value.y === a.y && value.m === a.m && value.d === a.d) ? '' : "That's not the day. Look again.";
    }
    return String(value).trim().length >= q.minLength ? '' : 'Write a few words from your heart first.';
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    if (busy) return;
    const q = QUESTIONS[qi], value = getValue();
    const problem = validate(q, value);
    if (problem) { showError(problem); return; }

    answers[q.key] = q.type === 'date'
      ? `${String(value.y).padStart(4, '0')}-${String(value.m).padStart(2, '0')}-${String(value.d).padStart(2, '0')}`
      : String(value).trim();
    busy = true; nextBtn.disabled = true;

    const cur = $('.q', slot);
    if (cur) cur.classList.replace('is-in', 'is-out');
    await sleep(reduceMotion() ? 50 : 480);

    if (qi < QUESTIONS.length - 1) {
      qi++; renderQuestion(qi);
      busy = false; nextBtn.disabled = false;
    } else {
      window.loveAnswers = Object.freeze({ ...answers });   // saved for later use
      screens.quiz.classList.add('is-leaving');
      await sleep(reduceMotion() ? 300 : 1000);
      if (FINALE === 'video') startFinale(); else startScene();
    }
  }
  form.addEventListener('submit', onSubmit);

  function startQuiz() {
    showScreen('quiz');
    qi = 0; renderQuestion(0);
  }

  /* =========================================================
     3. CINEMATIC SCENE
     hands → ring turns face-on and grows toward the camera →
     photo 2 appears THROUGH the ring (blurred → sharp) → pen rests 2 s → pen writes message
     ========================================================= */
  const layer1 = $('#layer1'), layer2 = $('#layer2'), stage1 = $('#stage1'), stage2 = $('#stage2');
  const orig = $('#orig'), handL = $('#handL'), handR = $('#handR');
  const ringOverlay = $('#ringOverlay'), photo2 = $('#photo2'), pen = $('#pen');
  const scrim = $('#scrim'), messageEl = $('#message'), replayBtn = $('#replay');

  // Ring centre in photo 1 (fractions of 688×1535) and the half-size of its opening
  const RING1 = { x: 466 / 688, y: 610 / 1535 };
  const HOLE = { rx: 34 / 688, ry: 23 / 1535 };
  const SY_MAX = 1.4;        // the ring turns to face the camera (its opening becomes round)

  // Timing (ms) — the zoom is slow and gentle, the pen is fast
  const T = { hands: 7000, spin0: 600, spin1: 7600, zoom0: 2500, zoom1: 13500 };
  const PEN_PAUSE = 2000;    // pen stays visible exactly 2 s before writing

  let G = null, rafId = 0, sceneToken = 0, pp = { x: 0, y: 0 };
  const live = (tk) => tk === sceneToken;
  const wait = (ms, tk) => sleep(ms).then(() => live(tk));
  const tween = (ms, fn, tk) => new Promise((res) => {
    const t0 = performance.now();
    (function f(n) {
      if (!live(tk)) return res(false);
      const k = clamp((n - t0) / ms); fn(k, n);
      k < 1 ? requestAnimationFrame(f) : res(true);
    })(t0);
  });
  const placePen = (x, y) => { pp = { x, y }; pen.style.transform = `translate3d(${x}px, ${y}px, 0)`; };
  const glidePen = (to, ms, tk) => {
    const from = { ...pp };
    return tween(ms, (k) => { const e = easeInOutCubic(k); placePen(lerp(from.x, to.x, e), lerp(from.y, to.y, e)); }, tk);
  };

  function geometry() {
    const a = { x: stage1.offsetLeft, y: stage1.offsetTop, w: stage1.offsetWidth, h: stage1.offsetHeight };
    const vw = window.innerWidth, vh = window.innerHeight;
    // scale at which the ring's opening is bigger than the whole screen
    const sPass = Math.hypot(vw / 2 / (HOLE.rx * a.w), vh / 2 / (HOLE.ry * SY_MAX * a.h)) * 1.1;
    G = { vw, vh, a, sPass, ring0: { x: a.x + RING1.x * a.w, y: a.y + RING1.y * a.h } };
    stage1.style.transformOrigin = `${RING1.x * 100}% ${RING1.y * 100}%`;
  }
  window.addEventListener('resize', () => { if (screens.scene.classList.contains('is-active')) geometry(); });

  function resetScene() {
    cancelAnimationFrame(rafId);
    layer1.style.transition = 'none'; layer1.style.opacity = '0'; layer1.classList.remove('is-piercing');
    stage1.style.transform = '';
    orig.style.opacity = '1'; ringOverlay.style.opacity = '0'; ringOverlay.style.transform = '';
    handL.style.transform = ''; handR.style.transform = '';
    layer2.style.transition = 'none'; layer2.style.opacity = '0'; layer2.classList.remove('is-final');
    stage2.style.transform = ''; photo2.style.filter = '';
    pen.style.opacity = '0';
    scrim.classList.remove('is-on'); replayBtn.classList.remove('is-on'); messageEl.textContent = '';
  }

  /* ---------- scenes 1 + 2: hands, ring, camera through the ring ---------- */
  function startScene() {
    const tk = ++sceneToken;
    resetScene();
    showScreen('scene');
    screens.quiz.classList.remove('is-leaving');
    geometry();
    if (reduceMotion()) { playReduced(tk); return; }

    orig.style.opacity = '0';            // clean plate + separate ring (identical at rotation 0)
    ringOverlay.style.opacity = '1';
    layer1.style.transition = 'opacity 1.4s ease';
    void layer1.offsetWidth;
    layer1.style.opacity = '1';

    const dx = G.vw / 2 - G.ring0.x, dy = G.vh / 2 - G.ring0.y, D = G.a.w * .016, lnMax = Math.log(G.sPass * 1.04);
    let t0 = null;

    function frame(now) {
      if (!live(tk)) return;
      if (t0 === null) t0 = now;
      const t = now - t0;

      // hands slowly move toward each other
      const h = easeInOutSine(clamp(t / T.hands));
      handL.style.transform = `translate3d(${D * h}px, ${-D * .25 * h}px, 0)`;
      handR.style.transform = `translate3d(${-D * h}px, ${D * .12 * h}px, 0)`;

      // camera: slow, accelerating approach — the ring grows toward us
      const u = clamp((t - T.zoom0) / (T.zoom1 - T.zoom0));
      const s = Math.exp(lnMax * (1 - Math.cos(u * Math.PI / 2)));
      const pd = easeInOutSine(clamp(u / .85));
      stage1.style.transform = `translate3d(${dx * pd}px, ${dy * pd}px, 0) scale(${s})`;

      // ring: one smooth turn, then it faces the camera (round opening)
      const sp = easeInOutSine(clamp((t - T.spin0) / (T.spin1 - T.spin0)));
      const sy = 1 + (SY_MAX - 1) * easeInOutSine(clamp(u / .55));
      ringOverlay.style.transform = `perspective(280px) rotateY(${sp * 360}deg) scaleY(${sy})`;

      // the ring's opening becomes a window onto photo 2 (blurred & dim → sharp & bright)
      const ln = Math.log(s);
      const hr = easeInOutSine(clamp((ln - Math.log(2)) / (Math.log(5) - Math.log(2))));
      if (hr > 0) {
        if (!layer1.classList.contains('is-piercing')) { layer1.classList.add('is-piercing'); layer2.style.opacity = '1'; }
        layer1.style.setProperty('--mx', (G.ring0.x + dx * pd).toFixed(1) + 'px');
        layer1.style.setProperty('--my', (G.ring0.y + dy * pd).toFixed(1) + 'px');
        layer1.style.setProperty('--rx', (HOLE.rx * G.a.w * s * .98 * hr).toFixed(1) + 'px');
        layer1.style.setProperty('--ry', (HOLE.ry * G.a.h * s * sy * .98 * hr).toFixed(1) + 'px');
        const q = easeInOutSine(clamp((ln - Math.log(2.5)) / (Math.log(G.sPass) - Math.log(2.5))));
        stage2.style.transform = `scale(${(1.2 - .2 * q).toFixed(4)})`;
        photo2.style.filter = `blur(${(12 * (1 - q)).toFixed(2)}px) brightness(${(.55 + .45 * q).toFixed(3)})`;
      }

      if (u >= 1) {
        layer1.style.transition = 'none'; layer1.style.opacity = '0'; layer1.classList.remove('is-piercing');
        stage2.style.transform = ''; photo2.style.filter = '';
        sequel(tk); return;
      }
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
  }

  /* ---------- pen enters, rests exactly 2 s, then writes ---------- */
  async function sequel(tk) {
    layer2.classList.add('is-final');
    placePen(G.vw * 1.04, G.vh * .56);
    const rest = { x: G.vw * .5, y: G.vh * .5 };
    await Promise.all([tween(600, (k) => { pen.style.opacity = String(k); }, tk), glidePen(rest, 1100, tk)]);
    if (!(await wait(PEN_PAUSE, tk))) return;
    await writeMessage(tk);
  }

  /* ---------- the pen writes the existing Arabic message ---------- */
  function buildMessage() {
    messageEl.textContent = '';
    const words = [];
    ARABIC_MESSAGE.forEach((line, i) => {
      const p = document.createElement('p');
      p.className = 'm-line' + (i === ARABIC_MESSAGE.length - 1 && /^[—–-]/.test(line.trim()) ? ' m-line--sign' : '');
      const parts = line.split(/\s+/).filter(Boolean);
      parts.forEach((wd, k) => {
        const s = document.createElement('span'); s.className = 'm-word'; s.textContent = wd;
        p.append(s); if (k < parts.length - 1) p.append(' ');
        words.push(s);
      });
      messageEl.append(p);
    });
    return words;
  }

  async function writeMessage(tk) {
    scrim.classList.add('is-on');
    const words = buildMessage();
    const start = (r) => ({ x: r.right, y: r.top + r.height * .7 });
    let prev = words[0].getBoundingClientRect();
    if (!(await glidePen(start(prev), 800, tk))) return;

    for (const w of words) {
      const r = w.getBoundingClientRect();
      const newLine = Math.abs(r.top - prev.top) > r.height * .5;
      if (w !== words[0] && !(await glidePen(start(r), newLine ? 420 : 90, tk))) return;
      const letters = w.textContent.replace(/[\u064B-\u0652\u0670]/g, '').length;   // revealed right-to-left, keeping Arabic joins intact
      const ok = await tween(Math.max(240, letters * 120), (k, now) => {
        const e = -14 + 114 * k;
        w.style.setProperty('--e', e.toFixed(2));
        placePen(r.right - r.width * clamp((e + 7) / 100) + Math.sin(now / 90) * 1.5, r.top + r.height * .7 + Math.sin(now / 45) * 3);
      }, tk);
      if (!ok) return;
      prev = r;
    }
    await wait(500, tk);
    await tween(700, (k) => { pen.style.opacity = String(1 - k); }, tk);   // pen fades away
    if (live(tk)) replayBtn.classList.add('is-on');
  }

  /* simplified, motion-free version for prefers-reduced-motion */
  async function playReduced(tk) {
    layer1.style.transition = 'opacity .8s ease';
    layer1.style.opacity = '1';
    if (!(await wait(2600, tk))) return;
    layer2.style.transition = 'opacity 1.4s ease';
    layer2.style.opacity = '1';
    layer2.classList.add('is-final');
    if (!(await wait(1800, tk))) return;
    scrim.classList.add('is-on');
    buildMessage().forEach((w) => w.style.setProperty('--e', '100'));
    if (!(await wait(1200, tk))) return;
    replayBtn.classList.add('is-on');
  }

  replayBtn.addEventListener('click', startScene);
  /* =========================================================
     4. FINALE — quiz done → envelope returns & seals → seal spins →
        black hole centred on the seal → 1 s of black → video
     ========================================================= */
  const finaleEl = $('#finale'), finaleVideo = $('#finaleVideo'), againBtn = $('#finaleAgain'), bh = $('#bh');
  const sealEl = $('.seal'), sealSvg = $('.seal__svg');
  const worldEls = [$('.ambient'), $('#app'), $('#fx'), $('#music')];   // everything that gets sucked in
  const worldApp = worldEls[1];
  const BH_SIZE = 700, BH_CLEAR = .22 * BH_SIZE / 2;                       // clear radius of the ring graphic (77 px at scale 1)
  let dotEl = null, finaleRun = 0, sealBias = { x: 0, y: 0 }, sealC = { x: 0, y: 0 };
  const fLive = (tk) => tk === finaleRun;
  const fwait = (ms, tk) => sleep(ms).then(() => fLive(tk));
  const ftween = (ms, fn, tk) => new Promise((res) => {
    const t0 = performance.now(); let l = t0;
    (function f(n) {
      if (!fLive(tk)) return res(false);
      const k = clamp((n - t0) / ms), dt = Math.max(0, (n - l) / 1000); l = n;
      fn(k, dt); k < 1 ? requestAnimationFrame(f) : res(true);
    })(t0);
  });
  const easeInCubic = (t) => t * t * t;

  // exact wax-seal centre, from layout (not from the animated pixels) so it survives resizes
  function sealChain() { let x = 0, y = 0, n = sealEl; while (n) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return { x, y }; }
  const sealCenter = () => { const c = sealChain(); return { x: c.x + sealBias.x, y: c.y + sealBias.y }; };
  function measureSeal() {
    const r = sealEl.getBoundingClientRect(), c = sealChain();
    sealBias = { x: r.left + r.width / 2 - c.x, y: r.top + r.height / 2 - c.y };
    sealC = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function setOrigins() {
    worldEls.forEach((e) => {
      const r = e.getBoundingClientRect(), t = e.style.transform; // music button is small: origin relative to its own box
      const left = e === worldEls[3] ? (e._l ?? (e._l = r.left)) : 0, top = e === worldEls[3] ? (e._t ?? (e._t = r.top)) : 0;
      e.style.transformOrigin = `${sealC.x - left}px ${sealC.y - top}px`;
    });
  }
  window.addEventListener('resize', () => {
    if (!document.body.classList.contains('bh-lock')) return;
    sealC = sealCenter(); setOrigins();
  });

  const lockScroll = (() => {
    const stop = (e) => e.preventDefault();
    return () => {
      document.body.classList.add('bh-lock');
      window.addEventListener('wheel', stop, { passive: false });
      window.addEventListener('touchmove', stop, { passive: false });
      window.addEventListener('keydown', (e) => { if ([' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) e.preventDefault(); });
    };
  })();

  function videoReady() {
    return new Promise((res) => {
      if (finaleVideo.readyState >= 3) return res();
      const done = () => { finaleVideo.removeEventListener('canplay', done); res(); };
      finaleVideo.addEventListener('canplay', done);
      finaleVideo.load();
      setTimeout(res, 8000);
    });
  }

  function startFinale() {
    const tk = ++finaleRun;
    lockScroll();
    const run = (RESPECT_REDUCED_MOTION && reduceMotion()) ? finaleReduced(tk) : runFinale(tk);
    run.catch((err) => { console.error('finale error, skipping to the video:', err); skipToVideo(tk); });   // never leave the visitor stuck
  }

  async function skipToVideo(tk) {
    document.body.classList.add('bh-black');
    worldEls.forEach((e) => { e.style.visibility = 'hidden'; });
    bh.style.opacity = '0';
    document.querySelectorAll('.bh-void, .bh-parts').forEach((n) => n.remove());
    finaleEl.classList.add('is-on');
    await Promise.all([sleep(1000), videoReady()]);
    if (fLive(tk)) await playFinaleVideo(tk);
  }

  async function bringEnvelopeBack(tk, fast) {
    // open envelope with the letter out, invisible, then fade it in centred
    envBtn.className = 'env-btn env-return is-opening flap-behind is-letter is-returning';
    showScreen('envelope');
    void envBtn.offsetWidth;
    envBtn.classList.remove('is-returning');                       // 1. envelope appears elegantly
    if (!(await fwait(fast ? 900 : 3300, tk))) return false;       // 2. stays visible briefly
    envBtn.classList.add('is-closing');
    envBtn.classList.remove('is-letter');                          // 3. letter slides back in
    if (!(await fwait(fast ? 300 : 1300, tk))) return false;
    envBtn.classList.add('seal-hold');
    envBtn.classList.remove('flap-behind', 'is-opening');          // 4. flap closes
    if (!(await fwait(fast ? 300 : 1300, tk))) return false;
    envBtn.classList.remove('seal-hold');                          // 5. seal stamps back on
    return fwait(fast ? 400 : 1000, tk);
  }

  async function runFinale(tk) {
    if (!(await bringEnvelopeBack(tk, false))) return;

    // ---- scene 2: camera focuses on the seal, seal spins faster and faster, light builds ----
    measureSeal(); sealC = sealCenter(); setOrigins();
    envBtn.classList.add('bh-on');
    const F = 1.7, sealR0 = sealEl.offsetWidth * .44;
    let ang = 0;
    const setBh = (k, op) => { bh.style.opacity = op.toFixed(3); bh.style.transform = `translate3d(${sealC.x - BH_SIZE / 2}px, ${sealC.y - BH_SIZE / 2}px, 0) scale(${Math.max(k, 0)})`; };
    const okC = await ftween(4200, (u, dt) => {
      ang += lerp(100, 1300, easeInCubic(u)) * dt;
      sealSvg.style.transform = `rotate(${ang}deg)`;
      const f = easeInOutSine(clamp(u / .75));
      worldApp.style.transform = `scale(${1 + (F - 1) * f})`;
      sealEl.style.filter = `drop-shadow(0 4px 5px rgba(60,10,24,.45)) drop-shadow(0 0 ${10 + 34 * u}px rgba(255,${Math.round(190 - 40 * u)},150,${(.35 + .6 * u).toFixed(2)}))`;
      setBh((sealR0 * F * 1.15 + 22 * u) / BH_CLEAR, .85 * easeInOutSine(clamp(u * 1.4)) * .6);
    }, tk);
    if (!okC) return;

    // ---- scene 3: black hole centred on the seal; the whole world spirals into it ----
    document.body.classList.add('bh-black');
    worldEls.forEach((e) => { e.style.willChange = 'transform'; });
    const vw = window.innerWidth, vh = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const voidEl = document.createElement('div'); voidEl.className = 'bh-void';
    const pc = document.createElement('canvas'); pc.className = 'bh-parts';
    pc.width = Math.round(vw * dpr); pc.height = Math.round(vh * dpr);
    dotEl = document.createElement('div'); dotEl.className = 'bh-dot';
    dotEl.style.transform = `translate3d(${sealC.x - 6}px, ${sealC.y - 6}px, 0)`;
    document.body.append(voidEl, pc, dotEl);
    const pctx = pc.getContext('2d'); pctx.setTransform(dpr, 0, 0, dpr, 0, 0); pctx.lineCap = 'round';
    const maxR = Math.hypot(Math.max(sealC.x, vw - sealC.x), Math.max(sealC.y, vh - sealC.y)) * 1.08;
    const parts = Array.from({ length: 180 }, () => ({
      a: Math.random() * 6.283, r: Math.pow(Math.random(), .55) * maxR + 40,
      d: Math.random() * .5, w: .8 + Math.random() * 1.9, gold: Math.random() < .5
    }));
    const layers = [
      { el: worldEls[1], d: 0,   base: F, rot: 0, ex: 2.0 },
      { el: worldEls[2], d: .04, base: 1, rot: 0, ex: 1.9 },
      { el: worldEls[3], d: .02, base: 1, rot: 0, ex: 1.9 },
      { el: worldEls[0], d: .08, base: 1, rot: 0, ex: 1.8 }
    ];
    const okD = await ftween(5600, (u, dt) => {
      ang += lerp(1300, 2800, u) * dt;
      sealSvg.style.transform = `rotate(${ang}deg)`;

      // the world shrinks & spirals into the seal (starts moving right away, collapses at the end)
      let pApp = 0;
      layers.forEach((L, i) => {
        const p = Math.pow(clamp((u - L.d) / (1 - L.d)), 1.8);
        if (i === 0) pApp = p;
        L.el.style.transform = `rotate(${(L.rot * Math.pow(p, 1.25)).toFixed(2)}deg) scale(${(L.base * Math.pow(1 - p, L.ex)).toFixed(5)})`;
        if (p > .45) L.el.style.filter = `blur(${((p - .45) * 5).toFixed(2)}px)`;
      });

      // darkness closes in from the screen edges toward the seal
      const R = maxR * Math.pow(1 - Math.pow(u, 1.5), 1.7);
      voidEl.style.background = u > .995 ? '#000'
        : `radial-gradient(circle at ${sealC.x}px ${sealC.y}px, transparent ${R.toFixed(0)}px, #000 ${(R + 170).toFixed(0)}px)`;

      // glowing light / sparks spiral inward
      pctx.clearRect(0, 0, vw, vh);
      const pos = (P, q) => { const rr = P.r * Math.pow(1 - q, 1.9), th = P.a + 1.1 * Math.pow(q, 1.35); return [sealC.x + rr * Math.cos(th), sealC.y + rr * Math.sin(th)]; };
      parts.forEach((P) => {
        const q = clamp((u - P.d) / (1 - P.d)); if (q <= 0 || q >= 1) return;
        const al = Math.min(1, q * 6) * (1 - Math.pow(q, 8)), a = pos(P, q), b = pos(P, Math.max(0, q - .05));
        pctx.strokeStyle = P.gold ? `rgba(255,218,165,${al.toFixed(2)})` : `rgba(255,150,178,${al.toFixed(2)})`;
        pctx.lineWidth = P.w * (1 + q);
        pctx.beginPath(); pctx.moveTo(b[0], b[1]); pctx.lineTo(a[0], a[1]); pctx.stroke();
      });

      dotEl.style.opacity = clamp((u - .8) / .17).toFixed(2);   // the last point of the world

      // glowing accretion ring hugging the seal, swelling then collapsing with it
      const sEnv = F * Math.pow(1 - pApp, 2.0);
      const k = (sealR0 * sEnv * 1.15 + 110 * Math.sin(Math.PI * clamp(u * 1.05))) / BH_CLEAR;
      setBh(k, .9 * clamp(1 - (u - .93) / .07));
    }, tk);
    voidEl.remove(); pc.remove();
    if (!okD) return;

    // ---- scene 4: only the glowing point remains; the ring of the video grows out of it ----
    worldEls.forEach((e) => { e.style.visibility = 'hidden'; });
    bh.style.opacity = '0';
    finaleEl.classList.add('is-on');
    await Promise.all([fwait(700, tk), videoReady()]);
    if (!fLive(tk)) return;
    await playFinaleVideo(tk, true);
  }

  // motion-free alternative: envelope returns, quick fade to black, video
  async function finaleReduced(tk) {
    if (!(await bringEnvelopeBack(tk, true))) return;
    document.body.classList.add('bh-black');
    worldEls.forEach((e) => { e.style.transition = 'opacity .8s ease'; e.style.opacity = '0'; });
    if (!(await fwait(900, tk))) return;
    finaleEl.classList.add('is-on');
    await Promise.all([fwait(1000, tk), videoReady()]);
    if (fLive(tk)) await playFinaleVideo(tk);
  }

  // ---- scene 5: the existing video, from its first frame, once ----
  const RING_IN_VIDEO = { x: .675, y: .396 };    // where the ring sits in the first frame of the video

  function ringOnScreen() {
    const W = window.innerWidth, H = window.innerHeight, vw0 = finaleVideo.videoWidth || 720, vh0 = finaleVideo.videoHeight || 1606;
    const contain = W / H >= .8;                  // same rule as the CSS (object-fit)
    const sc = contain ? Math.min(W / vw0, H / vh0) : Math.max(W / vw0, H / vh0);
    const w = vw0 * sc, h = vh0 * sc, ox = (W - w) / 2, oy = (H - h) / 2;
    return { x: ox + RING_IN_VIDEO.x * w, y: oy + RING_IN_VIDEO.y * h, w, h, W, H };
  }

  async function playFinaleVideo(tk, emerge = false) {
    againBtn.classList.remove('is-on');
    finaleVideo.currentTime = 0;
    finaleVideo.loop = false;
    Music.pause();                                   // the video carries its own sound
    finaleVideo.muted = false;
    const R = emerge ? ringOnScreen() : null;
    if (emerge) {
      finaleVideo.style.transition = 'none'; finaleVideo.style.opacity = '0';
      finaleVideo.style.transformOrigin = `${R.x}px ${R.y}px`;
    }
    try { await finaleVideo.play(); } catch (e) {
      finaleVideo.muted = true;                      // autoplay with sound blocked → play muted, tap to unmute
      try { await finaleVideo.play(); } catch (e2) { /* nothing more to try */ }
      finaleEl.addEventListener('pointerdown', () => { finaleVideo.muted = false; }, { once: true });
    }
    if (!emerge) { finaleVideo.classList.add('is-on'); return; }

    // the glowing point becomes the ring; the picture opens out of it
    const far = Math.max(Math.hypot(R.x, R.y), Math.hypot(R.W - R.x, R.y), Math.hypot(R.x, R.H - R.y), Math.hypot(R.W - R.x, R.H - R.y)) * 1.06;
    const r0 = .075 * R.w;
    await ftween(2400, (k) => {
      const e = easeInOutSine(k), s = lerp(.16, 1, e);
      const rad = lerp(r0, far, Math.pow(e, 1.15));
      finaleVideo.style.transform = `translate3d(${((sealC.x - R.x) * (1 - e)).toFixed(1)}px, ${((sealC.y - R.y) * (1 - e)).toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
      finaleVideo.style.clipPath = `circle(${rad.toFixed(1)}px at ${R.x}px ${R.y}px)`;
      finaleVideo.style.opacity = clamp(k / .18).toFixed(2);
      if (dotEl) dotEl.style.opacity = (1 - clamp(k / .35)).toFixed(2);
    }, tk);
    if (!fLive(tk)) return;
    finaleVideo.classList.add('is-on');
    ['transform', 'transformOrigin', 'clipPath', 'opacity', 'transition'].forEach((p) => { finaleVideo.style[p] = ''; });
    if (dotEl) { dotEl.remove(); dotEl = null; }
  }
  finaleVideo.addEventListener('ended', () => againBtn.classList.add('is-on'));   // stays on the last frame, never restarts by itself
  againBtn.addEventListener('click', () => { againBtn.classList.remove('is-on'); playFinaleVideo(finaleRun); });

  // quick test: open index.html#finale to jump straight to the sequence
  if (location.hash === '#finale') window.addEventListener('load', () => { opened = true; startFinale(); });
})();
