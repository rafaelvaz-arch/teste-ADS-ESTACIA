/* =============================================================================
 * js/navegacao.jsx — ADS-ESTACIA
 * Navegação 3D estilo GPS (Waze / Google Maps) até a vaga A-145, Subsolo SS1.
 *
 * Dependências globais (carregadas no navegacao.html): React 18, ReactDOM 18,
 * THREE r128 e THREE.OrbitControls. O arquivo ESPERA por elas (polling), então
 * não quebra por ordem de carregamento nem por CDN lento; se faltar algo, mostra
 * uma mensagem clara em vez de tela em branco.
 *
 * Convenção de eixos: Z = ALTURA (camera.up = +Z). Planos em XY, sem rotação.
 *   X = leste, Y = norte, Térreo em Z = +12, SS1 em Z = -12.
 *
 * ---------------------------------------------------------------------------
 * MATEMÁTICA DA CÂMERA GPS (modo "GPS 3D")
 * ---------------------------------------------------------------------------
 * Seja P a posição do carro em u (parâmetro por comprimento de arco da curva)
 * e T(u) a tangente unitária. Só usamos a projeção XY da tangente, porque a
 * rampa é quase vertical e o pitch faria a câmera "capotar".
 *
 *  1) Rumo suavizado (ĥ):   alvo = normalize( 0.4·T(u).xy + 0.6·T(u+Δ).xy )
 *     O termo T(u+Δ) olha ALGUNS METROS À FRENTE, então a câmera começa a girar
 *     antes da curva (antecipação), como no Waze. Depois:
 *         ĥ ← normalize( ĥ + (alvo − ĥ)·(1 − e^(−λ·dt)) )
 *     A forma (1 − e^(−λ·dt)) é um filtro passa-baixa independente de FPS:
 *     o mesmo comportamento a 30, 60 ou 120 fps.
 *
 *  2) Intensidade da curva (κ ∈ [0,1]):  κ = clamp( ∠(T(u), T(u+Δ₂)) / 90° )
 *     Em curvas fechadas a câmera afasta e sobe um pouco (mais contexto).
 *
 *  3) Pose desejada da câmera (3ª pessoa inclinada):
 *         C = P − ĥ·B + ẑ·H          B = B₀ + 3κ      H = H₀ + 4κ
 *         L = P + ĥ·A + ẑ·0.6        A = A₀ − 2κ      (ponto para onde olha)
 *     L fica À FRENTE do carro, então o carro aparece no terço inferior da
 *     tela e há mais mapa visível na direção do movimento.
 *
 *  4) Seguimento com atraso elástico (efeito de "mola"):
 *         camera.position ← lerp(camera.position, C, 1 − e^(−k·dt))
 *         controls.target ← lerp(controls.target, L, 1 − e^(−k'·dt))
 *     k cresce de ~2 para ~7 em ~1,2 s (variável `boost`): a troca de modo
 *     (Visão geral → GPS 3D) é um voo suave, e depois a câmera "cola" no carro.
 *
 *  5) Visão geral (2D): câmera quase vertical sobre o centro. Distância para
 *     enquadrar o mapa inteiro, dado FOV vertical φ=40° e aspect a:
 *         d = max( (H/2)/tan(φ/2) , (W/2)/(tan(φ/2)·a) ) · 1.12
 *     (H=38, W=56 são as dimensões do plano). O máximo entre altura e largura
 *     garante que caiba tanto em retrato (celular) quanto em paisagem.
 *
 *  6) Foco de pavimento: o Térreo (0.88) fica quase transparente (0.10) quando
 *     o carro desce, para a câmera/vista enxergarem o SS1 sem "atravessar" um
 *     plano opaco. Interpolação smoothstep entre Z=11 e Z=5.
 *
 * ---------------------------------------------------------------------------
 * RAMPA 3D, PITCH DO CARRO E PITCH DA CÂMERA
 * ---------------------------------------------------------------------------
 *  7) Perfil vertical da rampa (curvas côncava/convexa nas pontas). Com t∈[0,1]
 *     ao longo do trecho R0→R1 e fração de ponta E=0.2, a inclinação é
 *     0 → s → 0 (parábola, reta, parábola) com s = 1/(1−E), de modo que
 *         z(t) = Z_T + (Z_S − Z_T)·g(t),   g(0)=0, g(1)=1, g' contínua.
 *     Sem esse "arredondamento" o carro quebraria o pitch de 0° para a
 *     inclinação máxima de uma só vez, no primeiro frame da rampa.
 *
 *  8) A malha da rampa é construída DAS PRÓPRIAS AMOSTRAS DA CURVA: cada seção
 *     transversal usa o ponto p(u), o piso = p.z − LIFT, e a normal da pista
 *         n = normalize(0, T.z, −T.y)      (T = tangente; n.z > 0)
 *     Assim o carro, que usa o mesmo p(u), assenta exatamente na superfície e
 *     as muretas (varredura de um perfil retangular ao longo de n) acompanham
 *     a inclinação. O plano do Térreo ganha um "buraco" (THREE.Shape + hole)
 *     sobre a rampa; sem ele o plano cobriria a rampa por cima.
 *
 *  9) Pitch do carro = ângulo REAL da tangente, φ = atan2(T.z, |T.xy|). O
 *     referencial do carro é (frente = T, esquerda = ẑ×T, topo = T×esquerda),
 *     então ele aponta para baixo na descida e volta ao plano ao fim da curva
 *     vertical. Abaixo de |T.xy| < 0.06 usamos o último rumo válido (evita a
 *     degenerescência de uma tangente vertical).
 *
 * 10) Pitch da câmera: φ_cam é a média do pitch atual e do pitch à frente,
 *     filtrada (passa-baixa). A câmera usa um referencial INCLINADO por
 *     ψ = 0.45·φ_cam:   f = (cosψ·ĥ, sinψ),  n = (−sinψ·ĥ, cosψ)
 *         C = P − f·B + n·H        L = P + f·A + n·0.6
 *     Com ψ<0 (descida) a câmera sobe e olha para baixo, mantendo o carro e a
 *     pista do SS1 no enquadramento. Em rampa MUITO íngreme (|φ| > ~40°) a
 *     face da pista fica de costas para uma câmera atrás do carro; então
 *     misturamos (smoothstep de 40° a 72°) com uma pose LATERAL:
 *         C_lat = P + r̂·7 − ĥ·2.5 + ẑ·2.2,   r̂ = (ĥ.y, −ĥ.x)   (direita)
 *     que enxerga o perfil do carro descendo pela rampa.
 * ========================================================================== */
