import { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRafLoop } from '../../hooks/useRafLoop';
import { CHALK, type ChalkPalette } from '../../lib/scene/chalk';
import { drift } from '../../lib/scene/noise';
import { projectBlur, projectScale } from '../../lib/scene/projection';
import { attachPointer, getPointer, stepPointer } from '../../lib/scene/pointer';
import { getSceneParams } from '../../lib/scene/store';

/**
 * Fundo da landing page: o quadro-negro animado de Ciência de Dados
 * (`data-science-quadro.html`), portado do HTML avulso para um componente React.
 *
 * Melhorias em relação ao arquivo original:
 *  - remove barras de controle, dica e o título animado "Data Science";
 *  - sem interações (arrastar/clicar) — é pano de fundo, não peça interativa;
 *  - uma paleta só: o quadro é giz aceso sobre ardósia, como a cena 3D;
 *  - sem o filtro `feTurbulence` (caro) — o grão fica no CSS, estático;
 *  - respeita `prefers-reduced-motion` (congela a animação, sem esconder o quadro).
 *
 * O motor de cena é compartilhado com o projeto `educa-data`: `useRafLoop` (um
 * único loop, com teto de FPS e pausa com a aba oculta), `scene/noise` (deriva
 * orgânica), `scene/projection` (profundidade) e `scene/pointer` (paralaxe).
 */

const NS = 'http://www.w3.org/2000/svg';

interface Floater {
  g: SVGElement;
  amp: number;
  f: number;
  p: number;
  seed: number;
  r: number;
}

type AttrMap = Record<string, string | number>;

/**
 * Constrói todas as cenas dentro de `svg` e devolve `advance(dt)`, que avança a
 * cena em um passo. O loop de animação vive no componente, via `useRafLoop`.
 */
