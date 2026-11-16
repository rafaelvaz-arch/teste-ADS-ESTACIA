/* =============================================================================
 * js/estacia3d.js — núcleo COMPARTILHADO da navegação 3D (navegacao.jsx e encontremeucarro.jsx)
 *
 * Script comum (sem JSX). Carregue ANTES dos .jsx:  <script src="js/estacia3d.js"></script>
 * Depois que o Three.js existir, chame  Estacia3D.init(window.THREE).
 *
 * Contém: conversões plantas↔metros, A* sobre o mapa de custo extraído por visão computacional
 * (assets/mapa_estacia.js), geometria da curva, pisos/rampa/cenário extrudado e o carro.
 * Convenções: metros; x leste, y norte, z para cima; Térreo em z = 0 e SS1 em z = -GAP.
 * ========================================================================== */
(function () {
  'use strict';

  let THREE = null;

  const VAGA_PADRAO = 'A-145';
  const GAP = 3.6; // laje a laje (m)
  const LIFT = 0.3; // rota acima do piso (m)
  const RAMPA_EASE = 0.22; // fração de cada ponta da rampa com curva vertical
  const WALL_H = 0.9, WALL_T = 0.35; // muretas da rampa
  const OCUPACAO = 0.55; // fração de vagas com carro estacionado (cenário)

  /* Quem chama esta tela define a vaga: ?vaga=A-145 (mesmo padrão de monitoramento.html), o ticket salvo
   * (sessionStorage 'estacia_vaga_destino') ou o check-in ativo (localStorage 'active_checkin'). */
  function pedirVaga() {
    const norm = (t) => {
      const m = String(t || '').toUpperCase().match(/\b([A-E])?\s*-?\s*(?:VAGA\s*)?(\d{1,3})\b/);
      return m ? (m[1] || 'A') + '-' + m[2].padStart(3, '0') : null;
    };
    try { const q = new URLSearchParams(window.location.search).get('vaga'); if (norm(q)) return norm(q); } catch (e) { /* sem URL */ }
    try { const d = JSON.parse(window.sessionStorage.getItem('estacia_vaga_destino') || 'null'); if (d && norm(d.vaga)) return norm(d.vaga); } catch (e) { /* ignora */ }
    try { const c = JSON.parse(window.localStorage.getItem('active_checkin') || 'null'); if (c && norm(c.vaga)) return norm(c.vaga); } catch (e) { /* ignora */ }
    return VAGA_PADRAO;
  }

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function criarConversores(mapa) {
    const [W, H] = mapa.meta.imagem_px, s = mapa.meta.m_por_px;
    const A = mapa.subsolo.custo.afim_ss1_para_terreo;
    const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    const terPxToM = (x, y) => [(x - W / 2) * s, (H / 2 - y) * s];
    const mToTerPx = (X, Y) => [X / s + W / 2, H / 2 - Y / s];
    const ssPxToTerPx = (x, y) => [A[0][0] * x + A[0][1] * y + A[0][2], A[1][0] * x + A[1][1] * y + A[1][2]];
    const terPxToSsPx = (x, y) => {
      const dx = x - A[0][2], dy = y - A[1][2];
      return [(A[1][1] * dx - A[0][1] * dy) / det, (-A[1][0] * dx + A[0][0] * dy) / det];
    };
    return {
      W, H, s, terPxToM, mToTerPx,
      ssPxToM: (x, y) => terPxToM(...ssPxToTerPx(x, y)),
      mToSsPx: (X, Y) => terPxToSsPx(...mToTerPx(X, Y)),
    };
  }

  function decodificarGrade(custo) {
    const bin = atob(custo.dados_b64);
    const g = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) g[i] = bin.charCodeAt(i);
    let mg = null;
    if (custo.margem_b64) { const b2 = atob(custo.margem_b64); mg = new Uint8Array(b2.length); for (let i = 0; i < b2.length; i++) mg[i] = b2.charCodeAt(i); }
    return { g, mg, gw: custo.grade[0], gh: custo.grade[1], cell: custo.celula_px };
  }

  /* ---------------- A* no mapa de custo (células de 4 px do SS1) ---------------- */
  const MIN_CLEAR = 20; // valor da grade ≈ 1,7 células de folga (~0,9 m)

  const D8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];

  class Heap {
    constructor() { this.k = []; this.v = []; }
    push(key, val) {
      const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
      while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; }
    }
    pop() {
      const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop();
      if (k.length) {
        k[0] = lk; v[0] = lv; let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < k.length && k[l] < k[m]) m = l;
          if (r < k.length && k[r] < k[m]) m = r;
          if (m === i) break;
          [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m;
        }
      }
      return top;
    }
    get size() { return this.k.length; }
  }

  function celulaLivreMaisProxima(G, ci, cj, minV) {
    const { g, gw, gh } = G;
    for (let r = 0; r < 60; r++) {
      let best = null, bd = 1e9;
      for (let j = cj - r; j <= cj + r; j++) {
        for (let i = ci - r; i <= ci + r; i++) {
          if (i < 0 || j < 0 || i >= gw || j >= gh) continue;
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue;
          if (g[j * gw + i] >= minV) { const d = (i - ci) ** 2 + (j - cj) ** 2; if (d < bd) { bd = d; best = [i, j]; } }
        }
      }
      if (best) return best;
    }
    return null;
  }

  function aEstrela(G, s, t) {
    const { g, gw, gh } = G, N = gw * gh;
    const gs = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1);
    const si = s[1] * gw + s[0], ti = t[1] * gw + t[0];
    const h = (i, j) => { const dx = Math.abs(i - t[0]), dy = Math.abs(j - t[1]); return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy); };
    const open = new Heap(); gs[si] = 0; open.push(h(s[0], s[1]), si);
    while (open.size) {
      const cur = open.pop();
      if (cur === ti) break;
      const ci = cur % gw, cj = (cur / gw) | 0, gc = gs[cur];
      for (const [dx, dy, len] of D8) {
        const ni = ci + dx, nj = cj + dy;
        if (ni < 0 || nj < 0 || ni >= gw || nj >= gh) continue;
        const v = g[nj * gw + ni]; if (!v) continue;
        if (dx && dy && (!g[cj * gw + ni] || !g[nj * gw + ci])) continue; // não corta quina
        const n = nj * gw + ni;
        // custo: prefere o centro do corredor (folga) e evita a faixa colada na parede (margem < 6 m)
        const margem = G.mg ? clamp(1 - G.mg[n] / 60, 0, 1) : 0;
        const ng = gc + len * (1 + 6 / (1 + v / 12)) * (1 + 3 * margem);
        if (ng < gs[n]) { gs[n] = ng; came[n] = cur; open.push(ng + h(ni, nj), n); }
      }
    }
    if (came[ti] < 0 && ti !== si) return null;
    const path = []; for (let c = ti; c !== -1; c = came[c]) path.push([c % gw, (c / gw) | 0]);
    return path.reverse();
  }

  function linhaLivre(G, a, b) {
    const { g, gw } = G, n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2) || 1;
    for (let k = 0; k <= n; k++) {
      const i = Math.round(a[0] + ((b[0] - a[0]) * k) / n), j = Math.round(a[1] + ((b[1] - a[1]) * k) / n);
      if (g[j * gw + i] < MIN_CLEAR) return false;
    }
    return true;
  }

  function simplificar(G, path) {
    const out = [path[0]]; let i = 0;
    while (i < path.length - 1) {
      let j = path.length - 1;
      while (j > i + 1 && !linhaLivre(G, path[i], path[j])) j--;
      out.push(path[j]); i = j;
    }
    return out;
  }

  function douglasPeucker(pts, eps) {
    if (pts.length < 3) return pts;
    const a = pts[0], b = pts[pts.length - 1], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1e-9;
    let imax = 0, dmax = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs(dy * pts[i].x - dx * pts[i].y + b.x * a.y - b.y * a.x) / L;
      if (d > dmax) { dmax = d; imax = i; }
    }
    if (dmax <= eps) return [a, b];
    return douglasPeucker(pts.slice(0, imax + 1), eps).slice(0, -1).concat(douglasPeucker(pts.slice(imax), eps));
  }

  function colapsarCurtos(pts, minSeg) { // funde nós separados por menos de minSeg (mantém primeiro e último)
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const p = out[out.length - 1];
      if (Math.hypot(pts[i].x - p.x, pts[i].y - p.y) < minSeg) continue;
      out.push(pts[i]);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  /* ---------------- curva, tabelas distância/tempo e manobras ---------------- */
  function buildPoints(nodes, radius, step) {
    const V = (n) => new THREE.Vector3(n.x, n.y, n.z);
    const out = [];
    const push = (v) => { if (!out.length || out[out.length - 1].distanceTo(v) > 1e-4) out.push(v); };
    push(V(nodes[0]));
    for (let i = 1; i < nodes.length - 1; i++) {
      const prev = V(nodes[i - 1]), cur = V(nodes[i]), next = V(nodes[i + 1]);
      const d1 = new THREE.Vector2(cur.x - prev.x, cur.y - prev.y), d2 = new THREE.Vector2(next.x - cur.x, next.y - cur.y);
      const l1 = d1.length(), l2 = d2.length();
      if (l1 < 1e-3 || l2 < 1e-3) { push(cur); continue; }
      d1.normalize(); d2.normalize();
      if (d1.dot(d2) > 0.999) { push(cur); continue; }
      const r = Math.min(radius, l1 * 0.5, l2 * 0.5);
      const a = cur.clone().lerp(prev, r / cur.distanceTo(prev)), b = cur.clone().lerp(next, r / cur.distanceTo(next));
      push(a);
      for (let k = 1; k < 10; k++) {
        const t = k / 10;
        push(new THREE.Vector3().addScaledVector(a, (1 - t) * (1 - t)).addScaledVector(cur, 2 * (1 - t) * t).addScaledVector(b, t * t));
      }
      push(b);
    }
    push(V(nodes[nodes.length - 1]));
    const dense = [out[0]];
    for (let i = 1; i < out.length; i++) {
      const a = out[i - 1], b = out[i], n = Math.floor(a.distanceTo(b) / step);
      for (let j = 1; j <= n; j++) { const p = a.clone().lerp(b, j / (n + 1)); if (p.distanceTo(b) > 1e-3) dense.push(p); }
      dense.push(b);
    }
    return dense;
  }

  function rampProfile(t) {
    const E = RAMPA_EASE, k = 1 / (1 - E);
    if (t < E) return (k * t * t) / (2 * E);
    if (t <= 1 - E) return k * (E / 2 + (t - E));
    const r = 1 - t;
    return 1 - (k * r * r) / (2 * E);
  }

  function idxOf(arr, v) {
    let lo = 0, hi = arr.length - 1;
    if (v <= arr[0]) return 0;
    if (v >= arr[hi]) return hi;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (arr[mid] <= v) lo = mid; else hi = mid; }
    const d = arr[hi] - arr[lo];
    return lo + (d > 1e-9 ? (v - arr[lo]) / d : 0);
  }

  const sampleAt = (arr, idx) => { const i = Math.floor(idx), j = Math.min(arr.length - 1, i + 1); return arr[i] + (arr[j] - arr[i]) * (idx - i); };

  const setTexSRGB = (t) => { if ('colorSpace' in t) t.colorSpace = THREE.SRGBColorSpace; else t.encoding = THREE.sRGBEncoding; };

  function placeholderTexture(label) {
    const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
    const g = c.getContext('2d');
    g.fillStyle = '#1b2430'; g.fillRect(0, 0, 1280, 720);
    g.fillStyle = 'rgba(200,225,255,.5)'; g.font = 'bold 46px sans-serif'; g.textAlign = 'center'; g.fillText(label, 640, 360);
    const t = new THREE.CanvasTexture(c); setTexSRGB(t); return t;
  }

  function planeWithHole(mapa, hole) {
    const hw = mapa.meta.largura_m / 2, hh = mapa.meta.altura_m / 2;
    if (!hole) return new THREE.PlaneGeometry(hw * 2, hh * 2);
    const shape = new THREE.Shape();
    shape.moveTo(-hw, -hh); shape.lineTo(hw, -hh); shape.lineTo(hw, hh); shape.lineTo(-hw, hh); shape.lineTo(-hw, -hh);
    const p = new THREE.Path();
    p.moveTo(hole.x0, hole.y1); p.lineTo(hole.x0, hole.y0); p.lineTo(hole.x1, hole.y0); p.lineTo(hole.x1, hole.y1); p.lineTo(hole.x0, hole.y1);
    shape.holes.push(p);
    const g = new THREE.ShapeGeometry(shape), pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (hw * 2) + 0.5, pos.getY(i) / (hh * 2) + 0.5);
    uv.needsUpdate = true;
    return g;
  }

  function makeFloor(url, label, z, opacity, order, renderer, geometry) {
    const mat = new THREE.MeshBasicMaterial({ map: placeholderTexture(label + ' (carregando…)'), transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(0, 0, z); mesh.renderOrder = order;
    new THREE.TextureLoader().load(url, (tex) => {
      setTexSRGB(tex); tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); mat.map = tex; mat.needsUpdate = true;
    }, undefined, () => console.warn('[navegacao] textura não carregou:', url));
    return { mesh, mat };
  }

  function makeLabel(text, color, sx, sy) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(8,16,28,.88)'; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(3, 3, 506, 122);
    g.fillStyle = color; g.font = 'bold 54px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 67);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    sp.scale.set(sx, sy, 1); sp.renderOrder = 30; return sp;
  }

  const makeRing = (color, a, b) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(a, b, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
    m.renderOrder = 8; return m;
  };

  /* Carro (frente +X, esquerda +Y, topo +Z), ~4,2 m. */
  function buildCar(lightK) {
    const car = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: 0x1f6bff, metalness: 0.75, roughness: 0.28 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0a1020, metalness: 0.3, roughness: 0.15 });
    const wheel = new THREE.MeshStandardMaterial({ color: 0x0d0f14, roughness: 0.9 });
    const lamp = new THREE.MeshStandardMaterial({ color: 0x66f7ff, emissive: 0x00e5ff, emissiveIntensity: 2.2 });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); car.add(m); return m; };
    add(new THREE.BoxGeometry(4.2, 1.8, 0.62), body, 0, 0, 0.62);
    add(new THREE.BoxGeometry(1.3, 1.74, 0.34), body, 1.4, 0, 1.0);
    add(new THREE.BoxGeometry(2.1, 1.62, 0.55), glass, -0.4, 0, 1.2);
    const wg = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 16);
    [[1.4, 0.88], [1.4, -0.88], [-1.3, 0.88], [-1.3, -0.88]].forEach(([x, y]) => add(wg, wheel, x, y, 0.34));
    const lg = new THREE.BoxGeometry(0.1, 0.4, 0.2);
    [0.6, -0.6].forEach((y) => add(lg, lamp, 2.12, y, 0.78));
    const spot = new THREE.SpotLight(0x66f7ff, 3 * lightK, 26, Math.PI / 5, 0.6, 1);
    spot.position.set(2.2, 0, 0.9); spot.target.position.set(12, 0, 0.3);
    const glow = new THREE.PointLight(0x00e5ff, 1.2 * lightK, 12, 2); glow.position.set(2.4, 0, 1);
    car.add(spot, spot.target, glow);
    car.traverse((o) => { if (o.isMesh) { o.renderOrder = 12; o.material.transparent = true; } });
    return car;
  }

  /* Varre um perfil 2D (x absoluto, altura ao longo da normal) por todas as seções da rampa. */
  function sweepGeometry(frames, profile, withUV) {
    const pos = [], uvs = [], idx = []; let vtx = 0;
    for (let j = 0; j < profile.length - 1; j++) {
      const a = profile[j], b = profile[j + 1], start = vtx;
      frames.forEach((f) => {
        pos.push(a[0], f.base.y + f.n.y * a[1], f.base.z + f.n.z * a[1]);
        pos.push(b[0], f.base.y + f.n.y * b[1], f.base.z + f.n.z * b[1]);
        if (withUV) uvs.push(0, f.v, 1, f.v);
        vtx += 2;
      });
      for (let k = 0; k < frames.length - 1; k++) { const i0 = start + k * 2; idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (withUV) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  function makeRampTexture(renderer) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#1a2332'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 600; i++) { g.fillStyle = 'rgba(255,255,255,' + Math.random() * 0.05 + ')'; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    g.fillStyle = 'rgba(180,200,230,.18)'; for (let y = 10; y < 256; y += 32) g.fillRect(24, y, 208, 6); // listras de atrito
    g.fillStyle = '#facc15'; g.fillRect(8, 0, 8, 256); g.fillRect(240, 0, 8, 256); // bordas
    g.fillStyle = 'rgba(255,255,255,.85)'; for (let y = 0; y < 256; y += 64) g.fillRect(126, y, 5, 36); // eixo tracejado
    const t = new THREE.CanvasTexture(c);
    setTexSRGB(t); t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  /* Rampa 3D derivada das amostras da curva: piso + muretas + frisos ciano. */
  function buildRamp(model, rect, renderer) {
    const { P, Tg, rampIdx } = model, ids = [];
    for (let i = rampIdx[0]; i < rampIdx[1]; i += 3) ids.push(i);
    ids.push(rampIdx[1]);
    const frames = []; let run = 0;
    ids.forEach((i, k) => {
      const p = P[i], t = Tg[i];
      if (k) run += Math.hypot(p.y - P[ids[k - 1]].y, p.z - P[ids[k - 1]].z);
      frames.push({ base: new THREE.Vector3(0, p.y, p.z - LIFT), n: new THREE.Vector3(0, t.z, -t.y).normalize(), v: run / 5 });
    });
    const x0 = rect.x0, x1 = rect.x1, h = WALL_H, t = WALL_T, group = new THREE.Group();
    const floorMat = new THREE.MeshBasicMaterial({ map: makeRampTexture(renderer), side: THREE.DoubleSide });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0d1626, emissive: 0x0a1830, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide });
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide });
    group.add(new THREE.Mesh(sweepGeometry(frames, [[x0, 0], [x1, 0]], true), floorMat));
    group.add(new THREE.Mesh(sweepGeometry(frames, [[x0, 0], [x0, h], [x0 - t, h], [x0 - t, 0]], false), wallMat));
    group.add(new THREE.Mesh(sweepGeometry(frames, [[x1, 0], [x1, h], [x1 + t, h], [x1 + t, 0]], false), wallMat));
    group.add(new THREE.Mesh(sweepGeometry(frames, [[x0 + 0.01, h - 0.32], [x0 + 0.01, h - 0.12]], false), neonMat));
    group.add(new THREE.Mesh(sweepGeometry(frames, [[x1 - 0.01, h - 0.32], [x1 - 0.01, h - 0.12]], false), neonMat));
    return group;
  }

  /* ---------- cenário extrudado a partir do mapa (pilares, caixas, vagas, paredes) ---------- */
  function mulberry(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function buildCenario(mapa, vagaId) {
    const g = new THREE.Group(), ss = mapa.subsolo, zS = -GAP;
    const dummy = new THREE.Object3D();

    // pilares (grade de 8,40 m) — do piso do SS1 até a laje
    const pil = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.7, GAP), new THREE.MeshStandardMaterial({ color: 0x4d5663, roughness: 0.95 }), ss.pilares.length);
    ss.pilares.forEach(([x, y], i) => { dummy.position.set(x, y, zS + GAP / 2); dummy.updateMatrix(); pil.setMatrixAt(i, dummy.matrix); });
    g.add(pil);

    // caixas (núcleos, foyer, reservatório, estética, bicicletário...)
    const cores = { ciano: 0x153a5c, verde: 0x14502f, escura: 0x0a0f18 };
    ss.caixas.forEach((c) => {
      if (c.cor === 'ev') return;
      const w = c.x1 - c.x0, d = c.y1 - c.y0, h = c.cor === 'ciano' ? GAP * 0.92 : GAP * 0.6;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), new THREE.MeshStandardMaterial({ color: cores[c.cor] || 0x153a5c, roughness: 0.7, transparent: true, opacity: 0.82 }));
      m.position.set((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, zS + h / 2); m.renderOrder = 1.5; g.add(m);
    });

    // paredes: perímetro do SS1 e do prédio do Térreo
    const wall = (x0, y0, x1, y1, z0, h, color, op, order) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(x1 - x0, 0.5), Math.max(y1 - y0, 0.5), h),
        new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: true, opacity: op }));
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z0 + h / 2); m.renderOrder = order; g.add(m);
    };
    const L = ss.laje, wt = 0.6;
    [[L.x0, L.y0, L.x1, L.y0 + wt], [L.x0, L.y1 - wt, L.x1, L.y1], [L.x0, L.y0, L.x0 + wt, L.y1], [L.x1 - wt, L.y0, L.x1, L.y1]]
      .forEach((r) => wall(r[0], r[1], r[2], r[3], zS, GAP, 0x48566a, 0.9, 1.5));
    const p = mapa.terreo.predio[0];
    if (p) {
      const hh = 4.5, tt = 0.8;
      [[p.x0, p.y0, p.x1, p.y0 + tt], [p.x0, p.y1 - tt, p.x1, p.y1], [p.x0, p.y0, p.x0 + tt, p.y1], [p.x1 - tt, p.y0, p.x1, p.y1]]
        .forEach((r) => wall(r[0], r[1], r[2], r[3], 0, hh, 0xe8e0cf, 0.2, 6));
    }

    // carros estacionados (cenário) — InstancedMesh com cor por instância
    const rnd = mulberry(20261112), vagas = ss.vagas.filter((v) => v.id !== vagaId && rnd() < (v.tipo === 'ev' ? 0.35 : OCUPACAO));
    const palette = [0xb8bcc4, 0x2a2f38, 0xd9dde3, 0x7a1f26, 0x1d3b6e, 0x4a5a48, 0x8b7b5a, 0x50555e].map((c) => new THREE.Color(c));
    const bodyI = new THREE.InstancedMesh(new THREE.BoxGeometry(1.74, 4.0, 0.62), new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.4 }), vagas.length);
    const cabI = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 2.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x10151d, roughness: 0.3, metalness: 0.3 }), vagas.length);
    vagas.forEach((v, i) => {
      const dy = (rnd() - 0.5) * 0.4;
      dummy.rotation.set(0, 0, 0); dummy.position.set(v.x, v.y + dy, zS + 0.55); dummy.updateMatrix(); bodyI.setMatrixAt(i, dummy.matrix);
      bodyI.setColorAt(i, palette[(rnd() * palette.length) | 0]);
      dummy.position.set(v.x, v.y + dy - 0.1, zS + 1.08); dummy.updateMatrix(); cabI.setMatrixAt(i, dummy.matrix);
    });
    [bodyI, cabI].forEach((m) => { m.renderOrder = 1.4; g.add(m); });
    return g;
  }

  /* Vaga pedida -> posição no mapa. Código que o mapa não tem (ex.: B-201 do banco) usa a N-ésima vaga
   * convencional, de forma determinística, e mantém o código pedido para exibir na tela. */
  function acharVaga(mapa, codigo) {
    let bay = mapa.subsolo.vagas.find((v) => v.id === codigo);
    if (!bay) {
      const conv = mapa.subsolo.vagas.filter((v) => v.tipo !== 'ev').sort((a, b) => (a.id < b.id ? -1 : 1));
      bay = conv[(parseInt(String(codigo).replace(/\D/g, ''), 10) || 1) % conv.length];
      console.warn('[estacia3d] vaga ' + codigo + ' não existe no mapa extraído; usando ' + bay.id + ' como posição.');
    }
    return Object.assign({}, bay, { codigo });
  }

  window.Estacia3D = {
    init: (T) => { THREE = T; },
    VAGA_PADRAO, GAP, LIFT, RAMPA_EASE, WALL_H, WALL_T, OCUPACAO,
    pedirVaga,
    clamp,
    criarConversores,
    decodificarGrade,
    MIN_CLEAR,
    D8,
    Heap,
    celulaLivreMaisProxima,
    aEstrela,
    linhaLivre,
    simplificar,
    douglasPeucker,
    colapsarCurtos,
    buildPoints,
    rampProfile,
    idxOf,
    sampleAt,
    setTexSRGB,
    placeholderTexture,
    planeWithHole,
    makeFloor,
    makeLabel,
    makeRing,
    buildCar,
    sweepGeometry,
    makeRampTexture,
    buildRamp,
    mulberry,
    buildCenario,
    acharVaga,
  };
})();