(function () {
  'use strict';

  /* ---- React é a única dependência exigida já na carga do arquivo ---- */
  if (!window.React || !window.ReactDOM) {
    const el = document.getElementById('root');
    if (el) el.textContent = 'Falha ao carregar o React. Verifique a conexão e recarregue a página.';
    return;
  }
  const { useState, useEffect, useRef, useCallback } = React;

  /* THREE / OrbitControls só são lidos DEPOIS de waitForDeps() (ver bootstrap). */
  let THREE = null;
  let OrbitControls = null;

  /* ======================================================================== */
  /* CONFIGURAÇÃO                                                             */
  /* ======================================================================== */
  const PLANE_W = 56, PLANE_H = 38;
  const Z_T = 12.0, Z_S = -12.0;
  const LIFT = 0.35; // rota/veículo acima do piso (evita z-fighting)
  const IMG_W = 1280, IMG_H = 720;
  const TEXTURES = { terreo: 'assets/planta_terreo.png', subsolo: 'assets/planta_subsolo.png' };

  const VAGA = { codigo: 'A-145', pavimento: 'Subsolo SS1' }; // vaga de teste (mock)
  const BACK_URL = 'setores.html';
  const FINISH_URL = 'checkin.html'; // leitura do QR Code do ticket
  const DESTINO_KEY = 'estacia_vaga_destino'; // lido pelo checkin.html

  /* Escala de "mundo" -> metros (ESTIMATIVA; calibre com a planta real). */
  const M_PER_UNIT = 3.2; // 1 unidade XY ≈ 3,2 m
  const RAMP_M_PER_Z = 1.6; // cada unidade de queda em Z soma ≈ 1,6 m de rampa
  const REAL_SPEED = 4.0; // m/s ≈ 14 km/h (velocidade "real" usada no ETA)

  const CORNER_R = 1.3;
  const TUBE_R = 0.1, TUBE_SEGS = 700, TUBE_RADIAL = 8;
  const SAMPLES = 900; // resolução das tabelas distância/tempo
  const FAR_M = 60; // acima disso o HUD diz "Siga reto"
  const FADE_TOP = 0.88, FADE_LOW = 0.1;
  const CAM_MIN_Z_OVERVIEW = 14; // na visão geral a câmera não desce abaixo do Térreo
  const CHASE = { back: 9, height: 6.5, ahead: 7, look: 6, curveLook: 11, tilt: 0.45, sideFrom: 0.7, sideTo: 1.25, side: 7, sideLead: 1.2 };
  const SPEEDS = [1, 2, 4];

  /* Rampa central (retângulo demarcado nas plantas, em px). O trecho em declive
   * vai de RAMP_TOP_PX (topo, Z do Térreo) a RAMP_BASE_PX (base, Z do SS1). */
  const RAMP_X0_PX = 473, RAMP_X1_PX = 528; // largura do retângulo
  const RAMP_TOP_PX = 572, RAMP_BASE_PX = 636, RAMP_HOLE_BOTTOM_PX = 642;
  const RAMP_EASE = 0.2; // fração de cada ponta com curva vertical
  const RAMP_STEPS = 28; // pontos de controle da curva dentro da rampa
  const RAMP_TILE = 2.0; // comprimento (unid.) de um "ladrilho" da textura
  const RAMP_COLOR = '#1a2332';
  const WALL_H = 0.4, WALL_T = 0.18; // muretas laterais

  /* Nós do grafo (px das plantas 1280×720). Ajuste aqui se a rota sair da pista. */
  const px = (x, y, z) => ({ x: (x / IMG_W - 0.5) * PLANE_W, y: (0.5 - y / IMG_H) * PLANE_H, z: z + LIFT });
  const NODES = [
    px(1095, 598, Z_T), //  0 origem: pista inferior direita do Térreo
    px(572, 598, Z_T), //   1 curva para o norte
    px(572, 553, Z_T), //   2 jog
    px(488, 553, Z_T), //   3 curva para a rampa (ainda plano)
    px(488, RAMP_TOP_PX, Z_T), //   4 R0: topo da rampa (início do declive)
    px(488, RAMP_BASE_PX, Z_S), //  5 R1: base da rampa, já no SS1
    px(488, 650, Z_S), //   6 saída da rampa
    px(620, 650, Z_S), //   7 corredor central
    px(620, 168, Z_S), //   8 cruzamento com a Alameda Norte
    px(440, 168, Z_S), //   9 entrada da fileira da vaga
    px(440, 214, Z_S), //  10 vaga A-145
  ];
  const I_R0 = 4, I_R1 = 5;

  /* Manobras do turn-by-turn. {dir} e o ícone "turn" saem da GEOMETRIA (produto
   * vetorial), então o texto nunca contradiz o desenho da rota. */
  const ACTION_DEFS = [
    { node: 1, icon: 'turn', text: 'Vire à {dir} e siga até a rampa' },
    { node: 3, icon: 'ramp', text: 'Vire à {dir} e desça a rampa para o Subsolo SS1' },
    { node: 6, icon: 'turn', text: 'Ao sair da rampa, vire à {dir}' },
    { node: 7, icon: 'turn', text: 'Vire à {dir} no corredor central' },
    { node: 8, icon: 'turn', text: 'Na Alameda Norte, vire à {dir}' },
    { node: 9, icon: 'turn', text: 'Vire à {dir} e estacione na Vaga ' + VAGA.codigo },
  ];

  /* ======================================================================== */
  /* ROTA: geometria, tabelas de distância/tempo e manobras                   */
  /* ======================================================================== */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const turnCross = (a, b, c) => (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x); // >0 = esquerda

  /* Curvas de 90° arredondadas + densificação (evita overshoot da Catmull-Rom). */
  function buildPoints(nodes, radius, step) {
    const V = (n) => new THREE.Vector3(n.x, n.y, n.z);
    const out = [];
    const push = (v) => { if (!out.length || out[out.length - 1].distanceTo(v) > 1e-4) out.push(v); };
    push(V(nodes[0]));
    for (let i = 1; i < nodes.length - 1; i++) {
      const prev = V(nodes[i - 1]), cur = V(nodes[i]), next = V(nodes[i + 1]);
      const d1 = new THREE.Vector2(cur.x - prev.x, cur.y - prev.y);
      const d2 = new THREE.Vector2(next.x - cur.x, next.y - cur.y);
      const l1 = d1.length(), l2 = d2.length();
      if (l1 < 1e-3 || l2 < 1e-3) { push(cur); continue; }
      d1.normalize(); d2.normalize();
      if (d1.dot(d2) > 0.999) { push(cur); continue; }
      const r = Math.min(radius, l1 * 0.5, l2 * 0.5);
      const a = cur.clone().lerp(prev, r / cur.distanceTo(prev));
      const b = cur.clone().lerp(next, r / cur.distanceTo(next));
      push(a);
      for (let k = 1; k < 8; k++) {
        const t = k / 8;
        push(new THREE.Vector3().addScaledVector(a, (1 - t) * (1 - t)).addScaledVector(cur, 2 * (1 - t) * t).addScaledVector(b, t * t));
      }
      push(b);
    }
    push(V(nodes[nodes.length - 1]));
    const dense = [out[0]];
    for (let i = 1; i < out.length; i++) {
      const a = out[i - 1], b = out[i];
      const n = Math.floor(a.distanceTo(b) / step);
      for (let j = 1; j <= n; j++) { const p = a.clone().lerp(b, j / (n + 1)); if (p.distanceTo(b) > 1e-3) dense.push(p); }
      dense.push(b);
    }
    return dense;
  }

  /* Perfil vertical g(t) da rampa: parábola–reta–parábola, derivada contínua. */
  function rampProfile(t) {
    const E = RAMP_EASE, k = 1 / (1 - E);
    if (t < E) return (k * t * t) / (2 * E);
    if (t <= 1 - E) return k * (E / 2 + (t - E));
    const r = 1 - t;
    return 1 - (k * r * r) / (2 * E);
  }
  function rampPoints(a, b, count) {
    const out = [];
    for (let k = 1; k < count; k++) {
      const t = k / count;
      out.push(new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * rampProfile(t)));
    }
    return out;
  }

  /* Índice fracionário onde arr (não decrescente) atinge v. */
  function idxOf(arr, v) {
    let lo = 0, hi = arr.length - 1;
    if (v <= arr[0]) return 0;
    if (v >= arr[hi]) return hi;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (arr[mid] <= v) lo = mid; else hi = mid; }
    const d = arr[hi] - arr[lo];
    return lo + (d > 1e-9 ? (v - arr[lo]) / d : 0);
  }
  function sampleAt(arr, idx) {
    const i = Math.floor(idx), j = Math.min(arr.length - 1, i + 1);
    return arr[i] + (arr[j] - arr[i]) * (idx - i);
  }

  /* Pré-computa: curva, metros acumulados (cumM) e tempo acumulado (cumT).
   * A velocidade cai em curvas, na rampa e na aproximação final da vaga. Como
   * a simulação avança por TEMPO, o carro desacelera de verdade e o ETA mostrado
   * (totalT − t) é coerente com o que o usuário vê. */
  function buildModel() {
    // Térreo (com curvas) + rampa (perfil suave, sem arredondar) + SS1 (com curvas)
    const head = buildPoints(NODES.slice(0, I_R0 + 1), CORNER_R, 2.5);
    const mid = rampPoints(NODES[I_R0], NODES[I_R1], RAMP_STEPS);
    const tail = buildPoints(NODES.slice(I_R1), CORNER_R, 2.5);
    const pts = [];
    [head, mid, tail].forEach((arr) => arr.forEach((p) => { if (!pts.length || pts[pts.length - 1].distanceTo(p) > 1e-4) pts.push(p); }));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const N = SAMPLES;
    const P = [], Tg = [];
    for (let i = 0; i <= N; i++) { P.push(curve.getPointAt(i / N)); Tg.push(curve.getTangentAt(i / N)); }

    const K = 36; // janela (amostras) para medir a intensidade da curva
    const turn = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const a = Tg[i], b = Tg[Math.min(N, i + K)];
      const la = Math.hypot(a.x, a.y), lb = Math.hypot(b.x, b.y);
      if (la < 1e-4 || lb < 1e-4) continue;
      const dot = (a.x * b.x + a.y * b.y) / (la * lb);
      turn[i] = clamp(Math.acos(clamp(dot, -1, 1)) / (Math.PI / 2), 0, 1);
    }

    const cumM = new Float32Array(N + 1), cumT = new Float32Array(N + 1);
    const dm = new Float32Array(N + 1), slope = new Float32Array(N + 1);
    for (let i = 1; i <= N; i++) {
      const dxy = Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y) * M_PER_UNIT;
      const dz = Math.abs(P[i].z - P[i - 1].z) * RAMP_M_PER_Z;
      dm[i] = dxy + dz;
      slope[i] = dm[i] > 0 ? dz / dm[i] : 0;
      cumM[i] = cumM[i - 1] + dm[i];
    }
    const total = cumM[N];
    for (let i = 1; i <= N; i++) {
      const end = clamp((total - cumM[i]) / 12, 0.35, 1); // freia nos últimos ~12 m
      let v = REAL_SPEED * (1 - 0.55 * turn[i]) * end;
      if (slope[i] > 0.3) v *= 0.75; // rampa
      cumT[i] = cumT[i - 1] + dm[i] / Math.max(v, 0.3);
    }

    // Manobras: posição (em metros) = ponto da curva mais próximo de cada nó.
    let from = 0;
    const markM = (n) => {
      const nv = new THREE.Vector3(n.x, n.y, n.z);
      let best = Infinity, bi = from;
      for (let i = from; i <= N; i++) { const d = P[i].distanceToSquared(nv); if (d < best) { best = d; bi = i; } }
      from = bi;
      return cumM[bi];
    };
    const actions = ACTION_DEFS.map((def) => {
      const left = turnCross(NODES[def.node - 1], NODES[def.node], NODES[def.node + 1]) > 0;
      return {
        icon: def.icon === 'turn' ? (left ? 'left' : 'right') : def.icon,
        text: def.text.replace('{dir}', left ? 'esquerda' : 'direita'),
        m: markM(NODES[def.node]),
      };
    });
    actions.push({ icon: 'park', text: 'Estacione na Vaga ' + VAGA.codigo + ', logo à frente', m: total });

    // Amostras que delimitam a rampa + inclinação máxima (para a malha e para o aviso)
    const nearest = (n) => {
      const nv = new THREE.Vector3(n.x, n.y, n.z);
      let best = Infinity, bi = 0;
      for (let i = 0; i <= N; i++) { const d = P[i].distanceToSquared(nv); if (d < best) { best = d; bi = i; } }
      return bi;
    };
    const rampIdx = [nearest(NODES[I_R0]), nearest(NODES[I_R1])];
    let maxDeg = 0;
    for (let i = rampIdx[0]; i <= rampIdx[1]; i++) {
      maxDeg = Math.max(maxDeg, Math.abs(Math.atan2(Tg[i].z, Math.hypot(Tg[i].x, Tg[i].y))) * 180 / Math.PI);
    }
    if (maxDeg > 60) {
      console.warn('[navegacao] A rampa tem inclinação máxima de ~' + Math.round(maxDeg) + '° (queda de ' +
        Math.abs(Z_T - Z_S) + ' em ~' + (Math.abs(NODES[I_R1].y - NODES[I_R0].y)).toFixed(1) +
        ' de percurso). Para uma rampa mais suave, aproxime os pavimentos (Z_T/Z_S).');
    }

    return { curve, pts, N, cumM, cumT, total, totalT: cumT[N], actions, P, Tg, rampIdx, maxDeg };
  }

  /* ======================================================================== */
  /* HELPERS THREE.JS                                                         */
  /* ======================================================================== */
  const setTexSRGB = (t) => { if ('colorSpace' in t) t.colorSpace = THREE.SRGBColorSpace; else t.encoding = THREE.sRGBEncoding; };

  function placeholderTexture(label) {
    const c = document.createElement('canvas'); c.width = IMG_W; c.height = IMG_H;
    const g = c.getContext('2d');
    g.fillStyle = '#1b2430'; g.fillRect(0, 0, IMG_W, IMG_H);
    g.strokeStyle = 'rgba(120,160,200,.18)';
    for (let x = 0; x <= IMG_W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, IMG_H); g.stroke(); }
    for (let y = 0; y <= IMG_H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(IMG_W, y); g.stroke(); }
    g.fillStyle = 'rgba(200,225,255,.5)'; g.font = 'bold 46px sans-serif'; g.textAlign = 'center';
    g.fillText(label, IMG_W / 2, IMG_H / 2);
    const t = new THREE.CanvasTexture(c); setTexSRGB(t); return t;
  }

  function makeFloor(url, label, z, opacity, order, renderer, geometry) {
    const mat = new THREE.MeshBasicMaterial({
      map: placeholderTexture(label + ' (carregando…)'), transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry || new THREE.PlaneGeometry(PLANE_W, PLANE_H), mat);
    mesh.position.set(0, 0, z); mesh.renderOrder = order;
    new THREE.TextureLoader().load(url, (tex) => {
      setTexSRGB(tex); tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      mat.map = tex; mat.needsUpdate = true;
    }, undefined, () => console.warn('[navegacao] textura não carregou:', url));
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 }));
    frame.position.copy(mesh.position); frame.renderOrder = order + 0.5;
    return { mesh, mat, frame };
  }

  function makeLabel(text, color, sx, sy) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(8,16,28,.85)'; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(3, 3, 506, 122);
    g.fillStyle = color; g.font = 'bold 54px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 67);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    sp.scale.set(sx, sy, 1); sp.renderOrder = 20; return sp;
  }

  const makeRing = (color, a, b) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(a, b, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
    m.renderOrder = 8; return m;
  };

  /* Plano do Térreo com abertura sobre a rampa (UV remapeado para a textura). */
  function planeWithHole(h) {
    const hw = PLANE_W / 2, hh = PLANE_H / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-hw, -hh); shape.lineTo(hw, -hh); shape.lineTo(hw, hh); shape.lineTo(-hw, hh); shape.lineTo(-hw, -hh);
    const hole = new THREE.Path();
    hole.moveTo(h.x0, h.y1); hole.lineTo(h.x0, h.y0); hole.lineTo(h.x1, h.y0); hole.lineTo(h.x1, h.y1); hole.lineTo(h.x0, h.y1);
    shape.holes.push(hole);
    const g = new THREE.ShapeGeometry(shape);
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / PLANE_W + 0.5, pos.getY(i) / PLANE_H + 0.5);
    uv.needsUpdate = true;
    return g;
  }

  /* Asfalto escuro, bordas amarelas, eixo tracejado e listras de atrito. */
  function makeRampTexture(renderer) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = RAMP_COLOR; g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.05) + ')'; g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2); }
    g.fillStyle = 'rgba(180,200,230,.16)'; for (let y = 8; y < 256; y += 32) g.fillRect(14, y, 100, 5); // atrito
    g.fillStyle = '#facc15'; g.fillRect(5, 0, 5, 256); g.fillRect(118, 0, 5, 256); // bordas
    g.fillStyle = 'rgba(255,255,255,.85)'; for (let y = 0; y < 256; y += 64) g.fillRect(62, y, 4, 36); // eixo
    const t = new THREE.CanvasTexture(c);
    setTexSRGB(t); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  /* Varre um perfil 2D (x absoluto, altura ao longo da normal) por todas as seções. */
  function sweepGeometry(frames, profile, withUV) {
    const pos = [], uvs = [], idx = [];
    let vtx = 0;
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

  /* Rampa 3D: piso + muretas + frisos ciano, tudo derivado das amostras da curva. */
  function buildRamp(model, renderer) {
    const { P, Tg, rampIdx } = model;
    const x0 = px(RAMP_X0_PX, 0, 0).x, x1 = px(RAMP_X1_PX, 0, 0).x;
    const ids = [];
    for (let i = rampIdx[0]; i < rampIdx[1]; i += 3) ids.push(i);
    ids.push(rampIdx[1]);
    const frames = [];
    let run = 0;
    ids.forEach((i, k) => {
      const p = P[i], t = Tg[i];
      if (k) run += Math.hypot(p.y - P[ids[k - 1]].y, p.z - P[ids[k - 1]].z);
      frames.push({ base: new THREE.Vector3(0, p.y, p.z - LIFT), n: new THREE.Vector3(0, t.z, -t.y).normalize(), v: run / RAMP_TILE });
    });

    const group = new THREE.Group();
    const floorMat = new THREE.MeshBasicMaterial({ map: makeRampTexture(renderer), side: THREE.DoubleSide });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0d1626, emissive: 0x0a1830, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide });
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide });
    const h = WALL_H, t = WALL_T;
    group.add(new THREE.Mesh(sweepGeometry(frames, [[x0, 0], [x1, 0]], true), floorMat));
    group.add(new THREE.Mesh(sweepGeometry(frames, [[x0, 0], [x0, h], [x0 - t, h], [x0 - t, 0]], false), wallMat));
    group.add(new THREE.Mesh(sweepGeometry(frames, [[x1, 0], [x1, h], [x1 + t, h], [x1 + t, 0]], false), wallMat));
    group.add(new THREE.Mesh(sweepGeometry(frames, [[x0 + 0.005, h - 0.14], [x0 + 0.005, h - 0.06]], false), neonMat));
    group.add(new THREE.Mesh(sweepGeometry(frames, [[x1 - 0.005, h - 0.14], [x1 - 0.005, h - 0.06]], false), neonMat));
    return group;
  }

  /* Carro estilizado: frente +X, esquerda +Y, topo +Z. */
  function buildCar(lightK) {
    const car = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: 0x1f6bff, metalness: 0.75, roughness: 0.28 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0a1020, metalness: 0.3, roughness: 0.15 });
    const wheel = new THREE.MeshStandardMaterial({ color: 0x0d0f14, roughness: 0.9 });
    const lamp = new THREE.MeshStandardMaterial({ color: 0x66f7ff, emissive: 0x00e5ff, emissiveIntensity: 2.2 });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); car.add(m); return m; };
    add(new THREE.BoxGeometry(1.3, 0.6, 0.22), body, 0, 0, 0.24);
    add(new THREE.BoxGeometry(0.4, 0.56, 0.12), body, 0.45, 0, 0.4);
    add(new THREE.BoxGeometry(0.62, 0.5, 0.22), glass, -0.12, 0, 0.46);
    const wg = new THREE.CylinderGeometry(0.13, 0.13, 0.12, 14); // eixo Y = largura
    [[0.42, 0.31], [0.42, -0.31], [-0.42, 0.31], [-0.42, -0.31]].forEach(([x, y]) => add(wg, wheel, x, y, 0.13));
    const lg = new THREE.BoxGeometry(0.06, 0.14, 0.07);
    [0.2, -0.2].forEach((y) => add(lg, lamp, 0.66, y, 0.3));
    const spot = new THREE.SpotLight(0x66f7ff, 3 * lightK, 9, Math.PI / 5, 0.6, 1);
    spot.position.set(0.7, 0, 0.32); spot.target.position.set(4, 0, 0.1);
    const glow = new THREE.PointLight(0x00e5ff, 1.2 * lightK, 4, 2); glow.position.set(0.8, 0, 0.35);
    car.add(spot, spot.target, glow);
    car.traverse((o) => { if (o.isMesh) { o.renderOrder = 10; o.material.transparent = true; } });
    return car;
  }

  const hasFsApi = () => !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  const safeStore = (k, v) => { try { window.sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* modo privado */ } };

  /* Navegação segura: usa history.back() só quando o referrer é a tela esperada
   * (não cria laço de histórico); senão assign() (preserva o botão voltar). */
  function safeBack(fallback) {
    try {
      if (document.referrer && window.history.length > 1) {
        const u = new URL(document.referrer);
        if (u.origin === window.location.origin && /(setores|monitoramento)\.html$/.test(u.pathname)) { window.history.back(); return; }
      }
    } catch (e) { /* referrer inválido */ }
    window.location.assign(fallback);
  }

  /* ======================================================================== */
  /* UI                                                                       */
  /* ======================================================================== */
  const fmtM = (m) => (m >= 100 ? Math.round(m / 10) * 10 : m >= 20 ? Math.round(m / 5) * 5 : Math.round(m));
  const fmtT = (s) => { const t = Math.max(0, Math.round(s)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

  function Icon({ kind, size }) {
    const paths = {
      straight: 'M12 20V5 M6 11l6-6 6 6',
      left: 'M17 20v-5a4 4 0 0 0-4-4H6 M10 7l-4 4 4 4',
      right: 'M7 20v-5a4 4 0 0 1 4-4h7 M14 7l4 4-4 4',
      ramp: 'M5 5l12 12 M17 8v9H8',
      flag: 'M6 21V4 M6 4h11l-2.5 4L17 12H6',
    };
    const s = size || 40;
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {kind === 'park'
          ? (<g><circle cx="12" cy="12" r="9" /><path d="M10 17V7h3a3 3 0 0 1 0 6h-3" /></g>)
          : <path d={paths[kind] || paths.straight} />}
      </svg>
    );
  }

  function Splash({ msg, error }) {
    return (
      <div className="nv-stage nv-splash">
        <style>{CSS}</style>
        <div role={error ? 'alert' : 'status'} className={'nv-splash-box' + (error ? ' err' : '')}>
          {!error && <span className="nv-spin" />}
          <p>{error || msg}</p>
          {error && <button className="nv-btn" onClick={() => window.location.reload()}>Tentar novamente</button>}
        </div>
      </div>
    );
  }

  class ErrorBoundary extends React.Component {
    constructor(p) { super(p); this.state = { err: null }; }
    static getDerivedStateFromError(err) { return { err }; }
    componentDidCatch(err) { console.error('[navegacao]', err); }
    render() {
      if (this.state.err) return <Splash error={'Erro ao exibir a navegação: ' + (this.state.err.message || this.state.err)} />;
      return this.props.children;
    }
  }

  function Navegacao() {
    const stageRef = useRef(null);
    const mountRef = useRef(null);
    const sim = useRef({
      model: null, playing: false, t: 0, speed: 2, mode: 'overview', manual: false, boost: 0,
      arrived: false, arrivedAt: 0, dirty: true, initHeading: true,
    });

    const [meta, setMeta] = useState(null);
    const [hud, setHud] = useState(null);
    const [erro, setErro] = useState(null);
    const [mode, setModeState] = useState('overview');
    const [manual, setManual] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [started, setStarted] = useState(false);
    const [speed, setSpeed] = useState(2);
    const [stepsOpen, setStepsOpen] = useState(false);
    const [isFs, setIsFs] = useState(false);

    /* ------------------------------ Cena -------------------------------- */
    useEffect(() => {
      const mount = mountRef.current;
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      } catch (e) {
        setErro('Seu navegador/dispositivo não conseguiu iniciar o WebGL. Tente atualizar o navegador ou ativar a aceleração por hardware.');
        return undefined;
      }
      let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(pixelRatio);
      const physical = 'outputColorSpace' in renderer; // r152+ usa luzes físicas
      if (physical) renderer.outputColorSpace = THREE.SRGBColorSpace; else renderer.outputEncoding = THREE.sRGBEncoding;
      const lk = physical ? 4 : 1;
      mount.appendChild(renderer.domElement);
      renderer.domElement.style.cssText = 'display:block;touch-action:none';
      renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); setErro('A GPU interrompeu o gráfico 3D. Aguarde alguns segundos ou recarregue.'); });
      renderer.domElement.addEventListener('webglcontextrestored', () => setErro(null));

      const model = buildModel();
      sim.current.model = model;
      setMeta({ actions: model.actions, total: model.total, totalT: model.totalT });

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a1220);
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
      camera.up.set(0, 0, 1);
      camera.position.set(0, -72, 64);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true; controls.dampingFactor = 0.08; controls.screenSpacePanning = true;
      controls.minDistance = 3; controls.maxDistance = 160;
      controls.target.set(0, 0, 0); controls.update();
      controls.addEventListener('start', () => { // usuário pegou a câmera: suspende o auto-follow
        const S = sim.current;
        if (!S.manual) { S.manual = true; setManual(true); }
      });

      scene.add(new THREE.AmbientLight(0xffffff, physical ? 1.8 : 0.9));
      const sun = new THREE.DirectionalLight(0xffffff, physical ? 1.6 : 0.8); sun.position.set(20, -30, 60); scene.add(sun);

      const hole = { x0: px(RAMP_X0_PX, 0, 0).x, x1: px(RAMP_X1_PX, 0, 0).x, y1: px(0, RAMP_TOP_PX, 0).y, y0: px(0, RAMP_HOLE_BOTTOM_PX, 0).y };
      const fT = makeFloor(TEXTURES.terreo, 'TÉRREO', Z_T, FADE_TOP, 2, renderer, planeWithHole(hole));
      const fS = makeFloor(TEXTURES.subsolo, 'SUBSOLO SS1', Z_S, 0.95, 1, renderer);
      scene.add(fT.mesh, fT.frame, fS.mesh, fS.frame);
      scene.add(buildRamp(model, renderer)); // piso, muretas e frisos da rampa
      const lT = makeLabel('TÉRREO', '#7dd3fc', 7, 1.75); lT.position.set(-22, -PLANE_H / 2 - 1.8, Z_T + 0.5);
      const lS = makeLabel('SUBSOLO SS1', '#7dd3fc', 7, 1.75); lS.position.set(-22, -PLANE_H / 2 - 1.8, Z_S + 0.5);
      scene.add(lT, lS);

      // Rota: o tubo "se consome" conforme o carro avança (drawRange)
      const coreGeo = new THREE.TubeGeometry(model.curve, TUBE_SEGS, TUBE_R, TUBE_RADIAL, false);
      const glowGeo = new THREE.TubeGeometry(model.curve, TUBE_SEGS, TUBE_R * 3, TUBE_RADIAL, false);
      const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, depthTest: false }));
      const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
        color: 0x00e5ff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
      core.renderOrder = 6; glow.renderOrder = 7;
      scene.add(core, glow);
      const idxTotal = coreGeo.index.count;

      const first = NODES[0], last = NODES[NODES.length - 1];
      const startRing = makeRing(0x4ade80, 0.5, 0.75); startRing.position.set(first.x, first.y, Z_T + 0.08);
      const spotRing = makeRing(0xfacc15, 0.45, 0.7); spotRing.position.set(last.x, last.y, Z_S + 0.08);
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6, 8),
        new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.55 }));
      beacon.rotation.x = Math.PI / 2; beacon.position.set(last.x, last.y, Z_S + 3); beacon.renderOrder = 8;
      const lblSpot = makeLabel(VAGA.codigo, '#facc15', 3.6, 0.9); lblSpot.position.set(last.x, last.y, Z_S + 6.6);
      const bursts = [makeRing(0x4ade80, 0.6, 0.75), makeRing(0x4ade80, 0.6, 0.75)];
      bursts.forEach((b) => { b.position.set(last.x, last.y, Z_S + 0.1); b.visible = false; });
      scene.add(startRing, spotRing, beacon, lblSpot, ...bursts);

      const car = buildCar(lk);
      scene.add(car);

      /* ------------------------- Resize ----------------------------- */
      const resize = () => {
        const w = Math.max(mount.clientWidth, 1), h = Math.max(mount.clientHeight, 1);
        camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
      };
      resize();
      let ro = null;
      if (window.ResizeObserver) { ro = new ResizeObserver(resize); ro.observe(mount); }
      window.addEventListener('resize', resize);

      /* ---------------- Estado reutilizado no loop (sem alocar) ------- */
      const pos = new THREE.Vector3(), tan = new THREE.Vector3(), tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3();
      const hS = new THREE.Vector2(1, 0); // rumo suavizado (XY)
      const goalPos = new THREE.Vector3(), goalTgt = new THREE.Vector3();
      const left = new THREE.Vector3(), up = new THREE.Vector3(), UP = new THREE.Vector3(0, 0, 1);
      const basis = new THREE.Matrix4(), qT = new THREE.Quaternion();
      const clock = new THREE.Clock();
      const curveLen = model.curve.getLength();
      const stepLook = CHASE.look / curveLen;       // Δ (em u) ≈ 6 unidades à frente
      const stepCurve = CHASE.curveLook / curveLen; // Δ₂ para medir a curva
      const hLast = new THREE.Vector2(1, 0);
      let phiS = 0, kappa = 0, lastSeg = -1, lastHud = 0, raf = 0, frames = 0, acc = 0, firstCar = true;

      const loop = () => {
        raf = requestAnimationFrame(loop);
        const rawDt = clock.getDelta();
        const dt = Math.min(rawDt, 0.05);
        const now = clock.elapsedTime;
        const S = sim.current, M = model;

        /* 1) Avanço da simulação (por tempo -> desacelera em curvas/rampa) */
        if (S.playing) {
          S.t += dt * S.speed;
          if (S.t >= M.totalT) {
            S.t = M.totalT; S.playing = false; S.arrived = true; S.arrivedAt = now; S.dirty = true;
            setPlaying(false);
            try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch (e) { /* ignorar */ }
          }
        }
        const idx = idxOf(M.cumT, S.t);
        const u = idx / M.N;
        const meters = sampleAt(M.cumM, idx);
        M.curve.getPointAt(u, pos);
        M.curve.getTangentAt(u, tan);

        /* 2) Veículo: posição + orientação pela tangente REAL (pitch na rampa) */
        const hxy = Math.hypot(tan.x, tan.y);
        if (hxy > 0.06) hLast.set(tan.x / hxy, tan.y / hxy);
        const fwd = tA.copy(tan);
        if (hxy <= 0.06) fwd.set(hLast.x * 0.06, hLast.y * 0.06, (tan.z < 0 ? -1 : 1) * 0.998); // evita tangente vertical
        fwd.normalize();
        left.crossVectors(UP, fwd).normalize();
        up.crossVectors(fwd, left).normalize();
        basis.makeBasis(fwd, left, up);
        qT.setFromRotationMatrix(basis);
        if (firstCar) { car.quaternion.copy(qT); firstCar = false; } else car.quaternion.slerp(qT, 1 - Math.exp(-12 * dt));
        car.position.set(pos.x, pos.y, pos.z - LIFT + 0.02);

        /* 3) Foco de pavimento: Térreo some quando o carro desce */
        const f = clamp((pos.z - 5) / 6, 0, 1);
        const target = FADE_LOW + (FADE_TOP - FADE_LOW) * f * f * (3 - 2 * f);
        fT.mat.opacity += (target - fT.mat.opacity) * (1 - Math.exp(-6 * dt));

        /* 4) Tubo da rota: some atrás do carro */
        const seg = Math.min(TUBE_SEGS - 1, Math.floor(u * TUBE_SEGS));
        if (seg !== lastSeg) {
          lastSeg = seg;
          const start = seg * TUBE_RADIAL * 6;
          coreGeo.setDrawRange(start, idxTotal - start);
          glowGeo.setDrawRange(start, idxTotal - start);
        }

        /* 5) Câmera */
        S.boost = Math.min(1, S.boost + dt / 1.2);
        const rate = 2 + 5 * S.boost;
        if (S.mode === 'gps') {
          // rumo-alvo com antecipação (ver bloco de matemática no topo)
          M.curve.getTangentAt(Math.min(1, u + stepLook), tB);
          let hx = tan.x * 0.4 + tB.x * 0.6, hy = tan.y * 0.4 + tB.y * 0.6;
          const hl = Math.hypot(hx, hy);
          if (hl > 1e-4) {
            hx /= hl; hy /= hl;
            if (S.initHeading) { hS.set(hx, hy); S.initHeading = false; }
            const kh = 1 - Math.exp(-4 * dt);
            hS.x += (hx - hS.x) * kh; hS.y += (hy - hS.y) * kh;
            const n = Math.hypot(hS.x, hS.y) || 1; hS.x /= n; hS.y /= n;
          }
          // intensidade da curva à frente (κ)
          M.curve.getTangentAt(Math.min(1, u + stepCurve), tC);
          const la = Math.hypot(tan.x, tan.y), lc = Math.hypot(tC.x, tC.y);
          const kt = la > 1e-4 && lc > 1e-4
            ? clamp(Math.acos(clamp((tan.x * tC.x + tan.y * tC.y) / (la * lc), -1, 1)) / (Math.PI / 2), 0, 1) : 0;
          kappa += (kt - kappa) * (1 - Math.exp(-3 * dt));

          // pitch do trajeto (média atual/à frente) filtrado
          const phi0 = Math.atan2(tan.z, Math.hypot(tan.x, tan.y));
          const phi1 = Math.atan2(tB.z, Math.hypot(tB.x, tB.y));
          phiS += ((phi0 + phi1) * 0.5 - phiS) * (1 - Math.exp(-5 * dt));

          if (!S.manual) {
            const B = CHASE.back + 3 * kappa, H = CHASE.height + 4 * kappa, A = CHASE.ahead - 2 * kappa;
            // referencial inclinado por ψ: f = (cosψ·ĥ, sinψ), n = (−sinψ·ĥ, cosψ)
            const psi = CHASE.tilt * phiS, cp = Math.cos(psi), sp = Math.sin(psi);
            const fx = cp * hS.x, fy = cp * hS.y, fz = sp, nx = -sp * hS.x, ny = -sp * hS.y, nz = cp;
            // mistura com a pose lateral quando a rampa é íngreme
            const w = clamp((Math.abs(phiS) - CHASE.sideFrom) / (CHASE.sideTo - CHASE.sideFrom), 0, 1), ws = w * w * (3 - 2 * w);
            const c3 = Math.cos(phiS), s3 = Math.sin(phiS);
            const cx = pos.x - fx * B + nx * H, cy = pos.y - fy * B + ny * H, cz = pos.z - fz * B + nz * H;
            const sx = pos.x + hS.y * CHASE.side - hS.x * 2.5, sy = pos.y - hS.x * CHASE.side - hS.y * 2.5, sz = pos.z + 2.2;
            goalPos.set(cx + (sx - cx) * ws, cy + (sy - cy) * ws, cz + (sz - cz) * ws);
            const lx = pos.x + fx * A + nx * 0.6, ly = pos.y + fy * A + ny * 0.6, lz = pos.z + fz * A + nz * 0.6;
            const mx = pos.x + hS.x * c3 * CHASE.sideLead, my = pos.y + hS.y * c3 * CHASE.sideLead, mz = pos.z + s3 * CHASE.sideLead + 0.4;
            goalTgt.set(lx + (mx - lx) * ws, ly + (my - ly) * ws, lz + (mz - lz) * ws);
            camera.position.lerp(goalPos, 1 - Math.exp(-rate * dt));
            controls.target.lerp(goalTgt, 1 - Math.exp(-(rate + 1.5) * dt));
          }
        } else if (!S.manual) {
          // Visão geral 2D: quase vertical, "norte para cima", enquadra o mapa todo
          const tn = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
          const d = Math.max((PLANE_H / 2) / tn, (PLANE_W / 2) / (tn * camera.aspect)) * 1.12;
          goalPos.set(0, -d * 0.12, d + Z_T);
          goalTgt.set(0, 0, 0);
          camera.position.lerp(goalPos, 1 - Math.exp(-rate * dt));
          controls.target.lerp(goalTgt, 1 - Math.exp(-rate * dt));
        }
        controls.update();
        if (S.mode === 'overview' && camera.position.z < CAM_MIN_Z_OVERVIEW) camera.position.z = CAM_MIN_Z_OVERVIEW;

        /* 6) Marcadores e efeito de chegada */
        const pu = 1 + 0.18 * Math.sin(now * 4);
        spotRing.scale.set(pu, pu, 1); startRing.scale.set(pu, pu, 1);
        if (S.arrived) {
          bursts.forEach((b, i) => {
            const k = ((now - S.arrivedAt) / 1.6 + i * 0.5) % 1;
            b.visible = true; b.scale.set(1 + k * 6, 1 + k * 6, 1); b.material.opacity = 0.9 * (1 - k);
          });
        } else if (bursts[0].visible) bursts.forEach((b) => { b.visible = false; });

        /* 7) HUD a ~10 Hz (evita re-render do React a cada frame) */
        if (S.dirty || now - lastHud > 0.1) {
          S.dirty = false; lastHud = now;
          const A = M.actions;
          let ai = 0;
          while (ai < A.length - 1 && A[ai].m <= meters + 0.4) ai++;
          setHud({
            ai,
            dist: Math.max(0, A[ai].m - meters),
            remaining: Math.max(0, M.total - meters),
            eta: Math.max(0, M.totalT - S.t),
            pct: clamp((meters / M.total) * 100, 0, 100),
            level: pos.z > Z_T - 4 ? 'Térreo' : pos.z < Z_S + 4 ? 'Subsolo SS1' : 'Rampa',
            arrived: S.arrived,
          });
        }

        /* 8) Resolução adaptativa: se o dispositivo sofrer, reduz o pixel ratio */
        frames++; acc += rawDt;
        if (frames === 90) {
          if (acc / frames > 0.032 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.5); renderer.setPixelRatio(pixelRatio); resize(); }
          frames = 0; acc = 0;
        }
        renderer.render(scene, camera);
      };
      loop();

      return () => {
        cancelAnimationFrame(raf);
        if (ro) ro.disconnect();
        window.removeEventListener('resize', resize);
        controls.dispose();
        scene.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
        });
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      };
    }, []);

    /* ------------------------- Tela cheia ------------------------------ */
    useEffect(() => {
      const on = () => setIsFs(!!(document.fullscreenElement || document.webkitFullscreenElement));
      document.addEventListener('fullscreenchange', on);
      document.addEventListener('webkitfullscreenchange', on);
      return () => { document.removeEventListener('fullscreenchange', on); document.removeEventListener('webkitfullscreenchange', on); };
    }, []);
    const toggleFullscreen = () => {
      if (!hasFsApi()) { setIsFs((v) => !v); return; } // fallback (iPhone): ocupa a janela
      const el = stageRef.current;
      if (!(document.fullscreenElement || document.webkitFullscreenElement)) (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      else (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    };

    /* ------------------------------ Ações ------------------------------ */
    const setCameraMode = useCallback((m) => {
      const S = sim.current;
      S.mode = m; S.manual = false; S.boost = 0; if (m === 'gps') S.initHeading = true;
      setModeState(m); setManual(false);
    }, []);
    const recenter = useCallback(() => { const S = sim.current; S.manual = false; S.boost = 0; setManual(false); }, []);
    const resetSim = useCallback(() => {
      const S = sim.current;
      S.t = 0; S.playing = false; S.arrived = false; S.dirty = true;
      setPlaying(false); setStarted(false);
      setCameraMode('overview');
    }, [setCameraMode]);
    const onPrimary = () => {
      const S = sim.current;
      if (S.arrived) resetSim();
      if (S.playing) { S.playing = false; setPlaying(false); return; }
      if (S.t === 0) setCameraMode('gps'); // nova viagem: entra no modo GPS 3D
      S.playing = true; S.dirty = true; setPlaying(true); setStarted(true);
    };
    const cycleSpeed = () => {
      const S = sim.current; const n = SPEEDS[(SPEEDS.indexOf(S.speed) + 1) % SPEEDS.length];
      S.speed = n; setSpeed(n);
    };
    /* "Finalizar Rota" (modal de chegada + dock): grava o destino e vai ao check-in. */
    const finalizar = () => {
      safeStore(DESTINO_KEY, {
        vaga: VAGA.codigo,
        pavimento: VAGA.pavimento,
        status: 'AGUARDANDO_CHECKIN',
        timestamp: Date.now(),
      });
      window.location.assign(FINISH_URL);
    };

    /* ------------------------------- HUD ------------------------------- */
    const A = meta ? meta.actions : null;
    let banner = null;
    if (hud && A) {
      const a = A[hud.ai], isFinal = hud.ai === A.length - 1;
      let icon = a.icon, title = a.text, sub = null;
      if (hud.arrived) { icon = 'flag'; title = 'Você chegou à Vaga ' + VAGA.codigo; }
      else if (!isFinal && icon !== 'straight' && hud.dist > FAR_M) { sub = 'Depois: ' + a.text; icon = 'straight'; title = 'Siga reto'; }
      else if (!isFinal && A[hud.ai + 1] && A[hud.ai + 1].m - a.m < 60) { sub = 'Depois: ' + A[hud.ai + 1].text; }
      banner = { icon, title, sub, dist: hud.arrived ? null : (hud.dist <= 3 ? 'Agora' : 'em ' + fmtM(hud.dist) + ' m') };
    }

    const primaryLabel = playing ? '⏸ Pausar' : hud && hud.arrived ? '▶ Simular novamente' : started ? '▶ Continuar' : '▶ Iniciar Simulação';
    const pseudoFs = isFs && !hasFsApi();

    return (
      <div ref={stageRef} className="nv-stage" style={pseudoFs ? { position: 'fixed', inset: 0, zIndex: 9999 } : undefined}>
        <style>{CSS}</style>
        <div ref={mountRef} className="nv-canvas" />
        {erro && <div className="nv-erro" role="alert">{erro}</div>}

        <header className="nv-top">
          <button className="nv-btn" onClick={() => safeBack(BACK_URL)} title="Voltar para Setores">
            ← <span className="long">Voltar para Setores</span><span className="short">Voltar</span>
          </button>
          <div className="nv-seg" role="group" aria-label="Modo de câmera">
            <button className={mode === 'gps' ? 'on' : ''} aria-pressed={mode === 'gps'} onClick={() => setCameraMode('gps')}>GPS 3D</button>
            <button className={mode === 'overview' ? 'on' : ''} aria-pressed={mode === 'overview'} onClick={() => setCameraMode('overview')}>Visão geral</button>
          </div>
          <button className="nv-btn nv-sq" onClick={toggleFullscreen} aria-label={isFs ? 'Sair da tela cheia' : 'Tela cheia'}>{isFs ? '⤡' : '⛶'}</button>
        </header>

        {banner && (
          <section className={'nv-banner' + (hud.arrived ? ' ok' : '')} aria-live="polite">
            <div className="nv-banner-main">
              <span className="nv-ico"><Icon kind={banner.icon} size={40} /></span>
              <div className="nv-banner-txt">
                {banner.dist && <strong className="nv-dist">{banner.dist}</strong>}
                <span className="nv-title">{banner.title}</span>
              </div>
              <span className="nv-chip">{hud.level}</span>
            </div>
            {banner.sub && <div className="nv-sub">{banner.sub}</div>}
            <button className="nv-steps-toggle" onClick={() => setStepsOpen((v) => !v)} aria-expanded={stepsOpen}>
              Rota até a vaga {VAGA.codigo} {stepsOpen ? '▾' : '▸'}
            </button>
            {stepsOpen && A && (
              <ol className="nv-steps">
                {A.map((s, i) => (
                  <li key={i} className={i < hud.ai || hud.arrived ? 'done' : i === hud.ai ? 'on' : ''}>
                    <span className="nv-num">{i < hud.ai || hud.arrived ? '✓' : i + 1}</span>
                    <span>{s.text}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {hud && hud.arrived && (
          <div className="nv-arrive" role="dialog" aria-label="Chegada">
            <div className="nv-check" aria-hidden="true">✓</div>
            <h2>Você chegou!</h2>
            <p>Vaga <strong>{VAGA.codigo}</strong> · {VAGA.pavimento}</p>
            <button className="nv-btn nv-go" onClick={finalizar}>🚀 Finalizar Rota</button>
          </div>
        )}

        <footer className="nv-dock">
          {hud && (
            <div className="nv-metrics">
              <div><small>Distância</small><strong>{fmtM(hud.remaining)} m</strong></div>
              <div><small>ETA</small><strong>{fmtT(hud.eta)}</strong></div>
              <div><small>Progresso</small><strong>{Math.round(hud.pct)}%</strong></div>
              <button className="nv-speed" onClick={cycleSpeed} aria-label={'Velocidade da simulação ' + speed + ' vezes'}>⚡ {speed}×</button>
              <div className="nv-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(hud.pct)}>
                <div style={{ width: hud.pct + '%' }} />
              </div>
            </div>
          )}
          <button className="nv-btn nv-go nv-wide" onClick={onPrimary}>{primaryLabel}</button>
          <div className="nv-row">
            <button className="nv-btn" onClick={resetSim}>↺ Reiniciar</button>
            <button className={'nv-btn' + (manual ? ' nv-hint' : '')} onClick={recenter}>🎯 Recentralizar</button>
            <button className="nv-btn nv-ok" onClick={finalizar}>🚀 Finalizar Rota</button>
          </div>
        </footer>
      </div>
    );
  }

  /* ======================================================================== */
  /* ESTILOS (CSS-in-JS: independe do Tailwind CDN e evita flash sem estilo)  */
  /* ======================================================================== */
  const CSS = `
html,body{margin:0;height:100%;background:#0a1220}
.nv-stage{position:relative;width:100%;height:100vh;height:100dvh;overflow:hidden;background:#0a1220;color:#e6f1ff;
  font-family:"Segoe UI",system-ui,-apple-system,Roboto,sans-serif;-webkit-tap-highlight-color:transparent}
.nv-canvas{position:absolute;inset:0}
.nv-top{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:max(10px,env(safe-area-inset-top)) 10px 0;pointer-events:none}
.nv-top>*{pointer-events:auto}
.nv-btn{appearance:none;border:1px solid rgba(125,211,252,.35);background:rgba(10,18,32,.82);color:#e6f1ff;padding:11px 14px;
  border-radius:12px;font:600 14px/1 inherit;font-family:inherit;cursor:pointer;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
  transition:background .15s,border-color .15s,transform .1s}
.nv-btn:hover{background:rgba(24,44,72,.92);border-color:#7dd3fc}
.nv-btn:active{transform:scale(.97)}
.nv-btn:focus-visible,.nv-seg button:focus-visible,.nv-steps-toggle:focus-visible,.nv-speed:focus-visible{outline:2px solid #00f0ff;outline-offset:2px}
.nv-btn .short{display:none}
.nv-sq{padding:11px 13px}
.nv-seg{display:flex;padding:3px;border-radius:12px;background:rgba(10,18,32,.82);border:1px solid rgba(125,211,252,.35);
  backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.nv-seg button{appearance:none;border:0;background:none;color:#b6c9df;padding:8px 12px;border-radius:9px;font:600 13px/1 inherit;font-family:inherit;cursor:pointer}
.nv-seg button.on{background:#00c8d8;color:#04202a}
.nv-banner{position:absolute;left:10px;right:10px;top:calc(max(10px,env(safe-area-inset-top)) + 54px);max-width:560px;margin:0 auto;
  background:rgba(8,16,28,.92);border:1px solid rgba(125,211,252,.35);border-radius:16px;padding:12px;
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 8px 28px rgba(0,0,0,.35)}
.nv-banner.ok{border-color:#4ade80;background:rgba(6,40,24,.94)}
.nv-banner-main{display:flex;align-items:center;gap:12px}
.nv-ico{flex:0 0 56px;height:56px;border-radius:14px;display:grid;place-items:center;background:#00c8d8;color:#04202a}
.nv-banner.ok .nv-ico{background:#4ade80}
.nv-banner-txt{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.nv-dist{font-size:24px;line-height:1.05;letter-spacing:-.3px}
.nv-title{font-size:15px;line-height:1.3;color:#d5e6f8}
.nv-chip{align-self:flex-start;font-size:11px;font-weight:700;padding:4px 8px;border-radius:999px;background:rgba(125,211,252,.15);color:#7dd3fc;white-space:nowrap}
.nv-sub{margin-top:8px;padding-top:8px;border-top:1px solid rgba(125,211,252,.18);font-size:13px;color:#9db4cc}
.nv-steps-toggle{appearance:none;background:none;border:0;margin-top:8px;padding:2px 0;color:#7dd3fc;font:600 12px/1 inherit;font-family:inherit;cursor:pointer}
.nv-steps{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:4px;max-height:28vh;overflow:auto}
.nv-steps li{display:flex;gap:8px;align-items:flex-start;font-size:13px;padding:6px;border-radius:8px;color:#9db4cc}
.nv-steps li.on{background:rgba(0,240,255,.1);color:#e6f1ff}
.nv-steps li.done{opacity:.55}
.nv-num{flex:0 0 20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;background:#0f2236;border:1px solid #38bdf8}
.nv-dock{position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;gap:8px;max-width:560px;margin:0 auto;
  padding:0 10px max(12px,env(safe-area-inset-bottom));pointer-events:none}
.nv-dock>*{pointer-events:auto}
.nv-metrics{position:relative;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px 14px;border-radius:14px;
  background:rgba(8,16,28,.88);border:1px solid rgba(125,211,252,.3);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.nv-metrics>div:not(.nv-bar){display:flex;flex-direction:column;gap:2px}
.nv-metrics small{font-size:11px;color:#9db4cc}.nv-metrics strong{font-size:17px}
.nv-speed{appearance:none;border:1px solid rgba(125,211,252,.35);background:rgba(15,34,54,.8);color:#e6f1ff;border-radius:999px;
  padding:7px 11px;font:700 12px/1 inherit;font-family:inherit;cursor:pointer}
.nv-bar{position:absolute;left:12px;right:12px;bottom:6px;height:4px;border-radius:2px;background:rgba(125,211,252,.2);overflow:hidden}
.nv-bar>div{height:100%;background:#00f0ff;box-shadow:0 0 10px #00f0ff;transition:width .12s linear}
.nv-go{background:#00c8d8;border-color:#00f0ff;color:#04202a}
.nv-go:hover{background:#00e5ff;border-color:#7df9ff}
.nv-wide{width:100%;padding:15px 14px;font-size:16px}
.nv-row{display:grid;grid-template-columns:1fr 1.2fr 1.2fr;gap:8px}
.nv-row .nv-btn{padding:12px 6px;font-size:13px}
.nv-ok{border-color:rgba(74,222,128,.6);color:#bbf7d0}
.nv-hint{border-color:#00f0ff;animation:nvPulse 1.4s ease-in-out infinite}
.nv-arrive{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);width:min(320px,calc(100% - 40px));text-align:center;
  padding:22px 18px;border-radius:20px;background:rgba(6,40,24,.94);border:1px solid #4ade80;box-shadow:0 0 40px rgba(74,222,128,.35);
  animation:nvPop .45s cubic-bezier(.2,1.4,.4,1) both}
.nv-arrive h2{margin:10px 0 4px;font-size:24px}.nv-arrive p{margin:0 0 16px;color:#bbf7d0}
.nv-check{width:64px;height:64px;margin:0 auto;border-radius:50%;display:grid;place-items:center;font-size:34px;font-weight:700;
  color:#052e16;background:#4ade80;animation:nvPulse 1.6s ease-in-out infinite}
.nv-erro{position:absolute;left:10px;right:10px;bottom:190px;padding:12px 14px;border-radius:10px;background:#3b0d12;border:1px solid #f87171;color:#fecaca;font-size:14px}
.nv-splash{display:grid;place-items:center}
.nv-splash-box{text-align:center;padding:24px;max-width:340px}
.nv-splash-box.err p{color:#fecaca}
.nv-spin{display:block;width:34px;height:34px;margin:0 auto 14px;border-radius:50%;border:3px solid rgba(125,211,252,.25);border-top-color:#00f0ff;animation:nvSpin .9s linear infinite}
@keyframes nvSpin{to{transform:rotate(360deg)}}
@keyframes nvPulse{0%,100%{box-shadow:0 0 0 0 rgba(0,240,255,.5)}50%{box-shadow:0 0 0 9px rgba(0,240,255,0)}}
@keyframes nvPop{from{opacity:0;transform:translate(-50%,-46%) scale(.9)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@media (max-width:520px){.nv-btn .long{display:none}.nv-btn .short{display:inline}.nv-title{font-size:14px}.nv-dist{font-size:22px}}
@media (prefers-reduced-motion:reduce){.nv-hint,.nv-check,.nv-spin,.nv-arrive{animation:none}.nv-btn,.nv-bar>div{transition:none}}
`;

  /* ======================================================================== */
  /* BOOTSTRAP: espera pelas dependências antes de montar                     */
  /* ======================================================================== */
  function waitForDeps(timeoutMs) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      (function check() {
        const T = window.THREE;
        if (T && T.OrbitControls) { THREE = T; OrbitControls = T.OrbitControls; resolve(); return; }
        if (Date.now() - t0 > timeoutMs) {
          reject(new Error(!T
            ? 'Não foi possível carregar o Three.js. Verifique sua conexão e recarregue a página.'
            : 'O OrbitControls não foi carregado (inclua examples/js/controls/OrbitControls.js depois do three.js).'));
          return;
        }
        setTimeout(check, 50);
      })();
    });
  }

  function bootstrap() {
    const rootEl = document.getElementById('root');
    if (!rootEl) { console.error('[navegacao] elemento #root não encontrado'); return; }
    const root = ReactDOM.createRoot(rootEl);
    root.render(<Splash msg="Carregando motor 3D…" />);
    waitForDeps(12000)
      .then(() => root.render(<ErrorBoundary><Navegacao /></ErrorBoundary>))
      .catch((e) => root.render(<Splash error={e.message} />));
  }

  bootstrap();
})();