function build(svg: SVGSVGElement, C: ChalkPalette): { advance: (dt: number) => void } {
  const sin = Math.sin;
  const cos = Math.cos;
  const PI = Math.PI;
  const exp = Math.exp;
  const abs = Math.abs;
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);

  function E(tag: string, attrs?: AttrMap, parent?: SVGElement): SVGElement {
    const e = document.createElementNS(NS, tag) as SVGElement;
    if (attrs) for (const k in attrs) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }
  function G(parent?: SVGElement): SVGGElement {
    return E('g', {}, parent || svg) as SVGGElement;
  }

  // texto com _{sub} e ^{sup}
  function M(
    p: SVGElement,
    x: number,
    y: number,
    s: number,
    str: string,
    fill?: string,
    o?: { a?: string },
  ): SVGTextElement {
    o = o || {};
    const t = E(
      'text',
      { x, y, 'font-size': s, fill: fill || C.chalk, 'text-anchor': o.a || 'start' },
      p,
    ) as SVGTextElement;
    t.style.whiteSpace = 'pre';
    let pend = 0;
    const re = /([_^])\{([^}]*)\}|([^_^]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(str))) {
      const sp = E('tspan', {}, t);
      if (m[1]) {
        const d = m[1] === '_' ? 0.28 * s : -0.42 * s;
        sp.setAttribute('dy', String(d + pend));
        sp.setAttribute('font-size', String(s * 0.68));
        sp.textContent = m[2];
        pend = -d;
      } else {
        sp.textContent = m[3];
        if (pend) {
          sp.setAttribute('dy', String(pend));
          pend = 0;
        }
      }
    }
    return t;
  }

  const tw = (str: string, s: number) => str.replace(/[_^]\{|\}/g, '').length * s * 0.48;

  function frac(p: SVGElement, x: number, y: number, num: string, den: string, s: number, fill?: string) {
    const w = Math.max(tw(num, s), tw(den, s)) + 8;
    M(p, x, y - 0.2 * s, s, num, fill, { a: 'middle' });
    E('line', { x1: x - w / 2, x2: x + w / 2, y1: y, y2: y, stroke: fill || C.chalk, 'stroke-width': 1.8, 'stroke-linecap': 'round' }, p);
    M(p, x, y + 0.82 * s, s, den, fill, { a: 'middle' });
    return w;
  }

  function xbar(p: SVGElement, x: number, y: number, s: number, fill?: string) {
    M(p, x, y, s, 'x', fill);
    E('line', { x1: x + 0.02 * s, x2: x + 0.5 * s, y1: y - 0.68 * s, y2: y - 0.7 * s, stroke: fill || C.chalk, 'stroke-width': 1.6, 'stroke-linecap': 'round' }, p);
  }

  function stroke(el: SVGElement, c: string, w?: number): SVGElement {
    el.setAttribute('stroke', c);
    el.setAttribute('stroke-width', String(w || 2.2));
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    return el;
  }

  // ---------- estado ----------
  const updaters: Array<(t: number) => void> = [];
  const floaters: Floater[] = [];
  let T = 0;
  let playing = true;
  const reduce =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) playing = false;

  function float(g: SVGGElement, amp?: number) {
    const base = amp || 3;
    // Profundidade: cada peça recebe um "z"; quanto mais perto da câmera,
    // maior a deriva — e as que ficam fora de foco ganham um leve desfoque.
    const z = rnd(-220, 220);
    const scale = projectScale(z);
    const blur = projectBlur(z, 0, 0.012, 4);
    if (blur > 0.35) g.style.filter = 'blur(' + blur.toFixed(2) + 'px)';
    floaters.push({
      g,
      amp: base * scale,
      f: rnd(0.4, 1),
      p: rnd(0, 6.28),
      seed: rnd(0, 100),
      r: rnd(-1.6, 1.6),
    });
    g.style.setProperty('transform-box', 'fill-box');
    g.style.transformOrigin = 'center';
    return g;
  }

  function prog(t: number, start: number, dur: number, period: number) {
    const l = t % period;
    const a = clamp((l - start) / dur, 0, 1);
    const f = 1 - clamp((l - (period - 0.7)) / 0.7, 0, 1);
    return { a, f };
  }

  function drawIn(path: SVGElement, pr: { a: number; f: number }) {
    path.setAttribute('pathLength', '1');
    path.setAttribute('stroke-dasharray', '1');
    path.setAttribute('stroke-dashoffset', String(1 - pr.a));
    path.setAttribute('opacity', String(pr.f));
  }

  // ---------- defs ----------
  const defs = E('defs', {}, svg);
  const glow = E('radialGradient', { id: 'glowBoard', cx: '50%', cy: '50%', r: '70%' }, defs);
  E('stop', { offset: '0', 'stop-color': C.board0 }, glow);
  E('stop', { offset: '1', 'stop-color': C.board1 }, glow);
  const bulbGlow = E('radialGradient', { id: 'bulbGlow' }, defs);
  E('stop', { offset: '0', 'stop-color': C.bulb, 'stop-opacity': '.55' }, bulbGlow);
  E('stop', { offset: '1', 'stop-color': C.bulb, 'stop-opacity': '0' }, bulbGlow);
  const hatch = E('pattern', { id: 'hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  stroke(E('line', { x1: 0, y1: 0, x2: 0, y2: 6 }, hatch), C.yellow, 2.2);
  const clipA = E('clipPath', { id: 'clipA' }, defs);
  const clipc = E('circle', { cx: 62, cy: 207, r: 40 }, clipA);
  // ardósia (cobre todo o viewBox ampliado, para não sobrar borda vazia)
  E('rect', { x: -270, y: -153, width: 1620, height: 917, fill: 'url(#glowBoard)' }, svg);

  // ---------- 1. Árvore de probabilidade ----------
  {
    const g = G();
    const l = (
      [
        ['M93 40 L52 60', 0],
        ['M117 40 L150 60', 0.5],
        ['M38 84 L32 98', 1.2],
        ['M52 84 L66 100', 1.5],
        ['M153 84 L150 98', 1.8],
        ['M166 82 L178 98', 2.1],
      ] as [string, number][]
    ).map((a) => {
      const p = stroke(E('path', { d: a[0], fill: 'none' }, g), C.chalk, 2);
      return { p, d: a[1] };
    });
    const el = stroke(E('ellipse', { cx: 105, cy: 25, rx: 26, ry: 17, fill: 'none' }, g), C.chalk, 2.2);
    M(g, 105, 31, 19, 'P(A)', C.chalk, { a: 'middle' });
    const nb = stroke(E('circle', { cx: 42, cy: 70, r: 15, fill: 'none' }, g), C.chalk, 2.2);
    M(g, 42, 76, 19, 'B', C.chalk, { a: 'middle' });
    const nc = stroke(E('circle', { cx: 160, cy: 70, r: 15, fill: 'none' }, g), C.chalk, 2.2);
    M(g, 160, 76, 19, 'B', C.chalk, { a: 'middle' });
    E('line', { x1: 153, x2: 167, y1: 59, y2: 59, stroke: C.chalk, 'stroke-width': 1.8 }, g);
    const t1 = M(g, 62, 118, 17, 'P(B|A)');
    const t2 = M(g, 138, 118, 17, 'P(B̄|A)');
    const kick = -99;
    updaters.push((t) => {
      l.forEach((o) => drawIn(o.p, prog(t, o.d, 0.8, 9)));
      const k = clamp(1 - (t - kick) / 1, 0, 1);
      const s = 1 + 0.08 * sin(t * 2.2) + 0.25 * k * sin(k * 14);
      [nb, nc, el].forEach((n) => {
        n.style.setProperty('transform-box', 'fill-box');
        n.style.transformOrigin = 'center';
        n.style.transform = 'scale(' + s + ')';
      });
    });
    float(t1, 1.5);
    float(t2, 1.5);
  }

  // ---------- 2. Histograma + curva normal ----------
  {
    const g = G();
    const x0 = 225;
    const x1 = 402;
    const yb = 150;
    const top = 22;
    const N = 11;
    const bw = (x1 - x0 - 12) / N;
    const bars: SVGElement[] = [];
    for (let i = 0; i < N; i++) {
      bars.push(stroke(E('rect', { x: x0 + 6 + i * bw, width: bw - 2, fill: '#2a8fd0', 'fill-opacity': 0.75 }, g), '#bfe9ff', 1.4));
    }
    const curve = stroke(E('path', { fill: 'none' }, g), C.red, 3);
    stroke(E('path', { d: 'M' + x0 + ' ' + top + 'V' + yb + 'H' + (x1 + 6), fill: 'none' }, g), C.chalk, 2);
    E('path', { d: 'M' + (x1 + 1) + ' ' + (yb - 4) + 'L' + (x1 + 7) + ' ' + yb + 'L' + (x1 + 1) + ' ' + (yb + 4), fill: 'none', stroke: C.chalk, 'stroke-width': 2 }, g);
    const lab = M(g, x0 + 2, 168, 14, '', C.cyan);
    let mu = 0.5;
    let sig = 0.17;
    const H = yb - top - 6;
    const pdf = (u: number) => Math.min(H, H * 0.95 * (0.17 / sig) * exp(-0.5 * ((u - mu) / sig) ** 2));
    updaters.push((t) => {
      // A curva do quadro espelha os sliders do laboratório Normal: o conteúdo
      // (μ/σ em gramas) é a fonte; a animação é o reflexo.
      const params = getSceneParams();
      const muTarget = 0.5 + clamp((params.mu - 3250) / 750, -1, 1) * 0.22 + 0.02 * sin(t * 0.6);
      const sigTarget =
        clamp(0.08 + ((params.sigma - 100) / 700) * 0.24, 0.07, 0.34) + 0.012 * sin(t * 0.9 + 1);
      mu += (muTarget - mu) * 0.12;
      sig += (sigTarget - sig) * 0.12;
      bars.forEach((b, i) => {
        const u = (i + 0.5) / N;
        const hh = Math.max(2, pdf(u) * (1 + 0.1 * sin(t * 3 + i * 1.7)));
        b.setAttribute('y', String(yb - hh));
        b.setAttribute('height', String(hh));
      });
      let d = '';
      for (let k = 0; k <= 60; k++) {
        const u = k / 60;
        d += (k ? 'L' : 'M') + (x0 + u * (x1 - x0)).toFixed(1) + ' ' + (yb - pdf(u)).toFixed(1);
      }
      curve.setAttribute('d', d);
      lab.textContent = 'μ = ' + Math.round(params.mu) + ' g   σ = ' + Math.round(params.sigma) + ' g';
    });
  }

  // ---------- 3. Fórmulas junto ao histograma ----------
  {
    const g1 = G();
    M(g1, 345, 52, 22, 'f(x) =', C.chalk);
    frac(g1, 425, 45, '1', 'σ√2π', 21);
    M(g1, 455, 52, 26, 'e');
    M(g1, 470, 34, 13, '−(x−μ)²');
    E('line', { x1: 470, x2: 520, y1: 39, y2: 39, stroke: C.chalk, 'stroke-width': 1.5 }, g1);
    M(g1, 483, 52, 13, '2σ²');
    g1.querySelectorAll('text').forEach((t) => t.setAttribute('fill', C.chalk));
    float(g1, 3);
    const g2 = G();
    M(g2, 410, 118, 24, 'Z =', C.yellow);
    frac(g2, 478, 112, 'X − μ', 'σ', 24, C.yellow);
    float(g2, 3);
  }

  // ---------- 4. Dispersão + regressão ----------
  {
    interface Pt {
      u: number;
      dev: number;
      v: number;
      ph: number;
      c: SVGElement;
      fixed: boolean;
      age: number;
      cv: number;
      cu: number;
    }
    const g = G();
    const ax = 578;
    const axr = 752;
    const ay = 28;
    const ab = 148;
    stroke(E('path', { d: 'M' + ax + ' ' + ay + 'V' + ab + 'H' + axr, fill: 'none' }, g), C.chalk, 2);
    E('path', { d: 'M' + (axr - 6) + ' ' + (ab - 4) + 'L' + axr + ' ' + ab + 'L' + (axr - 6) + ' ' + (ab + 4), fill: 'none', stroke: C.chalk, 'stroke-width': 2 }, g);
    E('path', { d: 'M' + (ax - 4) + ' ' + (ay + 6) + 'L' + ax + ' ' + ay + 'L' + (ax + 4) + ' ' + (ay + 6), fill: 'none', stroke: C.chalk, 'stroke-width': 2 }, g);
    const pts: Pt[] = [];
    const X = (u: number) => ax + 10 + u * (axr - ax - 24);
    const Y = (v: number) => ab - 10 - v * (ab - ay - 24);
    function add(u: number, v: number, fixed: boolean) {
      const c = E('circle', { r: 6, fill: '#38b8e8' }, g);
      pts.push({ u, dev: v - (0.12 + 0.75 * u), v, ph: rnd(0, 6.28), c, fixed, age: 0, cv: 0, cu: 0 });
    }
    for (let i = 0; i < 34; i++) {
      const u = rnd(0.02, 0.98);
      add(u, clamp(0.12 + 0.75 * u + rnd(-0.17, 0.17), 0.02, 0.98), false);
    }
    const line = stroke(E('line', {}, g), C.yellow, 3);
    const lab = M(g, ax + 4, 166, 14, '', C.yellow);
    updaters.push((t) => {
      const k = 0.45 + 0.9 * (0.5 + 0.5 * sin(t * 0.35));
      let sx = 0;
      let sy = 0;
      const n = pts.length;
      pts.forEach((q) => {
        q.age += 0.03;
        q.cv = q.fixed ? q.v : clamp(0.12 + 0.75 * q.u + q.dev * k, 0, 1);
        q.cv = q.cv + 0.012 * sin(t * 1.3 + q.ph);
        q.cu = q.u + 0.008 * cos(t * 1.1 + q.ph);
        sx += q.cu;
        sy += q.cv;
        q.c.setAttribute('cx', String(X(q.cu)));
        q.c.setAttribute('cy', String(Y(q.cv)));
        q.c.setAttribute('r', String(2.8 + 3.2 * Math.max(0, 1 - q.age * (q.fixed ? 1.2 : 0.4))));
      });
      const mx = sx / n;
      const my = sy / n;
      let sxy = 0;
      let sxx = 0;
      let syy = 0;
      pts.forEach((q) => {
        sxy += (q.cu - mx) * (q.cv - my);
        sxx += (q.cu - mx) ** 2;
        syy += (q.cv - my) ** 2;
      });
      const b1 = sxy / sxx;
      const b0 = my - b1 * mx;
      const r2 = syy ? (sxy * sxy) / (sxx * syy) : 0;
      line.setAttribute('x1', String(X(0)));
      line.setAttribute('x2', String(X(1)));
      line.setAttribute('y1', String(Y(b0)));
      line.setAttribute('y2', String(Y(b0 + b1)));
      lab.textContent = 'ŷ = ' + b0.toFixed(2) + ' + ' + b1.toFixed(2) + 'x    R² = ' + r2.toFixed(2);
    });
    const g2 = G();
    M(g2, 636, 30, 22, 'ŷ = β_{0} + β_{1}x', C.chalk);
    float(g2, 2);
    const g3 = G();
    M(g3, 612, 192, 21, 'R² = 1 −', C.chalk);
    frac(g3, 718, 185, 'Σ(y_{i} − ŷ_{i})²', 'Σ(y_{i} − ȳ)²', 17, C.chalk);
    float(g3, 2);
  }

  // ---------- 5. Pizza ----------
  {
    interface Slice {
      p: SVGElement;
      t: SVGTextElement;
      ex: number;
    }
    const g = G();
    const cx = 843;
    const cy = 66;
    const R = 64;
    const cols = [C.cyan, C.yellow, C.pink, C.blue];
    const base = [0.3, 0.2, 0.22, 0.28];
    const sl: Slice[] = cols.map((c) => {
      const p = E('path', { fill: c, 'fill-opacity': 0.88 }, g);
      stroke(p, C.chalk, 2.4);
      const t = M(g, 0, 0, 13, '', C.chalk, { a: 'middle' });
      return { p, t, ex: 0 };
    });
    updaters.push((t) => {
      const v = base.map((b, i) => b * (1 + 0.4 * sin(t * 0.5 + i * 1.7)));
      const sum = v.reduce((a, b) => a + b, 0);
      let a = -PI / 2 + t * 0.15;
      sl.forEach((o, i) => {
        const da = (v[i] / sum) * 2 * PI;
        const m = a + da / 2;
        const target = 0.4 * (0.5 + 0.5 * sin(t * 0.6 + i * 1.6));
        o.ex += (target - o.ex) * 0.15;
        const ox = cos(m) * 10 * o.ex;
        const oy = sin(m) * 10 * o.ex;
        const x1 = cx + ox + R * cos(a);
        const y1 = cy + oy + R * sin(a);
        const x2 = cx + ox + R * cos(a + da);
        const y2 = cy + oy + R * sin(a + da);
        o.p.setAttribute('d', 'M' + (cx + ox) + ' ' + (cy + oy) + 'L' + x1 + ' ' + y1 + 'A' + R + ' ' + R + ' 0 ' + (da > PI ? 1 : 0) + ' 1 ' + x2 + ' ' + y2 + 'Z');
        o.t.setAttribute('x', String(cx + ox + cos(m) * R * 0.62));
        o.t.setAttribute('y', String(cy + oy + sin(m) * R * 0.62 + 5));
        o.t.textContent = Math.round((v[i] / sum) * 100) + '%';
        a += da;
      });
    });
  }

  // ---------- 6. Lâmpada, μ, σ ----------
  {
    const g = G();
    const bx = 1030;
    const by = 58;
    const glowEl = E('circle', { cx: bx, cy: by, r: 55, fill: 'url(#bulbGlow)' }, g);
    const rays = G(g);
    for (let i = 0; i < 9; i++) {
      const a = -PI + (i * PI) / 8;
      stroke(E('line', { x1: bx + 36 * cos(a), y1: by + 36 * sin(a), x2: bx + 50 * cos(a), y2: by + 50 * sin(a) }, rays), C.yellow, 2.6);
    }
    const bulb = stroke(
      E('path', { d: 'M' + (bx - 12) + ' ' + (by + 18) + 'C' + (bx - 30) + ' ' + (by + 2) + ' ' + (bx - 24) + ' ' + (by - 30) + ' ' + bx + ' ' + (by - 30) + 'C' + (bx + 24) + ' ' + (by - 30) + ' ' + (bx + 30) + ' ' + (by + 2) + ' ' + (bx + 12) + ' ' + (by + 18) + 'Z', fill: C.yellow, 'fill-opacity': 0.25 }, g),
      C.yellow,
      2.6,
    );
    stroke(E('path', { d: 'M' + (bx - 11) + ' ' + (by + 27) + 'H' + (bx + 11) + 'M' + (bx - 9) + ' ' + (by + 34) + 'H' + (bx + 9) + 'M' + (bx - 5) + ' ' + (by + 14) + 'L' + (bx - 5) + ' ' + (by - 4) + 'L' + bx + ' ' + (by + 4) + 'L' + (bx + 5) + ' ' + (by - 4) + 'L' + (bx + 5) + ' ' + (by + 14), fill: 'none' }, g), C.chalk, 2);
    const on = true;
    let lv = 1;
    let fl = 0;
    updaters.push((t) => {
      lv += ((on ? 1 : 0.12) - lv) * 0.12;
      if (on && Math.random() < 0.006) fl = 6;
      if (fl > 0) fl--;
      const f = fl > 0 && fl % 2 ? 0.55 : 1;
      glowEl.setAttribute('opacity', String(lv * f * (0.7 + 0.3 * sin(t * 2.5))));
      rays.setAttribute('opacity', String(lv * f));
      rays.style.setProperty('transform-box', 'fill-box');
      rays.style.transformOrigin = '50% 100%';
      bulb.setAttribute('fill-opacity', String(0.08 + 0.3 * lv * f));
    });
    const m = G();
    M(m, 934, 38, 36, 'μ', C.blue);
    float(m, 3);
    const s = G();
    M(s, 962, 80, 34, 'σ', C.pink);
    float(s, 3);
  }

  // ---------- 7. Tabela x_i, f_i + média ----------
  {
    const g = G();
    const x0 = 866;
    const y0 = 168;
    const cw = 55;
    const rh = 22.4;
    const fi = [4, 7, 5, 3];
    const cells: Array<{ t: SVGTextElement; pop: number }> = [];
    stroke(E('rect', { x: x0, y: y0, width: cw * 2, height: rh * 5, fill: 'none' }, g), C.chalk, 2);
    for (let i = 1; i < 5; i++) E('line', { x1: x0, x2: x0 + cw * 2, y1: y0 + i * rh, y2: y0 + i * rh, stroke: C.chalk, 'stroke-width': 1.8 }, g);
    E('line', { x1: x0 + cw, x2: x0 + cw, y1: y0, y2: y0 + rh * 5, stroke: C.chalk, 'stroke-width': 1.8 }, g);
    const act = E('rect', { x: x0 + 2, y: y0, width: cw * 2 - 4, height: rh - 3, fill: C.yellow, 'fill-opacity': 0.22, rx: 4 }, g);
    M(g, x0 + cw / 2, y0 + 17, 18, 'x_{i}', C.chalk, { a: 'middle' });
    M(g, x0 + cw * 1.5, y0 + 17, 18, 'f_{i}', C.chalk, { a: 'middle' });
    for (let i = 0; i < 4; i++) {
      M(g, x0 + cw / 2, y0 + rh * (i + 1) + 17, 18, String(i + 1), C.chalk, { a: 'middle' });
      const t = M(g, x0 + cw * 1.5, y0 + rh * (i + 1) + 17, 18, String(fi[i]), C.yellow, { a: 'middle' });
      t.style.setProperty('transform-box', 'fill-box');
      t.style.transformOrigin = 'center';
      cells.push({ t, pop: -9 });
    }
    const mean = M(g, x0 - 6, y0 + rh * 5 + 28, 17, '', C.yellow);
    let next = 2.5;
    updaters.push((t) => {
      if (t > next) {
        next = t + rnd(1.8, 3.2);
        const i = Math.floor(Math.random() * 4);
        fi[i] = clamp(fi[i] + (Math.random() < 0.5 ? -1 : 1), 1, 9);
        cells[i].pop = t;
      }
      const row = Math.floor(t / 1.2) % 4;
      act.setAttribute('y', String(y0 + rh * (row + 1) + 1.5));
      let sum = 0;
      let n = 0;
      cells.forEach((c, i) => {
        c.t.textContent = String(fi[i]);
        sum += (i + 1) * fi[i];
        n += fi[i];
        const k = clamp(1 - (t - c.pop) / 0.5, 0, 1);
        c.t.style.transform = 'scale(' + (1 + 0.6 * k) + ')';
      });
      mean.textContent = 'média ≈ ' + (sum / n).toFixed(2);
    });
    const f = G();
    xbar(f, 925, 132, 23, C.chalk);
    M(f, 940, 132, 23, '=', C.chalk);
    frac(f, 972, 125, '1', 'n', 20);
    M(f, 985, 132, 34, 'Σ', C.chalk);
    M(f, 1018, 132, 22, 'x_{i}', C.chalk);
    M(f, 985, 150, 12, 'i=1', C.chalk);
    M(f, 992, 98, 12, 'n', C.chalk);
    float(f, 2);
  }

  // ---------- 8. Boxplots ----------
  {
    interface Box {
      w: SVGElement;
      box: SVGElement;
      med: SVGElement;
      ph: number;
    }
    const g = G();
    stroke(E('path', { d: 'M992 255V352H1076', fill: 'none' }, g), C.chalk, 2);
    const cols = [C.blue, C.orange, C.pink];
    const bx = [1008, 1034, 1060];
    const base = [318, 300, 296];
    const bs: Box[] = cols.map((c) => {
      const w = stroke(E('line', {}, g), c, 2.4);
      const box = stroke(E('rect', { width: 20, fill: c, 'fill-opacity': 0.35, rx: 2 }, g), c, 2.4);
      const med = stroke(E('line', {}, g), C.chalk, 2.4);
      return { w, box, med, ph: rnd(0, 6) };
    });
    updaters.push((t) => {
      bs.forEach((o, i) => {
        const c = base[i] + 9 * sin(t * 0.7 + o.ph);
        const hh = 11 + 5 * sin(t * 0.9 + o.ph * 2);
        const wh = hh + 14 + 7 * sin(t * 0.6 + o.ph);
        o.w.setAttribute('x1', String(bx[i]));
        o.w.setAttribute('x2', String(bx[i]));
        o.w.setAttribute('y1', String(clamp(c - wh, 258, 350)));
        o.w.setAttribute('y2', String(clamp(c + wh, 258, 349)));
        o.box.setAttribute('x', String(bx[i] - 10));
        o.box.setAttribute('y', String(c - hh));
        o.box.setAttribute('height', String(hh * 2));
        o.med.setAttribute('x1', String(bx[i] - 10));
        o.med.setAttribute('x2', String(bx[i] + 10));
        o.med.setAttribute('y1', String(c));
        o.med.setAttribute('y2', String(c));
      });
    });
  }

  // ---------- 9. Diagrama de Venn ----------
  {
    const g = G();
    const A = stroke(E('circle', { cy: 207, r: 40, fill: 'none' }, g), C.cyan, 3);
    const B = stroke(E('circle', { cy: 207, r: 40, fill: 'none' }, g), C.yellow, 3);
    const inter = E('circle', { cy: 207, r: 40, fill: 'url(#hatch)', 'fill-opacity': 0.9, 'clip-path': 'url(#clipA)' }, g);
    const ta = M(g, 0, 214, 22, 'A', C.cyan, { a: 'middle' });
    const tb = M(g, 0, 214, 22, 'B', C.yellow, { a: 'middle' });
    let dT = 66;
    let d = 66;
    updaters.push((t) => {
      dT = 66 + 34 * sin(t * 0.8);
      d += (dT - d) * 0.15;
      const ax = 95 - d / 2;
      const bx = 95 + d / 2;
      A.setAttribute('cx', String(ax));
      B.setAttribute('cx', String(bx));
      clipc.setAttribute('cx', String(ax));
      inter.setAttribute('cx', String(bx));
      ta.setAttribute('x', String(ax - d * 0.22 - 4));
      tb.setAttribute('x', String(bx + d * 0.22 + 4));
    });
  }
  {
    const g1 = G();
    M(g1, 8, 155, 20, 'P(A∩B) = P(A)·P(B|A)', C.chalk);
    float(g1, 2);
    const g2 = G();
    M(g2, 8, 274, 19, 'P(A∪B) = P(A) + P(B) − P(A∩B)', C.chalk);
    float(g2, 2);
  }

  // ---------- 10. Binomial + tabela ----------
  {
    const g = G();
    M(g, 15, 332, 21, 'P(X = k) =', C.chalk);
    stroke(E('path', { d: 'M110 305C103 316 103 334 110 345', fill: 'none' }, g), C.chalk, 2);
    stroke(E('path', { d: 'M138 305C145 316 145 334 138 345', fill: 'none' }, g), C.chalk, 2);
    M(g, 124, 320, 17, 'n', C.chalk, { a: 'middle' });
    M(g, 124, 341, 17, 'k', C.chalk, { a: 'middle' });
    M(g, 149, 332, 22, 'p^{k}(1−p)^{n−k}', C.chalk);
    float(g, 2);
    const t = G();
    const x0 = 18;
    const y0 = 362;
    const c0 = 62;
    const cw = 36.6;
    const rh = 33;
    stroke(E('rect', { x: x0, y: y0, width: c0 + cw * 5, height: rh * 2, fill: 'none' }, t), C.chalk, 2);
    E('line', { x1: x0, x2: x0 + c0 + cw * 5, y1: y0 + rh, y2: y0 + rh, stroke: C.chalk, 'stroke-width': 1.8 }, t);
    for (let i = 0; i < 5; i++) E('line', { x1: x0 + c0 + cw * i, x2: x0 + c0 + cw * i, y1: y0, y2: y0 + rh * 2, stroke: C.chalk, 'stroke-width': 1.8 }, t);
    const hl = E('rect', { y: y0 + 3, width: cw - 4, height: rh * 2 - 6, fill: C.yellow, 'fill-opacity': 0.2, rx: 4 }, t);
    M(t, x0 + c0 / 2, y0 + 23, 19, 'x', C.chalk, { a: 'middle' });
    M(t, x0 + c0 / 2, y0 + rh + 22, 14, 'P(X=x)', C.chalk, { a: 'middle' });
    const hd = ['0', '1', '2', '3', '…'];
    const vals = ['0,1', '0,2', '0,3', '0,4', '…'];
    const cells: SVGTextElement[] = [];
    for (let i = 0; i < 5; i++) {
      const cx = x0 + c0 + cw * (i + 0.5);
      M(t, cx, y0 + 23, 18, hd[i], C.chalk, { a: 'middle' });
      const v = M(t, cx, y0 + rh + 22, 17, vals[i], C.chalk, { a: 'middle' });
      v.style.setProperty('transform-box', 'fill-box');
      v.style.transformOrigin = 'center';
      cells.push(v);
    }
    updaters.push((t2) => {
      const i = Math.floor(t2 / 1.1) % 5;
      hl.setAttribute('x', String(x0 + c0 + cw * i + 2));
      cells.forEach((c, k) => (c.style.transform = 'scale(' + (k === i ? 1.3 : 1) + ')'));
    });
    float(t, 1.5);
  }

  // ---------- 11. Gráfico de linhas ----------
  {
    interface LineSerie {
      l: SVGElement;
      ds: SVGElement[];
    }
    const g = G();
    stroke(E('path', { d: 'M14 452V572H172', fill: 'none' }, g), C.chalk, 2);
    E('path', { d: 'M9 459L14 451L19 459M164 567L172 572L164 577', fill: 'none', stroke: C.chalk, 'stroke-width': 2 }, g);
    const ser = [
      { c: C.pink, b: [505, 495, 488, 474, 480, 466] },
      { c: C.yellow, b: [525, 514, 508, 494, 498, 484] },
      { c: C.cyan, b: [544, 532, 526, 516, 520, 504] },
    ];
    const ls: LineSerie[] = ser.map((q) => {
      const l = stroke(E('path', { fill: 'none' }, g), q.c, 2.6);
      const ds = q.b.map(() => stroke(E('circle', { r: 4.5, fill: C.board1 }, g), q.c, 2.4));
      return { l, ds };
    });
    updaters.push((t) => {
      ls.forEach((o, k) => {
        let d = '';
        ser[k].b.forEach((v, i) => {
          const yy = v + 5 * sin(t * 0.9 + i * 1.2 + k * 1.5);
          const x = 24 + i * 28;
          d += (i ? 'L' : 'M') + x + ' ' + yy.toFixed(1);
          o.ds[i].setAttribute('cx', String(x));
          o.ds[i].setAttribute('cy', yy.toFixed(1));
        });
        o.l.setAttribute('d', d);
      });
    });
    const f = G();
    M(f, 178, 556, 20, 's² = ', C.chalk);
    frac(f, 242, 549, '1', 'n−1', 19);
    M(f, 262, 556, 32, 'Σ', C.chalk);
    M(f, 296, 556, 20, '(x_{i} − ', C.chalk);
    xbar(f, 336, 556, 20, C.chalk);
    M(f, 349, 556, 20, ')²', C.chalk);
    M(f, 262, 577, 12, 'i=1', C.chalk);
    M(f, 266, 527, 12, 'n', C.chalk);
    float(f, 2);
  }

  // ---------- 12. Σ ciano ----------
  {
    const g = G();
    const t = M(g, 0, 0, 66, 'Σ', C.cyan, { a: 'middle' });
    updaters.push((tm) => {
      const sx = cos(tm * 0.9);
      t.setAttribute('transform', 'translate(232 ' + (500 + 4 * sin(tm * 1.6)) + ') scale(' + sx + ' 1)');
    });
  }

  // ---------- 13. Dados ----------
  {
    interface Die {
      d: SVGGElement;
      cx: number;
      cy: number;
      sz: number;
      rot0: number;
      face: number;
      pips: SVGElement[];
      roll: number;
      next: number;
      last?: number;
    }
    const dice: Die[] = [];
    const g = G();
    const sum = M(g, 375, 352, 16, '', C.chalk, { a: 'middle' });
    const lay: Record<number, [number, number][]> = {
      1: [[0, 0]],
      2: [[-1, -1], [1, 1]],
      3: [[-1, -1], [0, 0], [1, 1]],
      4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
      5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
      6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
    };
    function setFace(o: Die, f: number) {
      o.pips.forEach((p, i) => {
        const q = lay[f][i];
        if (q) {
          p.setAttribute('cx', String(q[0] * o.sz * 0.26));
          p.setAttribute('cy', String(q[1] * o.sz * 0.26));
          p.setAttribute('opacity', '1');
        } else p.setAttribute('opacity', '0');
      });
    }
    function mk(cx: number, cy: number, sz: number, c: string, rot0: number) {
      const d = G(g);
      stroke(E('rect', { x: -sz / 2, y: -sz / 2, width: sz, height: sz, rx: sz * 0.2, fill: c, 'fill-opacity': 0.14 }, d), c, 3.2);
      const pips: SVGElement[] = [];
      for (let i = 0; i < 6; i++) pips.push(E('circle', { r: sz * 0.075, fill: c }, d));
      const o: Die = { d, cx, cy, sz, rot0, face: Math.ceil(Math.random() * 6), pips, roll: -9, next: rnd(2, 5) };
      dice.push(o);
      return o;
    }
    mk(332, 402, 72, C.cyan, -14);
    mk(410, 424, 68, C.pink, 18);
    dice.forEach((o) => setFace(o, o.face));
    dice[1].next += 1.6;
    // faíscas
    const sp = G(g);
    const sparks = (
      [
        [290, 365, -8],
        [300, 352, 0],
        [298, 376, -4],
        [455, 395, 8],
        [462, 408, 0],
      ] as [number, number, number][]
    ).map((a) => stroke(E('line', { x1: a[0], y1: a[1], x2: a[0] + (a[2] < 0 ? -12 : 12), y2: a[1] + a[2] }, sp), a[2] > 0 ? C.pink : C.cyan, 2.6));
    updaters.push((t) => {
      dice.forEach((o, i) => {
        if (T > o.next) {
          o.roll = T;
          o.next = T + rnd(4, 7);
        }
        const k = (T - o.roll) / 1.0;
        let y = 0;
        let r = o.rot0;
        if (k >= 0 && k < 1) {
          if (Math.floor(k * 14) !== o.last) {
            o.last = Math.floor(k * 14);
            o.face = Math.ceil(Math.random() * 6);
            setFace(o, o.face);
          }
          const e = 1 - (1 - k) ** 3;
          y = -34 * sin(PI * k);
          r = o.rot0 + e * (i ? -720 : 720);
        }
        o.d.setAttribute('transform', 'translate(' + o.cx + ' ' + (o.cy + y + 3 * sin(t * 1.3 + i * 2)) + ') rotate(' + (r + 3 * sin(t * 0.8 + i)) + ')');
      });
      sum.textContent = 'soma = ' + (dice[0].face + dice[1].face);
      sparks.forEach((s, i) => s.setAttribute('opacity', String(0.35 + 0.65 * abs(sin(t * 2.2 + i * 1.3)))));
    });
  }

  // ---------- 14. Notebook ----------
  {
    const g = G();
    stroke(E('rect', { x: 360, y: 470, width: 100, height: 70, rx: 5, fill: '#14181a' }, g), C.chalk, 2.6);
    stroke(E('polygon', { points: '346,545 474,545 486,574 334,574', fill: 'none' }, g), C.chalk, 2.6);
    stroke(E('line', { x1: 386, x2: 434, y1: 565, y2: 565 }, g), C.chalk, 2);
    const cols = [C.blue, C.orange, C.yellow, C.orange];
    const bs = cols.map((c, i) => E('rect', { x: 372 + i * 20, width: 14, fill: c, 'fill-opacity': 0.9 }, g));
    const ln = stroke(E('path', { fill: 'none' }, g), C.pink, 2);
    updaters.push((t) => {
      let d = '';
      bs.forEach((b, i) => {
        const h = 12 + 26 * (0.5 + 0.5 * sin(t * 1.3 + i * 1.15));
        b.setAttribute('y', String(536 - h));
        b.setAttribute('height', String(h));
        d += (i ? 'L' : 'M') + (379 + i * 20) + ' ' + (536 - h - 6).toFixed(1);
      });
      ln.setAttribute('d', d);
    });
    float(g, 2);
  }

  // ---------- 15. Documento + lupa ----------
  {
    const g = G();
    stroke(E('path', { d: 'M492 446H560L582 468V540H492Z', fill: '#14181a' }, g), C.chalk, 2.4);
    stroke(E('path', { d: 'M560 446V468H582', fill: 'none' }, g), C.chalk, 2);
    stroke(E('line', { x1: 502, x2: 545, y1: 462, y2: 462 }, g), C.pink, 5);
    stroke(E('line', { x1: 502, x2: 575, y1: 480, y2: 480 }, g), C.yellow, 5);
    stroke(E('line', { x1: 502, x2: 560, y1: 497, y2: 497 }, g), C.cyan, 5);
    stroke(E('line', { x1: 502, x2: 572, y1: 514, y2: 514 }, g), C.orange, 5);
    stroke(E('line', { x1: 502, x2: 552, y1: 529, y2: 529 }, g), C.blue, 5);
    const mg = G(g);
    E('circle', { r: 17, fill: C.cyan, 'fill-opacity': 0.14 }, mg);
    stroke(E('circle', { r: 17, fill: 'none' }, mg), C.cyan, 3.5);
    stroke(E('line', { x1: 12, y1: 12, x2: 30, y2: 30 }, mg), C.cyan, 6);
    updaters.push((t) => {
      mg.setAttribute('transform', 'translate(' + (540 + 26 * sin(t * 0.8)) + ' ' + (498 + 22 * sin(t * 1.1 + 1)) + ')');
    });
  }

  // ---------- 16. Barras 3D + seta ----------
  {
    interface Bar3D {
      f: SVGElement;
      t: SVGElement;
      s: SVGElement;
      h: number;
      tg: number;
      v: number;
      x: number;
    }
    const g = G();
    const base = 550;
    stroke(E('line', { x1: 620, x2: 760, y1: base, y2: base }, g), C.chalk, 2.4);
    const cols = [C.blue, C.orange, C.green];
    const xs = [626, 671, 716];
    const w = 34;
    const dx = 9;
    const dy = 8;
    const bs: Bar3D[] = cols.map((c, i) => {
      const f = stroke(E('rect', { width: w, fill: c, 'fill-opacity': 0.55, rx: 1.5 }, g), c, 2.4);
      const t = stroke(E('polygon', { fill: c, 'fill-opacity': 0.85 }, g), c, 2);
      const s = stroke(E('polygon', { fill: c, 'fill-opacity': 0.35 }, g), c, 2);
      return { f, t, s, h: [40, 75, 110][i], tg: [40, 75, 110][i], v: 0, x: xs[i] };
    });
    const arr = stroke(E('path', { fill: 'none', 'stroke-dasharray': '7 5' }, g), C.chalk, 2.6);
    const head = stroke(E('path', { fill: 'none' }, g), C.chalk, 3);
    let nxt = 4;
    updaters.push(() => {
      if (T > nxt) {
        nxt = T + rnd(3, 5);
        const a = [rnd(25, 60), rnd(55, 90), rnd(80, 125)];
        if (Math.random() < 0.3) a.reverse();
        bs.forEach((o, i) => (o.tg = a[i]));
      }
      bs.forEach((o) => {
        o.v += (o.tg - o.h) * 0.12;
        o.v *= 0.78;
        o.h += o.v;
        const x = o.x;
        const y = base - o.h;
        o.f.setAttribute('x', String(x));
        o.f.setAttribute('y', String(y));
        o.f.setAttribute('height', String(Math.max(1, o.h)));
        o.t.setAttribute('points', x + ',' + y + ' ' + (x + dx) + ',' + (y - dy) + ' ' + (x + w + dx) + ',' + (y - dy) + ' ' + (x + w) + ',' + y);
        o.s.setAttribute('points', x + w + ',' + y + ' ' + (x + w + dx) + ',' + (y - dy) + ' ' + (x + w + dx) + ',' + (base - dy) + ' ' + (x + w) + ',' + base);
      });
      const p0 = { x: xs[0] + 10, y: base - bs[0].h - 30 };
      const p1 = { x: xs[1] + 30, y: base - bs[1].h - 52 };
      const p2 = { x: xs[2] + 54, y: base - bs[2].h - 38 };
      const cx = p1.x;
      const cy = p1.y;
      arr.setAttribute('d', 'M' + p0.x + ' ' + p0.y + 'Q' + cx + ' ' + cy + ' ' + p2.x + ' ' + p2.y);
      const ang = Math.atan2(p2.y - cy, p2.x - cx);
      head.setAttribute('d', 'M' + (p2.x - 13 * cos(ang - 0.5)) + ' ' + (p2.y - 13 * sin(ang - 0.5)) + 'L' + p2.x + ' ' + p2.y + 'L' + (p2.x - 13 * cos(ang + 0.5)) + ' ' + (p2.y - 13 * sin(ang + 0.5)));
    });
  }

  // ---------- 17. E(X) e Var(X) ----------
  {
    const g1 = G();
    M(g1, 538, 584, 22, 'E(X) = ', C.chalk);
    M(g1, 614, 584, 36, 'Σ', C.chalk);
    M(g1, 643, 584, 22, 'x_{i}p_{i}', C.chalk);
    float(g1, 2);
    const g2 = G();
    M(g2, 692, 584, 22, 'Var(X) = E(X²) − [E(X)]²', C.chalk);
    float(g2, 2);
  }

  // ---------- 18. Curva normal inferior (teste de hipótese) ----------
  {
    const g = G();
    const base = 546;
    const cx0 = 927;
    const sc = 47;
    const pk = 108;
    const mid = E('path', { fill: C.blue, 'fill-opacity': 0.55 }, g);
    const tl = E('path', { fill: C.pink, 'fill-opacity': 0.7 }, g);
    const tr = E('path', { fill: C.pink, 'fill-opacity': 0.7 }, g);
    const curve = stroke(E('path', { fill: 'none' }, g), C.chalk, 2.8);
    stroke(E('line', { x1: 782, x2: 1074, y1: base, y2: base }, g), C.chalk, 2.2);
    stroke(E('line', { x1: cx0, x2: cx0, y1: base, y2: base - pk - 2, 'stroke-dasharray': '4 4' }, g), C.chalk, 1.6);
    const Y = (z: number) => base - pk * exp(-0.5 * z * z);
    const X = (z: number) => cx0 + z * sc;
    const path = (a: number, b: number) => {
      let d = 'M' + X(a) + ' ' + base;
      const n = Math.max(2, Math.round((b - a) * 14));
      for (let i = 0; i <= n; i++) {
        const z = a + ((b - a) * i) / n;
        d += 'L' + X(z).toFixed(1) + ' ' + Y(z).toFixed(1);
      }
      return d + 'L' + X(b) + ' ' + base + 'Z';
    };
    let cd = '';
    for (let i = 0; i <= 80; i++) {
      const z = -3.1 + (6.2 * i) / 80;
      cd += (i ? 'L' : 'M') + X(z).toFixed(1) + ' ' + Y(z).toFixed(1);
    }
    curve.setAttribute('d', cd);
    const lA = M(g, 0, 498, 14, '', C.red, { a: 'middle' });
    const rA = M(g, 0, 498, 14, '', C.red, { a: 'middle' });
    const aL = stroke(E('path', { fill: 'none' }, g), C.red, 2.2);
    const aR = stroke(E('path', { fill: 'none' }, g), C.red, 2.2);
    const zl = M(g, 0, 566, 15, '', C.chalk, { a: 'middle' });
    const zr = M(g, 0, 566, 15, '', C.chalk, { a: 'middle' });
    M(g, cx0, 566, 15, '0', C.chalk, { a: 'middle' });
    const al = M(g, 788, 440, 16, '', C.yellow);
    const ci = M(g, 788, 460, 13, '', C.chalk);
    function erf(x: number) {
      const s = x < 0 ? -1 : 1;
      x = abs(x);
      const t = 1 / (1 + 0.3275911 * x);
      const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-x * x);
      return s * y;
    }
    const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
    let zc = 1.6;
    const zT = 1.7;
    updaters.push((t) => {
      zc += (zT + 0.55 * sin(t * 0.5) - zc) * 0.15;
      mid.setAttribute('d', path(-zc, zc));
      tl.setAttribute('d', path(-3.1, -zc));
      tr.setAttribute('d', path(zc, 3.1));
      const a2 = 1 - Phi(zc);
      const xl = clamp(X(-zc - 0.75), 835, 1020);
      const xr = clamp(X(zc + 0.75), 835, 1020);
      lA.setAttribute('x', String(xl));
      rA.setAttribute('x', String(xr));
      lA.textContent = rA.textContent = 'α/2 = ' + a2.toFixed(3);
      aL.setAttribute('d', 'M' + xl + ' 503V523M' + (xl - 5) + ' 517L' + xl + ' 524L' + (xl + 5) + ' 517');
      aR.setAttribute('d', 'M' + xr + ' 503V523M' + (xr - 5) + ' 517L' + xr + ' 524L' + (xr + 5) + ' 517');
      zl.setAttribute('x', String(X(-zc)));
      zr.setAttribute('x', String(X(zc)));
      zl.textContent = '−z=' + zc.toFixed(2);
      zr.textContent = 'z=' + zc.toFixed(2);
      al.textContent = 'α = ' + (2 * a2).toFixed(3);
      ci.textContent = 'confiança ' + ((1 - 2 * a2) * 100).toFixed(1) + '%';
    });
    const t1 = G();
    M(t1, 784, 382, 22, 'H_{0} : μ = μ_{0}', C.chalk);
    M(t1, 784, 413, 22, 'H_{1} : μ ≠ μ_{0}', C.chalk);
    float(t1, 2);
    const t2 = G();
    M(t2, 935, 403, 22, 't =', C.chalk);
    xbar(t2, 972, 395, 21, C.chalk);
    M(t2, 987, 395, 21, '− μ_{0}', C.chalk);
    E('line', { x1: 968, x2: 1060, y1: 402, y2: 402, stroke: C.chalk, 'stroke-width': 1.8 }, t2);
    frac(t2, 1014, 428, 's', '√n', 19, C.chalk);
    float(t2, 2);
    const t3 = G();
    M(t3, 796, 330, 21, 'IC = ', C.chalk);
    xbar(t3, 848, 330, 21, C.chalk);
    M(t3, 861, 330, 21, '± t_{α/2}', C.chalk);
    frac(t3, 972, 324, 's', '√n', 20);
    float(t3, 2);
  }

  // ---------- 19. Confetes ----------
  {
    const g = G();
    const cols = [C.cyan, C.yellow, C.pink, C.orange, C.green, C.blue];
    const ds: Array<{ c: SVGElement; bx: number; by: number; p: number; f: number; vx: number; vy: number; ox: number; oy: number }> = [];
    for (let i = 0; i < 16; i++) {
      const a = rnd(0, 6.28);
      const r = rnd(4, 28);
      ds.push({ c: E('circle', { fill: cols[i % 6] }, g), bx: 1052 + r * cos(a), by: 472 + r * 0.9 * sin(a), p: rnd(0, 6.28), f: rnd(0.8, 2), vx: 0, vy: 0, ox: 0, oy: 0 });
    }
    updaters.push((t) => {
      ds.forEach((d) => {
        d.ox += d.vx;
        d.oy += d.vy;
        d.vx = d.vx * 0.9 - d.ox * 0.03;
        d.vy = d.vy * 0.9 - d.oy * 0.03;
        d.c.setAttribute('cx', String(d.bx + d.ox + 4 * sin(t * d.f + d.p)));
        d.c.setAttribute('cy', String(d.by + d.oy + 4 * cos(t * d.f * 0.8 + d.p)));
        d.c.setAttribute('r', String(1.8 + 1.8 * (0.5 + 0.5 * sin(t * 2.2 * d.f + d.p))));
      });
    });
  }

  // ---------- 20. Rabiscos de giz ----------
  {
    const g = G();
    const scribbles: [string, string, number, number][] = [
      ['M192 188Q210 176 228 186T262 182M198 197Q216 188 238 196', C.pink, 0, 7],
      ['M200 176L228 170M206 168L236 164', C.cyan, 2, 8],
      ['M985 214L998 178M998 218L1012 180M1012 222L1026 184M1026 224L1040 188', C.blue, 1, 9],
      ['M796 214L806 170L814 204L824 160L832 200', C.yellow, 3, 7.5],
      ['M1000 232Q1030 225 1062 236', C.pink, 4, 8.5],
      ['M300 352L286 358M296 340L282 336', C.cyan, 2, 6.5],
      ['M740 360Q780 340 800 350', C.blue, 5, 9],
      ['M455 440L470 425M462 452L480 440', C.yellow, 0.5, 6],
    ];
    const ps = scribbles.map((d) => {
      const p = stroke(E('path', { d: d[0], fill: 'none' }, g), d[1], 3.2);
      return { p, s: d[2], per: d[3] };
    });
    updaters.push((t) => ps.forEach((o) => drawIn(o.p, prog(t, o.s, 1.4, o.per))));
  }

  // ---------- avanço da cena ----------
  // O loop em si vive no componente (via `useRafLoop`); aqui só se avança um
  // passo — assim a cena não abre um segundo `requestAnimationFrame` próprio.
  function advance(dt: number) {
    if (playing) T += dt;
    for (const u of updaters) u(T);
    for (const f of floaters) {
      f.g.style.transform =
        'translate(' +
        (f.amp * drift(T * f.f + f.p, f.seed)).toFixed(2) +
        'px,' +
        (f.amp * drift(T * f.f * 1.3 + f.p + 11, f.seed + 7)).toFixed(2) +
        'px) rotate(' +
        (f.r * drift(T * 0.7 + f.p, f.seed + 3)).toFixed(2) +
        'deg)';
    }
  }

  return { advance };
}

