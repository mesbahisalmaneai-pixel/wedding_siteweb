/* =====================================================================
   CINEMATIC FINALE PATCH for script.js   (3 small edits)
   Quiz, video, scene, music, envelope-opening: untouched.
   ===================================================================== */


/* ─────────────────────────────────────────────────────────────────────
   EDIT 1 — inside the `fx` IIFE (FX CANVAS section): let hearts & dust
   feel the seal's gravity.
   ───────────────────────────────────────────────────────────────────── */

// 1a) next to `let rim = null;` add:
let pull = null;

// 1b) change the refill line to:
//       while (mood !== 'scene' && !pull && ambient.length < count()) ambient.push(make(ambient.length < count() * .8));

// 1c) in the ambient loop, right after
//       p.y -= p.vy * dt; p.ph += dt * .8;
//     add:
if (pull) {
  const gx = pull.x - p.x, gy = pull.y - p.y, gd = Math.hypot(gx, gy) || 1;
  const f = pull.k * dt * 520 / (1 + gd / 240);
  p.x += gx / gd * f; p.y += gy / gd * f;
  if (gd < 16) { ambient.splice(i, 1); continue; }
}

// 1d) in the returned object at the bottom of `fx`, add:
//       setPull: (v) => { pull = v; },


/* ─────────────────────────────────────────────────────────────────────
   EDIT 2 — in section "4. FINALE": DELETE the old `bringEnvelopeBack`
   and `runFinale` functions and paste ALL of the code below in their place
   (keep skipToVideo, finaleReduced, playFinaleVideo exactly as they are).
   ───────────────────────────────────────────────────────────────────── */

  /* ---------- envelope: extra depth, golden light, flap shadow ---------- */
  function decorateEnvelope() {
    const fl = $('.env-float', envBtn), ev = $('.env', envBtn);
    if (!$('.env-light', fl)) fl.append(el('span', 'env-light'));
    if (!$('.flap-shadow', ev)) ev.append(el('span', 'flap-shadow'));
  }

  async function bringEnvelopeBack(tk, fast) {
    decorateEnvelope();
    // open envelope, letter out, invisible → it drifts in and the light blooms
    envBtn.className = 'env-btn env-return is-opening flap-behind is-letter is-returning';
    showScreen('envelope');
    void envBtn.offsetWidth;
    envBtn.classList.remove('is-returning');
    envBtn.classList.add('lit');
    if (!(await fwait(fast ? 900 : 3300, tk))) return false;

    envBtn.classList.add('is-closing');
    envBtn.classList.remove('is-letter');                           // letter slides back inside
    if (!(await fwait(fast ? 300 : 1500, tk))) return false;

    envBtn.classList.add('seal-hold', 'shut');
    envBtn.classList.remove('flap-behind', 'is-opening');           // flap folds down, casting a soft shadow
    if (!(await fwait(fast ? 300 : 1500, tk))) return false;

    envBtn.classList.remove('seal-hold');
    envBtn.classList.add('stamp', 'sheen');                         // wax is pressed on, light sweeps across
    measureSeal(); fx.spark(sealC.x, sealC.y, fast ? 8 : 30, 1.1);
    return fwait(fast ? 400 : 1800, tk);
  }

  /* ---------- WebGL layer: accretion disk, lensed photon ring, ripples,
                 and the darkness that folds toward the seal ---------- */
  const BH_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uC; uniform float uT, uS, uV, uSw, uD, uR;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h(i), h(i + vec2(1., 0.)), f.x), mix(h(i + vec2(0., 1.)), h(i + vec2(1., 1.)), f.x), f.y); }