export function DataScienceBackdrop() {
  const svgRef = useRef<SVGSVGElement>(null);
  const sceneRef = useRef<{ advance: (dt: number) => void } | null>(null);
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Harmonia com o conteúdo: o quadro é vívido atrás do hero e vai desaparecendo
  // conforme o usuário rola, para o texto ler sobre o papel limpo.
  const { scrollY } = useScroll();
  const vhRef = useRef(typeof window !== 'undefined' ? window.innerHeight : 800);
  useEffect(() => {
    const onResize = () => {
      vhRef.current = window.innerHeight;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // O quadro continua **presente** atrás do conteúdo (não some): é o que torna
  // a unificação visível — os cards têm superfície própria e o texto lê bem.
  // Ajuste fino: quanto mais alto o piso, mais presente o quadro fica.
  const opacity = useTransform(scrollY, (v) => {
    const range = Math.max(1, vhRef.current * 0.9);
    return Math.min(1, Math.max(0.4, 1 - v / range));
  });

  // Ponteiro: um único listener para a cena inteira (paralaxe de câmera).
  useEffect(() => {
    attachPointer();
  }, []);

  // Um único loop (teto de FPS + pausa com a aba oculta) avança a cena,
  // suaviza o ponteiro e aplica a paralaxe de câmera no SVG.
  useRafLoop(
    (deltaMs) => {
      const scene = sceneRef.current;
      if (!scene) return;

      stepPointer();
      const pointer = getPointer();
      const el = svgRef.current;
      if (el && pointer.supported) {
        el.style.transform =
          'perspective(1200px) translate3d(' +
          (-pointer.x * 16).toFixed(2) +
          'px,' +
          (-pointer.y * 14).toFixed(2) +
          'px,0) rotateY(' +
          (pointer.x * 0.8).toFixed(2) +
          'deg) rotateX(' +
          (-pointer.y * 0.8).toFixed(2) +
          'deg) scale(1.12)';
      }

      scene.advance(Math.min(0.05, deltaMs / 1000));
    },
    { fps: 45, enabled: !prefersReducedMotion }
  );

  // Constrói o quadro uma vez: a paleta é única, não há tema para acompanhar.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.replaceChildren();
    const scene = build(svg, CHALK);
    sceneRef.current = scene;
    scene.advance(0); // pinta o primeiro quadro (mesmo com movimento desligado)
    return () => {
      sceneRef.current = null;
    };
  }, []);

  return (
    <motion.div className="board-bg" aria-hidden="true" style={{ opacity }}>
      <svg
        ref={svgRef}
        className="board-bg__svg"
        viewBox="-270 -153 1620 917"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      />
      <div className="board-bg__grain" />
    </motion.div>
  );
}