void main(){
  vec2 p = gl_FragCoord.xy - uC;
  float d = length(p), a = atan(p.y, p.x), r = d / uS;
  float sp = a - uSw * log(max(r, .25)) - uT * 1.7;                    // logarithmic spiral coordinate
  float streak = n(vec2(sp * 3., r * 2.2 - uT * .9)) * .6 + n(vec2(sp * 8., r * 5.5 - uT * .4)) * .4;
  float disk = smoothstep(1.08, 1.35, r) * exp(-pow((r - 1.75) / .95, 2.));
  vec3 hot = mix(vec3(1., .5, .36), vec3(1., .92, .72), exp(-(r - 1.) * 1.5));
  vec3 col = hot * disk * (.2 + 1.15 * streak) * uD;
  col += vec3(1., .86, .62) * exp(-pow((r - 1.13) / .05, 2.)) * 1.1 * uD;          // lensed photon ring
  col += vec3(.9, .34, .5) * exp(-r * .32) * .2 * uD * smoothstep(1., 1.5, r);    // halo
  float rp = fract(uT * .65);                                                      // gravity ripples leaving the seal
  col += vec3(1., .8, .55) * exp(-pow((d - uS * (1.3 + rp * 7.)) / (uS * .13), 2.)) * (1. - rp) * .55 * uR;
  float wob = 1. + .09 * sin(a * 2. - uT * 1.3 + uSw * 3.) + .05 * sin(a * 5. + uT * 2.);
  float Rv = uV * wob, soft = uV * .3 + 30.;
  float dark = smoothstep(Rv - soft, Rv, d);                                       // the world folds in from the edges
  col += vec3(1., .55, .42) * exp(-pow((d - Rv + soft * .4) / (soft * .35), 2.)) * .32 * step(.5, uV);
  gl_FragColor = vec4(col * (1. - dark), dark);                                    // premultiplied
}`;

  function makeGL(vw, vh, dpr) {
    try {
      const cv = document.createElement('canvas'); cv.className = 'bh-gl';
      cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
      const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' });
      if (!gl) return null;
      const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
      const vs = mk(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'), fs = mk(gl.FRAGMENT_SHADER, BH_FRAG);
      if (!vs || !fs) return null;
      const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
      gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const U = {}; ['uC', 'uT', 'uS', 'uV', 'uSw', 'uD', 'uR'].forEach((k) => { U[k] = gl.getUniformLocation(pr, k); });
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.viewport(0, 0, cv.width, cv.height);
      return {
        cv,
        draw(o) {
          gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
          gl.uniform2f(U.uC, o.cx, o.cy); gl.uniform1f(U.uT, o.T); gl.uniform1f(U.uS, Math.max(o.S, 2));
          gl.uniform1f(U.uV, o.V); gl.uniform1f(U.uSw, o.Sw); gl.uniform1f(U.uD, o.D); gl.uniform1f(U.uR, o.R);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        },
        kill() { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); cv.remove(); }
      };
    } catch (e) { return null; }
  }

  /* ---------- optional real screen warp (SVG displacement, desktop Chrome/Firefox only).
                 A pair of gradients centred on the seal pinches the page toward it. ---------- */
  function makeWarp(vw, vh) {
    const ua = navigator.userAgent;
    if (!matchMedia('(pointer: fine)').matches || /Android|Mobile|iPhone|iPad/i.test(ua) || !/Chrome|Firefox/.test(ua) || reduceMotion()) return null;
    try {
      const g = (a, c) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><defs><linearGradient id="g" ${a}><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/></svg>`);
      const box = document.createElement('div'); box.setAttribute('aria-hidden', 'true');
      box.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden;pointer-events:none';
      const im = (href, res) => `<feImage href="${href}" x="${sealC.x - vw}" y="${sealC.y - vh}" width="${vw * 2}" height="${vh * 2}" preserveAspectRatio="none" result="${res}"/>`;
      box.innerHTML = `<svg width="0" height="0"><filter id="bhWarp" filterUnits="userSpaceOnUse" x="0" y="0" width="${vw}" height="${vh}" color-interpolation-filters="sRGB">`
        + im(g('x1="0" y1="0" x2="1" y2="0"', '#f00'), 'mx') + im(g('x1="0" y1="0" x2="0" y2="1"', '#0f0'), 'my')
        + `<feBlend in="mx" in2="my" mode="screen" result="map"/><feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter></svg>`;
      document.body.append(box);
      const dm = box.querySelector('feDisplacementMap');
      return { set(s) { dm.setAttribute('scale', s.toFixed(1)); }, kill() { box.remove(); } };
    } catch (e) { return null; }
  }

  async function runFinale(tk) {
    // ── 1. envelope returns, flap closes, seal is stamped ──
    if (!(await bringEnvelopeBack(tk, false))) return;

    measureSeal(); sealC = sealCenter(); setOrigins();   // exact seal centre (layout-based, survives any screen size)
    envBtn.classList.add('bh-on');
    const vw = window.innerWidth, vh = window.innerHeight, small = Math.min(vw, vh) < 700;
    const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.5);
    const gl = makeGL(vw, vh, dpr); if (gl) document.body.append(gl.cv);
    const warp = makeWarp(vw, vh);
    const F = 1.7, sealR0 = sealEl.offsetWidth * .44;
    const maxR = Math.hypot(Math.max(sealC.x, vw - sealC.x), Math.max(sealC.y, vh - sealC.y)) * 1.08;
    let ang = 0, T = 0;
    const draw = (S, V, Sw, D, R) => { if (gl) gl.draw({ cx: sealC.x * dpr, cy: (vh - sealC.y) * dpr, T, S: S * dpr, V: V * dpr, Sw, D, R }); };

    // ── 2. seal wakes: slow turn → faster, golden glow, surroundings start to react ──
    const okB = await ftween(4800, (u, dt) => {
      T += dt;
      ang += lerp(22, 760, Math.pow(u, 2.3)) * dt;
      sealSvg.style.transform = `rotate(${ang}deg)`;
      const s = 1 + (F - 1) * easeInOutSine(clamp(u / .8));
      worldApp.style.transform = `scale(${s.toFixed(4)}) rotate(${(Math.sin(T * 11) * .28 * u * u).toFixed(3)}deg)`;   // faint tremor
      sealEl.style.filter = `drop-shadow(0 4px 5px rgba(60,10,24,.45)) drop-shadow(0 0 ${(8 + 40 * u).toFixed(0)}px rgba(255,${Math.round(200 - 50 * u)},150,${(.3 + .65 * u).toFixed(2)}))`;
      fx.setPull({ x: sealC.x, y: sealC.y, k: u * .9 });                       // hearts & dust drift toward it
      draw(sealR0 * s, maxR * 3, 1.5, .85 * easeInOutSine(clamp((u - .2) / .8)), easeInOutSine(clamp((u - .1) / .9)));
    }, tk);
    if (!okB) { if (gl) gl.kill(); if (warp) warp.kill(); return; }

    // ── 3. black hole: background bends first, then everything spirals in ──
    document.body.classList.add('bh-black');
    worldEls.forEach((e) => { e.style.willChange = 'transform'; });
    const dc = Math.min(window.devicePixelRatio || 1, 1.5);
    const voidEl = document.createElement('div'); voidEl.className = 'bh-void';
    const pc = document.createElement('canvas'); pc.className = 'bh-parts';
    pc.width = Math.round(vw * dc); pc.height = Math.round(vh * dc);
    dotEl = document.createElement('div'); dotEl.className = 'bh-dot';
    dotEl.style.transform = `translate3d(${sealC.x - 6}px, ${sealC.y - 6}px, 0)`;
    document.body.append(voidEl, pc, dotEl);
    const pctx = pc.getContext('2d'); pctx.setTransform(dc, 0, 0, dc, 0, 0); pctx.lineCap = 'round';
    const parts = Array.from({ length: small ? 110 : 190 }, () => ({
      a: Math.random() * 6.283, r: Math.pow(Math.random(), .55) * maxR + 40,
      d: Math.random() * .5, w: .8 + Math.random() * 1.9, gold: Math.random() < .5
    }));
    const layers = [
      { el: worldEls[0], d: 0,   base: 1, rot: 300, tilt: 0,  ex: 1.7 },   // background bends first
      { el: worldEls[3], d: .12, base: 1, rot: 900, tilt: 0,  ex: 1.9 },
      { el: worldEls[1], d: .16, base: F, rot: 620, tilt: 34, ex: 2.0 },   // envelope + whole UI, funnel perspective
      { el: worldEls[2], d: .2,  base: 1, rot: 760, tilt: 0,  ex: 1.9 }
    ];
    const okC = await ftween(6400, (u, dt) => {
      T += dt;
      ang += lerp(760, 2900, easeInCubic(u)) * dt;
      sealSvg.style.transform = `rotate(${ang}deg)`;
      fx.setPull({ x: sealC.x, y: sealC.y, k: 1.4 });

      let pApp = 0;
      layers.forEach((L, i) => {
        const p = Math.pow(clamp((u - L.d) / (1 - L.d)), 1.9);
        if (i === 2) pApp = p;
        L.el.style.transform = `perspective(1100px) rotateX(${(L.tilt * p).toFixed(2)}deg) rotate(${(L.rot * Math.pow(p, 1.25)).toFixed(2)}deg) scale(${(L.base * Math.pow(1 - p, L.ex)).toFixed(5)})`;
        const blur = p > .5 ? ((p - .5) * 7).toFixed(2) : 0;
        L.el.style.filter = (i === 2 && warp ? 'url(#bhWarp) ' : '') + (blur ? `blur(${blur}px)` : '');
      });
      if (warp) warp.set(vw * 1.1 * easeInOutSine(clamp(u / .75)));          // screen pinches toward the seal

      const V = maxR * 1.7 * Math.pow(1 - clamp((u - .12) / .88), 1.55);       // darkness folding in
      const sEnv = F * Math.pow(1 - pApp, 2.0);
      const S = Math.max(sealR0 * sEnv, 5), floor = 4 + 56 * Math.sin(Math.PI * clamp(u));
      const D = (.85 + .4 * Math.sin(Math.PI * clamp(u * 1.05))) * (1 - clamp((u - .9) / .1));
      if (gl) draw(Math.max(S, floor), V, 2 + 6 * u, D, clamp(1 - u * 1.2));
      else voidEl.style.background = u > .995 ? '#000'
        : `radial-gradient(circle at ${sealC.x}px ${sealC.y}px, transparent ${V.toFixed(0)}px, #000 ${(V + 170).toFixed(0)}px)`;

      pctx.clearRect(0, 0, vw, vh);                                            // light streaks spiralling inward
      const pos = (P, q) => { const rr = P.r * Math.pow(1 - q, 1.9), th = P.a + 1.1 * Math.pow(q, 1.35); return [sealC.x + rr * Math.cos(th), sealC.y + rr * Math.sin(th)]; };
      parts.forEach((P) => {
        const q = clamp((u - P.d) / (1 - P.d)); if (q <= 0 || q >= 1) return;
        const al = Math.min(1, q * 6) * (1 - Math.pow(q, 8)), a = pos(P, q), b = pos(P, Math.max(0, q - .05));
        pctx.strokeStyle = P.gold ? `rgba(255,218,165,${al.toFixed(2)})` : `rgba(255,150,178,${al.toFixed(2)})`;
        pctx.lineWidth = P.w * (1 + q);
        pctx.beginPath(); pctx.moveTo(b[0], b[1]); pctx.lineTo(a[0], a[1]); pctx.stroke();
      });

      dotEl.style.opacity = clamp((u - .78) / .18).toFixed(2);                 // the seal becomes a point of light
      dotEl.style.transform = `translate3d(${sealC.x - 6}px, ${sealC.y - 6}px, 0) scale(${(1 - .55 * clamp((u - .9) / .1)).toFixed(3)})`;
    }, tk);
    voidEl.remove(); pc.remove(); fx.setPull(null);
    if (warp) warp.kill();
    if (!okC) { if (gl) gl.kill(); return; }

    // ── 4. the point of light goes out → pure black for ~1 s → video ──
    worldEls.forEach((e) => { e.style.visibility = 'hidden'; e.style.filter = ''; });
    bh.style.opacity = '0';
    if (gl) gl.kill();
    finaleEl.classList.add('is-on');
    dotEl.style.transition = 'opacity .55s ease'; dotEl.style.opacity = '0';
    if (!(await fwait(600, tk))) return;
    dotEl.remove(); dotEl = null;
    await Promise.all([fwait(1000, tk), videoReady()]);                         // completely black, nothing else on screen
    if (!fLive(tk)) return;
    await playFinaleVideo(tk);                                                  // your video, unchanged
  }


/* ─────────────────────────────────────────────────────────────────────
   EDIT 3 — none. index.html and the video code stay exactly as they are.
   (The old "emerge from the glowing point" is no longer used, because the
   brief asks for a fully black screen first. To bring it back, change the
   last line to:  await playFinaleVideo(tk, true);  and don't remove dotEl
   in step 4.)
   ───────────────────────────────────────────────────────────────────── */
