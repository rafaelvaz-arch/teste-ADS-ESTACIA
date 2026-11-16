/* =============================================================================
 * js/navegacao.jsx — ADS-ESTACIA  (v3 · mapa extraído por visão computacional)
 *
 * Cena em METROS. O mapa vem de assets/mapa_estacia.js (gerado por
 * scripts/extrair_mapa.py a partir das plantas): pilares, vagas, caixas, rampas,
 * prédio e um mapa de custo da via livre do SS1. A rota no SS1 é CALCULADA aqui
 * (A* sobre o mapa de custo) até a vaga escolhida — nada de nós digitados à mão.
 *
 * Eixos: x leste, y norte, z ALTURA (camera.up = +Z). Térreo em z = 0; SS1 em
 * z = -GAP (pé-direito real, ~3,6 m). Por isso a rampa fica com ~20–25°, e não
 * com os ~84° da versão "explodida" de ±12 unidades.
 *
 * ---------------------------------------------------------------------------
 * MATEMÁTICA (resumo; fórmulas completas no README do pipeline)
 * ---------------------------------------------------------------------------
 *  A*       custo do passo = comprimento · (1 + 6/(1+d)), d = folga em células até o
 *           obstáculo mais próximo ⇒ prefere o centro do corredor.
 *  Atalhos  "string pulling": remove nós intermediários enquanto a linha reta entre
 *           dois nós mantiver folga ≥ 1,7 célula (~0,9 m) — trajeto natural, sem
 *           zigue-zague de grade. Cantos viram arcos (raio até 3,5 m).
 *  Rampa    perfil vertical z(t) = Z_T − GAP·g(t) com g parábola–reta–parábola
 *           (g' contínua). A malha da rampa é feita das MESMAS amostras da curva,
 *           então o carro assenta na superfície; o plano do Térreo tem um furo
 *           (THREE.Shape + hole) sobre a rampa.
 *  Câmera   GPS: C = P − f·B + n·H, L = P + f·A + n·0.6 com referencial (f,n)
 *           inclinado por ψ = 0.45·φ (φ = pitch do trajeto à frente, filtrado) e
 *           filtros 1 − e^(−λ·dt) (independentes de FPS). Visão geral: enquadra a
 *           ROTA inteira (não o prédio todo) pelo FOV e pelo aspect.
 * ========================================================================== */
(function () {
  'use strict';

  if (!window.React || !window.ReactDOM) {
    const el = document.getElementById('root');
    if (el) el.textContent = 'Falha ao carregar o React. Verifique a conexão e recarregue a página.';
    return;
  }
  const { useState, useEffect, useRef, useCallback } = React;

  let THREE = null;
  let OrbitControls = null;

  const E3D = window.Estacia3D; // núcleo compartilhado (js/estacia3d.js)
  if (!E3D) {
    const el = document.getElementById('root');
    if (el) el.textContent = 'Falta carregar js/estacia3d.js antes de navegacao.jsx.';
    return;
  }
  const {
    GAP, LIFT, MIN_CLEAR, pedirVaga, acharVaga, clamp, criarConversores, decodificarGrade, celulaLivreMaisProxima, aEstrela, simplificar,
    douglasPeucker, colapsarCurtos, buildPoints, rampProfile, idxOf, sampleAt, makeFloor, planeWithHole, makeLabel,
    makeRing, buildCar, buildRamp, buildCenario,
  } = E3D;
  const VAGA_ID = pedirVaga();

  /* ======================================================================== */
  /* CONFIGURAÇÃO                                                             */
  /* ======================================================================== */
  const PAVIMENTO = 'Subsolo SS1';
  const BACK_URL = 'setores.html';
  const FINISH_URL = 'checkin.html';
  const DESTINO_KEY = 'estacia_vaga_destino';
  const MAPA_URL = 'assets/mapa_estacia.json';

  const REAL_SPEED = 4.2; // m/s ≈ 15 km/h
  const SAMPLES = 1000;
  const TUBE_R = 0.2, TUBE_SEGS = 900, TUBE_RADIAL = 8;
  const CORNER_R = 3.5;
  const FAR_M = 60;
  const SPEEDS = [1, 2, 4];

  /* Rota no Térreo (única parte "autoral": a planta não desenha as vias do Térreo).
   * Pontos em PIXELS da planta do Térreo; o resto sai da rampa detectada. */
  const TERREO_INICIO_PX = [1095, 598]; // pista inferior direita
  const TERREO_VIRADA_X_PX = 572; // onde a pista sobe em direção ao pórtico
  const RAMPA_CORNER_ABAIXO_DO_TOPO = 1.8; // m abaixo da borda norte da rampa
  const RAMPA_FLAT_ANTES = 2.2; // m planos antes de começar a descer
  const RAMPA_FOLGA_FUNDO = 0.4; // m antes da borda sul
  const RAMPA_STEPS = 36;
  const FADE_LOW = 0.12, FADE_TOP = 0.88;
  const CHASE = { back: 15, height: 9, ahead: 14, look: 16, curveLook: 28, tilt: 0.45 };
  const FOV_GPS = 52, FOV_OVERVIEW = 40;

  /* ======================================================================== */
  /* GEOMETRIA / CONVERSÕES                                                   */
  /* ======================================================================== */
  const turnCross = (a, b, c) => (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x); // >0 = esquerda









  /* ---------------- rota completa: Térreo (autoral) + rampa + SS1 (A*) ---------------- */
  function montarRota(mapa, vagaId) {
    const cv = criarConversores(mapa);
    const rampas = mapa.rampas.terreo.slice().sort((a, b) => a.y0 - b.y0);
    const tr = rampas[0]; // rampa central/valet: a mais ao sul
    const laneX = tr.x0 + 0.25 * (tr.x1 - tr.x0); // faixa da esquerda = descida
    const vaga = acharVaga(mapa, vagaId);

    const zT = LIFT, zS = -GAP + LIFT;
    const P = (x, y, z) => ({ x, y, z });
    const ini = cv.terPxToM(...TERREO_INICIO_PX), vir = cv.terPxToM(TERREO_VIRADA_X_PX, TERREO_INICIO_PX[1]);
    const yCorner = tr.y1 - RAMPA_CORNER_ABAIXO_DO_TOPO;
    const R0 = P(laneX, yCorner - RAMPA_FLAT_ANTES, zT);
    const R1 = P(laneX, tr.y0 + RAMPA_FOLGA_FUNDO, zS);
    const terreo = [P(ini[0], ini[1], zT), P(vir[0], ini[1], zT), P(vir[0], yCorner, zT), P(laneX, yCorner, zT), R0];

    // --- SS1 por A* ---
    const G = decodificarGrade(mapa.subsolo.custo);
    const cellOf = (X, Y) => { const [sx, sy] = cv.mToSsPx(X, Y); return [Math.floor(sx / G.cell), Math.floor(sy / G.cell)]; };
    const metersOf = (c) => cv.ssPxToM((c[0] + 0.5) * G.cell, (c[1] + 0.5) * G.cell);
    const [sc0, sc1] = cellOf(laneX, tr.y0 - 2.0);
    const start = celulaLivreMaisProxima(G, sc0, sc1, MIN_CLEAR);
    const fy = vaga.frente === 'N' ? 1 : -1;
    const acesso = [vaga.x, vaga.y + fy * (vaga.h / 2 + 2.2)];
    const [gc0, gc1] = cellOf(acesso[0], acesso[1]);
    const goal = celulaLivreMaisProxima(G, gc0, gc1, MIN_CLEAR);
    if (!start || !goal) throw new Error('Não achei célula livre perto da rampa/da vaga.');
    const bruto = aEstrela(G, start, goal);
    if (!bruto) throw new Error('A* não encontrou caminho do SS1 até a vaga ' + vagaId + '.');
    let simples = simplificar(G, bruto).map((c) => { const m = metersOf(c); return P(m[0], m[1], zS); });
    simples = colapsarCurtos(douglasPeucker(simples, 0.7), 4.0);
    // aproximação final limpa: descarta os nós a menos de 8 m do acesso e entra em linha reta na vaga
    while (simples.length > 2 && Math.hypot(simples[simples.length - 1].x - acesso[0], simples[simples.length - 1].y - acesso[1]) < 8) simples.pop();
    // a primeira etapa sai da rampa em linha reta (rumo sul) antes de virar
    const ss1 = [R1, P(laneX, simples[0].y, zS)];
    simples.forEach((p) => { if (Math.hypot(p.x - ss1[ss1.length - 1].x, p.y - ss1[ss1.length - 1].y) > 0.5) ss1.push(p); });
    ss1.push(P(acesso[0], acesso[1], zS));
    ss1.push(P(vaga.x, vaga.y, zS));

    const nodes = terreo.concat(ss1);
    return { cv, nodes, iR0: terreo.length - 1, iR1: terreo.length, vaga, tr, laneX, G };
  }




  function buildModel(rota) {
    const { nodes, iR0, iR1 } = rota;
    const head = buildPoints(nodes.slice(0, iR0 + 1), CORNER_R, 3);
    const a = nodes[iR0], b = nodes[iR1], mid = [];
    for (let k = 1; k < RAMPA_STEPS; k++) {
      const t = k / RAMPA_STEPS;
      mid.push(new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * rampProfile(t)));
    }
    const tail = buildPoints(nodes.slice(iR1), CORNER_R, 3);
    const pts = [];
    [head, mid, tail].forEach((arr) => arr.forEach((p) => { if (!pts.length || pts[pts.length - 1].distanceTo(p) > 1e-4) pts.push(p); }));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');

    const N = SAMPLES, P = [], Tg = [];
    for (let i = 0; i <= N; i++) { P.push(curve.getPointAt(i / N)); Tg.push(curve.getTangentAt(i / N)); }
    const K = 14, turn = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const u = Tg[i], v = Tg[Math.min(N, i + K)], lu = Math.hypot(u.x, u.y), lv = Math.hypot(v.x, v.y);
      if (lu < 1e-4 || lv < 1e-4) continue;
      turn[i] = clamp(Math.acos(clamp((u.x * v.x + u.y * v.y) / (lu * lv), -1, 1)) / (Math.PI / 2), 0, 1);
    }
    const cumM = new Float32Array(N + 1), cumT = new Float32Array(N + 1), dm = new Float32Array(N + 1), slope = new Float32Array(N + 1);
    for (let i = 1; i <= N; i++) {
      dm[i] = P[i].distanceTo(P[i - 1]);
      slope[i] = Math.abs(P[i].z - P[i - 1].z) / Math.max(dm[i], 1e-6);
      cumM[i] = cumM[i - 1] + dm[i];
    }
    const total = cumM[N];
    for (let i = 1; i <= N; i++) {
      let v = REAL_SPEED * (1 - 0.55 * turn[i]) * clamp((total - cumM[i]) / 10, 0.35, 1);
      if (slope[i] > 0.12) v *= 0.8;
      cumT[i] = cumT[i - 1] + dm[i] / Math.max(v, 0.4);
    }

    // posição (m) de cada nó, na própria curva
    let from = 0;
    const mark = (n) => {
      const nv = new THREE.Vector3(n.x, n.y, n.z); let best = Infinity, bi = from;
      for (let i = from; i <= N; i++) { const d = P[i].distanceToSquared(nv); if (d < best) { best = d; bi = i; } }
      from = bi; return { m: cumM[bi], i: bi };
    };
    const marks = nodes.map((n) => mark(n));

    // manobras (turn-by-turn) geradas da geometria
    const actions = [];
    const dirTxt = (c) => (c > 0 ? 'esquerda' : 'direita');
    const angAt = (k) => { // ângulo de giro no nó k, em graus (+ = esquerda)
      const p = nodes[k - 1], c = nodes[k], n = nodes[k + 1];
      const x1 = c.x - p.x, y1 = c.y - p.y, x2 = n.x - c.x, y2 = n.y - c.y;
      return Math.atan2(x1 * y2 - y1 * x2, x1 * x2 + y1 * y2) * 57.2958;
    };
    // Térreo (trecho autoral): cada curva é uma manobra
    for (let k = 1; k < iR0; k++) {
      const ang = angAt(k);
      if (Math.abs(ang) < 28) continue;
      if (k === iR0 - 1) actions.push({ icon: 'ramp', m: marks[k].m, text: 'Vire à ' + dirTxt(ang) + ' e desça a rampa para o ' + PAVIMENTO });
      else actions.push({ icon: ang > 0 ? 'left' : 'right', m: marks[k].m, text: 'Vire à ' + dirTxt(ang) + ' e siga até a rampa' });
    }
    // SS1 (rota calculada): nós próximos (< 18 m) formam UMA manobra; zigue-zagues pequenos somem
    const ult = nodes.length - 2;
    let k = iR1 + 1, primeira = true;
    while (k < ult) {
      let soma = 0, mSum = 0, cnt = 0, j = k;
      for (;;) {
        soma += angAt(j); mSum += marks[j].m; cnt++;
        if (j + 1 < ult && marks[j + 1].m - marks[j].m < 18) j++; else break;
      }
      if (Math.abs(soma) >= 45) {
        const dir = dirTxt(soma);
        actions.push({ icon: soma > 0 ? 'left' : 'right', m: mSum / cnt, text: primeira ? 'Ao sair da rampa, vire à ' + dir : 'Vire à ' + dir });
        primeira = false;
      }
      k = j + 1;
    }
    const aFinal = angAt(ult);
    actions.push({ icon: aFinal > 0 ? 'left' : 'right', m: marks[ult].m, text: (Math.abs(aFinal) >= 30 ? 'Vire à ' + dirTxt(aFinal) + ' e estacione' : 'Estacione') + ' na Vaga ' + rota.vaga.codigo });
    actions.push({ icon: 'park', m: total, text: 'Você chegou: Vaga ' + rota.vaga.codigo + ' à frente' });
    actions.sort((x, y) => x.m - y.m);

    let maxDeg = 0;
    for (let i = marks[iR0].i; i <= marks[iR1].i; i++) maxDeg = Math.max(maxDeg, Math.abs(Math.atan2(Tg[i].z, Math.hypot(Tg[i].x, Tg[i].y))) * 57.2958);
    return { curve, pts, N, P, Tg, cumM, cumT, total, totalT: cumT[N], actions, rampIdx: [marks[iR0].i, marks[iR1].i], maxDeg, length: curve.getLength() };
  }

  /* ======================================================================== */
  /* HELPERS THREE.JS                                                         */
  /* ======================================================================== */











  const hasFsApi = () => !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  const safeStore = (k, v) => { try { window.sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* modo privado */ } };
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
      straight: 'M12 20V5 M6 11l6-6 6 6', left: 'M17 20v-5a4 4 0 0 0-4-4H6 M10 7l-4 4 4 4', right: 'M7 20v-5a4 4 0 0 1 4-4h7 M14 7l4 4-4 4',
      ramp: 'M5 5l12 12 M17 8v9H8', flag: 'M6 21V4 M6 4h11l-2.5 4L17 12H6',
    };
    return (
      <svg width={size || 40} height={size || 40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {kind === 'park' ? (<g><circle cx="12" cy="12" r="9" /><path d="M10 17V7h3a3 3 0 0 1 0 6h-3" /></g>) : <path d={paths[kind] || paths.straight} />}
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
    render() { return this.state.err ? <Splash error={'Erro ao exibir a navegação: ' + (this.state.err.message || this.state.err)} /> : this.props.children; }
  }

  function Navegacao({ mapa }) {
    const stageRef = useRef(null), mountRef = useRef(null);
    const sim = useRef({ playing: false, t: 0, speed: 2, mode: 'overview', manual: false, boost: 0, arrived: false, arrivedAt: 0, dirty: true, initHeading: true, showSS1: false });
    const [meta, setMeta] = useState(null), [hud, setHud] = useState(null), [erro, setErro] = useState(null);
    const [mode, setModeState] = useState('overview'), [manual, setManual] = useState(false), [playing, setPlaying] = useState(false);
    const [started, setStarted] = useState(false), [speed, setSpeed] = useState(2), [stepsOpen, setStepsOpen] = useState(false);
    const [isFs, setIsFs] = useState(false), [showSS1, setShowSS1] = useState(false), [hidePanel, setHidePanel] = useState(false);

    useEffect(() => {
      const mount = mountRef.current;
      let renderer;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
      catch (e) { setErro('Seu navegador/dispositivo não conseguiu iniciar o WebGL. Atualize o navegador ou ative a aceleração por hardware.'); return undefined; }
      let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(pixelRatio);
      const physical = 'outputColorSpace' in renderer;
      if (physical) renderer.outputColorSpace = THREE.SRGBColorSpace; else renderer.outputEncoding = THREE.sRGBEncoding;
      const lk = physical ? 4 : 1;
      mount.appendChild(renderer.domElement);
      renderer.domElement.style.cssText = 'display:block;touch-action:none';
      renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); setErro('A GPU interrompeu o gráfico 3D. Aguarde alguns segundos ou recarregue.'); });
      renderer.domElement.addEventListener('webglcontextrestored', () => setErro(null));

      let rota, model;
      try { rota = montarRota(mapa, VAGA_ID); model = buildModel(rota); }
      catch (e) { console.error(e); setErro('Não foi possível calcular a rota: ' + e.message); return undefined; }
      sim.current.model = model;
      setMeta({ actions: model.actions, total: model.total, totalT: model.totalT });
      if (model.maxDeg > 30) console.warn('[navegacao] rampa com ~' + Math.round(model.maxDeg) + '° de inclinação máxima.');

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a1220);
      const camera = new THREE.PerspectiveCamera(FOV_OVERVIEW, 1, 0.3, 1500);
      camera.up.set(0, 0, 1);
      camera.position.set(-20, -140, 130);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true; controls.dampingFactor = 0.08; controls.screenSpacePanning = true;
      controls.minDistance = 4; controls.maxDistance = 500;
      controls.addEventListener('start', () => { const S = sim.current; if (!S.manual) { S.manual = true; setManual(true); } });

      scene.add(new THREE.AmbientLight(0xffffff, physical ? 1.9 : 0.95));
      const sun = new THREE.DirectionalLight(0xffffff, physical ? 1.5 : 0.75); sun.position.set(60, -80, 160); scene.add(sun);

      // pisos (texturas recortadas; Térreo com furo na rampa)
      const rampT = rota.tr;
      const hole = { x0: rampT.x0, x1: rampT.x1, y0: rampT.y0, y1: rota.nodes[rota.iR0].y };
      const fT = makeFloor(mapa.meta.texturas.terreo, 'TÉRREO', 0, FADE_TOP, 2, renderer, planeWithHole(mapa, hole));
      const fS = makeFloor(mapa.meta.texturas.subsolo, 'SUBSOLO SS1', -GAP, 0.97, 1, renderer, planeWithHole(mapa, null));
      scene.add(fT.mesh, fS.mesh);
      scene.add(buildCenario(mapa, rota.vaga.id));
      scene.add(buildRamp(model, rampT, renderer));

      const coreGeo = new THREE.TubeGeometry(model.curve, TUBE_SEGS, TUBE_R, TUBE_RADIAL, false);
      const glowGeo = new THREE.TubeGeometry(model.curve, TUBE_SEGS, TUBE_R * 2.4, TUBE_RADIAL, false);
      const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, depthTest: false }));
      const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
      core.renderOrder = 20; glow.renderOrder = 21; scene.add(core, glow);
      const idxTotal = coreGeo.index.count;

      const first = rota.nodes[0], last = rota.nodes[rota.nodes.length - 1];
      const startRing = makeRing(0x4ade80, 1.4, 2.1); startRing.position.set(first.x, first.y, 0.1);
      const spotRing = makeRing(0xfacc15, 1.2, 1.9); spotRing.position.set(last.x, last.y, -GAP + 0.1);
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 9, 8), new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.55 }));
      beacon.rotation.x = Math.PI / 2; beacon.position.set(last.x, last.y, -GAP + 4.5); beacon.renderOrder = 8;
      const lblSpot = makeLabel(VAGA_ID, '#facc15', 4, 1); lblSpot.position.set(last.x, last.y, -GAP + 9);
      const bursts = [makeRing(0x4ade80, 1.6, 2.0), makeRing(0x4ade80, 1.6, 2.0)];
      bursts.forEach((b) => { b.position.set(last.x, last.y, -GAP + 0.15); b.visible = false; });
      const lT = makeLabel('TÉRREO', '#7dd3fc', 14, 3.5); lT.position.set(-70, -58, 1);
      const lS = makeLabel('SUBSOLO SS1', '#7dd3fc', 14, 3.5); lS.position.set(-70, -58, -GAP + 1);
      scene.add(startRing, spotRing, beacon, lblSpot, lT, lS, ...bursts);

      const car = buildCar(lk);
      scene.add(car);

      // enquadramento da VISÃO GERAL: a rota inteira (não o prédio todo)
      const box = new THREE.Box3().setFromPoints(model.pts);
      box.expandByScalar(18);
      const bc = box.getCenter(new THREE.Vector3()), bs = box.getSize(new THREE.Vector3());

      const resize = () => {
        const w = Math.max(mount.clientWidth, 1), h = Math.max(mount.clientHeight, 1);
        camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
      };
      resize();
      let ro = null; if (window.ResizeObserver) { ro = new ResizeObserver(resize); ro.observe(mount); }
      window.addEventListener('resize', resize);

      const pos = new THREE.Vector3(), tan = new THREE.Vector3(), tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3();
      const hS = new THREE.Vector2(1, 0), hLast = new THREE.Vector2(1, 0), goalPos = new THREE.Vector3(), goalTgt = new THREE.Vector3();
      const left = new THREE.Vector3(), up = new THREE.Vector3(), UP = new THREE.Vector3(0, 0, 1);
      const basis = new THREE.Matrix4(), qT = new THREE.Quaternion(), clock = new THREE.Clock();
      const stepLook = CHASE.look / model.length, stepCurve = CHASE.curveLook / model.length;
      let kappa = 0, phiS = 0, lastSeg = -1, lastHud = 0, raf = 0, frames = 0, acc = 0, firstCar = true, firstFrame = true;

      const loop = () => {
        raf = requestAnimationFrame(loop);
        const rawDt = clock.getDelta(), dt = Math.min(rawDt, 0.05), now = clock.elapsedTime, S = sim.current, M = model;

        if (S.playing) {
          S.t += dt * S.speed;
          if (S.t >= M.totalT) {
            S.t = M.totalT; S.playing = false; S.arrived = true; S.arrivedAt = now; S.dirty = true; setPlaying(false);
            try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch (e) { /* ignorar */ }
          }
        }
        const idx = idxOf(M.cumT, S.t), u = idx / M.N, meters = sampleAt(M.cumM, idx);
        M.curve.getPointAt(u, pos); M.curve.getTangentAt(u, tan);

        // carro: posição + orientação pela tangente real (pitch na rampa)
        const hxy = Math.hypot(tan.x, tan.y);
        if (hxy > 0.06) hLast.set(tan.x / hxy, tan.y / hxy);
        const fwd = tA.copy(tan);
        if (hxy <= 0.06) fwd.set(hLast.x * 0.06, hLast.y * 0.06, (tan.z < 0 ? -1 : 1) * 0.998);
        fwd.normalize();
        left.crossVectors(UP, fwd).normalize(); up.crossVectors(fwd, left).normalize();
        basis.makeBasis(fwd, left, up); qT.setFromRotationMatrix(basis);
        if (firstCar) { car.quaternion.copy(qT); firstCar = false; } else car.quaternion.slerp(qT, 1 - Math.exp(-12 * dt));
        car.position.set(pos.x, pos.y, pos.z - LIFT + 0.02);

        // foco de pavimento: o Térreo vira "teto" translúcido quando o carro desce (ou se o usuário pedir)
        const f = clamp((pos.z + GAP * 0.55) / (GAP * 0.45), 0, 1);
        let target = FADE_LOW + (FADE_TOP - FADE_LOW) * f * f * (3 - 2 * f);
        if (S.showSS1) target = Math.min(target, 0.16);
        fT.mat.opacity += (target - fT.mat.opacity) * (1 - Math.exp(-6 * dt));

        // tubo da rota some atrás do carro
        const seg = Math.min(TUBE_SEGS - 1, Math.floor(u * TUBE_SEGS));
        if (seg !== lastSeg) { lastSeg = seg; const st = seg * TUBE_RADIAL * 6; coreGeo.setDrawRange(st, idxTotal - st); glowGeo.setDrawRange(st, idxTotal - st); }

        // câmera
        S.boost = Math.min(1, S.boost + dt / 1.2);
        const rate = 2 + 5 * S.boost;
        const fovGoal = S.mode === 'gps' ? FOV_GPS : FOV_OVERVIEW;
        if (Math.abs(camera.fov - fovGoal) > 0.05) { camera.fov += (fovGoal - camera.fov) * (1 - Math.exp(-4 * dt)); camera.updateProjectionMatrix(); }

        if (S.mode === 'gps') {
          M.curve.getTangentAt(Math.min(1, u + stepLook), tB);
          let hx = tan.x * 0.4 + tB.x * 0.6, hy = tan.y * 0.4 + tB.y * 0.6;
          const hl = Math.hypot(hx, hy);
          if (hl > 1e-4) {
            hx /= hl; hy /= hl;
            if (S.initHeading) { hS.set(hx, hy); S.initHeading = false; }
            const kh = 1 - Math.exp(-4 * dt); hS.x += (hx - hS.x) * kh; hS.y += (hy - hS.y) * kh;
            const n = Math.hypot(hS.x, hS.y) || 1; hS.x /= n; hS.y /= n;
          }
          M.curve.getTangentAt(Math.min(1, u + stepCurve), tC);
          const la = Math.hypot(tan.x, tan.y), lc = Math.hypot(tC.x, tC.y);
          const kt = la > 1e-4 && lc > 1e-4 ? clamp(Math.acos(clamp((tan.x * tC.x + tan.y * tC.y) / (la * lc), -1, 1)) / (Math.PI / 2), 0, 1) : 0;
          kappa += (kt - kappa) * (1 - Math.exp(-3 * dt));
          const phi0 = Math.atan2(tan.z, Math.hypot(tan.x, tan.y)), phi1 = Math.atan2(tB.z, Math.hypot(tB.x, tB.y));
          phiS += ((phi0 + phi1) * 0.5 - phiS) * (1 - Math.exp(-5 * dt));

          if (!S.manual) {
            const B = CHASE.back + 5 * kappa, H = CHASE.height + 5 * kappa, A = CHASE.ahead - 3 * kappa;
            const psi = CHASE.tilt * phiS, cp = Math.cos(psi), sp = Math.sin(psi);
            const fx = cp * hS.x, fy = cp * hS.y, fz = sp, nx = -sp * hS.x, ny = -sp * hS.y, nz = cp;
            goalPos.set(pos.x - fx * B + nx * H, pos.y - fy * B + ny * H, pos.z - fz * B + nz * H);
            goalTgt.set(pos.x + fx * A + nx * 0.6, pos.y + fy * A + ny * 0.6, pos.z + fz * A + nz * 0.6);
            if (firstFrame) { camera.position.copy(goalPos); controls.target.copy(goalTgt); }
            camera.position.lerp(goalPos, 1 - Math.exp(-rate * dt));
            controls.target.lerp(goalTgt, 1 - Math.exp(-(rate + 1.5) * dt));
          }
        } else if (!S.manual) {
          const tn = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
          const d = Math.max((bs.y / 2) / tn, (bs.x / 2) / (tn * camera.aspect)) * 1.08;
          goalPos.set(bc.x, bc.y - d * 0.16, d + 6); goalTgt.set(bc.x, bc.y, -GAP * 0.4);
          if (firstFrame) { camera.position.copy(goalPos); controls.target.copy(goalTgt); }
          camera.position.lerp(goalPos, 1 - Math.exp(-rate * dt));
          controls.target.lerp(goalTgt, 1 - Math.exp(-rate * dt));
        }
        firstFrame = false;
        controls.update();

        const dl = camera.position.distanceTo(lblSpot.position), kl = clamp(dl * 0.016, 0.9, 5);
        lblSpot.scale.set(4 * kl, kl, 1); lT.visible = lS.visible = S.mode === 'overview';
        const pu = 1 + 0.18 * Math.sin(now * 4);
        spotRing.scale.set(pu, pu, 1); startRing.scale.set(pu, pu, 1);
        if (S.arrived) {
          bursts.forEach((b, i) => { const k = ((now - S.arrivedAt) / 1.6 + i * 0.5) % 1; b.visible = true; b.scale.set(1 + k * 6, 1 + k * 6, 1); b.material.opacity = 0.9 * (1 - k); });
        } else if (bursts[0].visible) bursts.forEach((b) => { b.visible = false; });

        if (S.dirty || now - lastHud > 0.1) {
          S.dirty = false; lastHud = now;
          const A = M.actions; let ai = 0;
          while (ai < A.length - 1 && A[ai].m <= meters + 0.4) ai++;
          setHud({
            ai, dist: Math.max(0, A[ai].m - meters), remaining: Math.max(0, M.total - meters), eta: Math.max(0, M.totalT - S.t),
            pct: clamp((meters / M.total) * 100, 0, 100), arrived: S.arrived,
            level: pos.z > -GAP * 0.25 ? 'Térreo' : pos.z < -GAP * 0.75 ? PAVIMENTO : 'Rampa',
          });
        }

        frames++; acc += rawDt;
        if (frames === 90) {
          if (acc / frames > 0.032 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.5); renderer.setPixelRatio(pixelRatio); resize(); }
          frames = 0; acc = 0;
        }
        renderer.render(scene, camera);
      };
      loop();
      window.__nav = { sim: sim.current, model, rota, camera, controls, scene }; // útil para depurar no console

      return () => {
        cancelAnimationFrame(raf); if (ro) ro.disconnect(); window.removeEventListener('resize', resize); controls.dispose();
        scene.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
        });
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      };
    }, []);

    useEffect(() => {
      const on = () => setIsFs(!!(document.fullscreenElement || document.webkitFullscreenElement));
      document.addEventListener('fullscreenchange', on); document.addEventListener('webkitfullscreenchange', on);
      return () => { document.removeEventListener('fullscreenchange', on); document.removeEventListener('webkitfullscreenchange', on); };
    }, []);
    const toggleFullscreen = () => {
      if (!hasFsApi()) { setIsFs((v) => !v); return; }
      const el = stageRef.current;
      if (!(document.fullscreenElement || document.webkitFullscreenElement)) (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      else (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    };

    const setCameraMode = useCallback((m) => { const S = sim.current; S.mode = m; S.manual = false; S.boost = 0; if (m === 'gps') S.initHeading = true; setModeState(m); setManual(false); }, []);
    const recenter = useCallback(() => { const S = sim.current; S.manual = false; S.boost = 0; setManual(false); }, []);
    const resetSim = useCallback(() => { const S = sim.current; S.t = 0; S.playing = false; S.arrived = false; S.dirty = true; setPlaying(false); setStarted(false); setCameraMode('overview'); }, [setCameraMode]);
    const onPrimary = () => {
      const S = sim.current;
      if (S.arrived) resetSim();
      if (S.playing) { S.playing = false; setPlaying(false); return; }
      if (S.t === 0) setCameraMode('gps');
      S.playing = true; S.dirty = true; setPlaying(true); setStarted(true);
    };
    const cycleSpeed = () => { const S = sim.current, n = SPEEDS[(SPEEDS.indexOf(S.speed) + 1) % SPEEDS.length]; S.speed = n; setSpeed(n); };
    const toggleSS1 = () => { const S = sim.current; S.showSS1 = !S.showSS1; setShowSS1(S.showSS1); };
    const finalizar = () => {
      safeStore(DESTINO_KEY, { vaga: VAGA_ID, pavimento: PAVIMENTO, status: 'AGUARDANDO_CHECKIN', timestamp: Date.now() });
      window.location.assign(FINISH_URL);
    };

    const A = meta ? meta.actions : null;
    let banner = null;
    if (hud && A) {
      const a = A[hud.ai], isFinal = hud.ai === A.length - 1;
      let icon = a.icon, title = a.text, sub = null;
      if (hud.arrived) { icon = 'flag'; title = 'Você chegou à Vaga ' + VAGA_ID; }
      else if (!isFinal && icon !== 'straight' && hud.dist > FAR_M) { sub = 'Depois: ' + a.text; icon = 'straight'; title = 'Siga reto'; }
      else if (!isFinal && A[hud.ai + 1] && A[hud.ai + 1].m - a.m < 60) sub = 'Depois: ' + A[hud.ai + 1].text;
      banner = { icon, title, sub, dist: hud.arrived ? null : hud.dist <= 3 ? 'Agora' : 'em ' + fmtM(hud.dist) + ' m' };
    }
    const primaryLabel = playing ? '⏸ Pausar' : hud && hud.arrived ? '▶ Simular novamente' : started ? '▶ Continuar' : '▶ Iniciar Simulação';
    const pseudoFs = isFs && !hasFsApi();

    return (
      <div ref={stageRef} className="nv-stage" style={pseudoFs ? { position: 'fixed', inset: 0, zIndex: 9999 } : undefined}>
        <style>{CSS}</style>
        <div ref={mountRef} className="nv-canvas" />
        {erro && <div className="nv-erro" role="alert">{erro}</div>}

        <header className="nv-top">
          <button className="nv-btn" onClick={() => safeBack(BACK_URL)} title="Voltar para Setores">← <span className="long">Voltar para Setores</span><span className="short">Voltar</span></button>
          <div className="nv-seg" role="group" aria-label="Modo de câmera">
            <button className={mode === 'gps' ? 'on' : ''} aria-pressed={mode === 'gps'} onClick={() => setCameraMode('gps')}>GPS 3D</button>
            <button className={mode === 'overview' ? 'on' : ''} aria-pressed={mode === 'overview'} onClick={() => setCameraMode('overview')}>Visão geral</button>
          </div>
          <div className="nv-tools">
            {mode === 'overview' && <button className={'nv-btn nv-sq' + (showSS1 ? ' nv-on' : '')} onClick={toggleSS1} aria-pressed={showSS1} aria-label="Ver subsolo" title="Ver subsolo">▤</button>}
            <button className={'nv-btn nv-sq' + (hidePanel ? ' nv-on' : '')} onClick={() => setHidePanel((v) => !v)} aria-pressed={hidePanel} aria-label="Ocultar painéis" title="Ocultar painéis">◧</button>
            <button className="nv-btn nv-sq" onClick={toggleFullscreen} aria-label={isFs ? 'Sair da tela cheia' : 'Tela cheia'}>{isFs ? '⤡' : '⛶'}</button>
          </div>
        </header>

        {banner && !hidePanel && (
          <section className={'nv-banner' + (hud.arrived ? ' ok' : '')} aria-live="polite">
            <button className="nv-banner-main" onClick={() => setStepsOpen((v) => !v)} aria-expanded={stepsOpen} title="Ver todos os passos">
              <span className="nv-ico"><Icon kind={banner.icon} size={34} /></span>
              <span className="nv-banner-txt">
                <span className="nv-line1">{banner.dist && <strong className="nv-dist">{banner.dist}</strong>}<span className="nv-title">{banner.title}</span></span>
                {banner.sub && <span className="nv-sub">{banner.sub}</span>}
              </span>
              <span className="nv-chip">{hud.level}</span>
            </button>
            {stepsOpen && A && (
              <ol className="nv-steps">
                {A.map((s, i) => (
                  <li key={i} className={i < hud.ai || hud.arrived ? 'done' : i === hud.ai ? 'on' : ''}>
                    <span className="nv-num">{i < hud.ai || hud.arrived ? '✓' : i + 1}</span><span>{s.text}</span>
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
            <p>Vaga <strong>{VAGA_ID}</strong> · {PAVIMENTO}</p>
            <button className="nv-btn nv-go" onClick={finalizar}>🚀 Finalizar Rota</button>
          </div>
        )}

        <footer className="nv-dock">
          {hud && !hidePanel && (
            <div className="nv-metrics">
              <span><small>Dist.</small><strong>{fmtM(hud.remaining)} m</strong></span>
              <span><small>ETA</small><strong>{fmtT(hud.eta)}</strong></span>
              <span><small>Prog.</small><strong>{Math.round(hud.pct)}%</strong></span>
              <button className="nv-speed" onClick={cycleSpeed} aria-label={'Velocidade da simulação ' + speed + ' vezes'}>⚡ {speed}×</button>
              <div className="nv-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(hud.pct)}><div style={{ width: hud.pct + '%' }} /></div>
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

  const CSS = `
html,body{margin:0;height:100%;background:#0a1220}
.nv-stage{position:relative;width:100%;height:100vh;height:100dvh;overflow:hidden;background:#0a1220;color:#e6f1ff;font-family:"Segoe UI",system-ui,-apple-system,Roboto,sans-serif;-webkit-tap-highlight-color:transparent}
.nv-canvas{position:absolute;inset:0}
.nv-top{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;gap:6px;padding:max(8px,env(safe-area-inset-top)) 8px 0;pointer-events:none}
.nv-top>*{pointer-events:auto}
.nv-tools{display:flex;gap:6px}
.nv-btn{white-space:nowrap;appearance:none;border:1px solid rgba(125,211,252,.35);background:rgba(10,18,32,.82);color:#e6f1ff;padding:9px 12px;border-radius:11px;font:600 13px/1 inherit;font-family:inherit;cursor:pointer;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:background .15s,border-color .15s,transform .1s}
.nv-btn:hover{background:rgba(24,44,72,.92);border-color:#7dd3fc}.nv-btn:active{transform:scale(.97)}
.nv-btn:focus-visible,.nv-seg button:focus-visible,.nv-banner-main:focus-visible,.nv-speed:focus-visible{outline:2px solid #00f0ff;outline-offset:2px}
.nv-btn .short{display:none}.nv-sq{padding:9px 11px}.nv-on{border-color:#00f0ff;box-shadow:inset 0 0 0 1px #00f0ff}
.nv-seg{display:flex;padding:3px;border-radius:11px;background:rgba(10,18,32,.82);border:1px solid rgba(125,211,252,.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.nv-seg button{white-space:nowrap;appearance:none;border:0;background:none;color:#b6c9df;padding:7px 10px;border-radius:8px;font:600 12px/1 inherit;font-family:inherit;cursor:pointer}
.nv-seg button.on{background:#00c8d8;color:#04202a}
.nv-banner{position:absolute;left:8px;right:8px;top:calc(max(8px,env(safe-area-inset-top)) + 46px);max-width:540px;margin:0 auto;background:rgba(8,16,28,.9);border:1px solid rgba(125,211,252,.35);border-radius:14px;padding:6px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 6px 22px rgba(0,0,0,.35)}
.nv-banner.ok{border-color:#4ade80;background:rgba(6,40,24,.94)}
.nv-banner-main{appearance:none;display:flex;align-items:center;gap:10px;width:100%;background:none;border:0;color:inherit;font-family:inherit;text-align:left;padding:2px;cursor:pointer}
.nv-ico{flex:0 0 46px;height:46px;border-radius:12px;display:grid;place-items:center;background:#00c8d8;color:#04202a}
.nv-banner.ok .nv-ico{background:#4ade80}
.nv-banner-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.nv-line1{display:flex;align-items:baseline;gap:8px;min-width:0}
.nv-dist{font-size:20px;line-height:1.05;white-space:nowrap}
.nv-title{font-size:14px;line-height:1.25;color:#d5e6f8;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.nv-sub{font-size:12px;color:#9db4cc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nv-chip{align-self:flex-start;font-size:10px;font-weight:700;padding:3px 7px;border-radius:999px;background:rgba(125,211,252,.15);color:#7dd3fc;white-space:nowrap}
.nv-steps{list-style:none;margin:6px 2px 2px;padding:0;display:grid;gap:3px;max-height:30vh;overflow:auto}
.nv-steps li{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;padding:5px;border-radius:8px;color:#9db4cc}
.nv-steps li.on{background:rgba(0,240,255,.1);color:#e6f1ff}.nv-steps li.done{opacity:.55}
.nv-num{flex:0 0 18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:10px;font-weight:700;background:#0f2236;border:1px solid #38bdf8}
.nv-dock{position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;gap:6px;max-width:540px;margin:0 auto;padding:0 8px max(10px,env(safe-area-inset-bottom));pointer-events:none}
.nv-dock>*{pointer-events:auto}
.nv-metrics{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px 11px;border-radius:12px;background:rgba(8,16,28,.88);border:1px solid rgba(125,211,252,.3);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.nv-metrics>span{display:flex;align-items:baseline;gap:5px}.nv-metrics small{font-size:10.5px;color:#9db4cc}.nv-metrics strong{font-size:15px}
.nv-speed{appearance:none;border:1px solid rgba(125,211,252,.35);background:rgba(15,34,54,.8);color:#e6f1ff;border-radius:999px;padding:5px 9px;font:700 11px/1 inherit;font-family:inherit;cursor:pointer}
.nv-bar{position:absolute;left:10px;right:10px;bottom:4px;height:3px;border-radius:2px;background:rgba(125,211,252,.2);overflow:hidden}
.nv-bar>div{height:100%;background:#00f0ff;box-shadow:0 0 8px #00f0ff;transition:width .12s linear}
.nv-go{background:#00c8d8;border-color:#00f0ff;color:#04202a}.nv-go:hover{background:#00e5ff;border-color:#7df9ff}
.nv-wide{width:100%;padding:12px;font-size:15px}
.nv-row{display:grid;grid-template-columns:1fr 1.25fr 1.25fr;gap:6px}.nv-row .nv-btn{padding:9px 4px;font-size:12px}
.nv-ok{border-color:rgba(74,222,128,.6);color:#bbf7d0}
.nv-hint{border-color:#00f0ff;animation:nvPulse 1.4s ease-in-out infinite}
.nv-arrive{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);width:min(300px,calc(100% - 40px));text-align:center;padding:20px 16px;border-radius:20px;background:rgba(6,40,24,.94);border:1px solid #4ade80;box-shadow:0 0 40px rgba(74,222,128,.35);animation:nvPop .45s cubic-bezier(.2,1.4,.4,1) both}
.nv-arrive h2{margin:8px 0 4px;font-size:22px}.nv-arrive p{margin:0 0 14px;color:#bbf7d0}
.nv-check{width:58px;height:58px;margin:0 auto;border-radius:50%;display:grid;place-items:center;font-size:30px;font-weight:700;color:#052e16;background:#4ade80;animation:nvPulse 1.6s ease-in-out infinite}
.nv-erro{position:absolute;left:8px;right:8px;bottom:170px;padding:12px 14px;border-radius:10px;background:#3b0d12;border:1px solid #f87171;color:#fecaca;font-size:14px}
.nv-splash{display:grid;place-items:center}.nv-splash-box{text-align:center;padding:24px;max-width:340px}.nv-splash-box.err p{color:#fecaca}
.nv-spin{display:block;width:34px;height:34px;margin:0 auto 14px;border-radius:50%;border:3px solid rgba(125,211,252,.25);border-top-color:#00f0ff;animation:nvSpin .9s linear infinite}
@keyframes nvSpin{to{transform:rotate(360deg)}}
@keyframes nvPulse{0%,100%{box-shadow:0 0 0 0 rgba(0,240,255,.5)}50%{box-shadow:0 0 0 9px rgba(0,240,255,0)}}
@keyframes nvPop{from{opacity:0;transform:translate(-50%,-46%) scale(.9)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@media (max-width:520px){.nv-btn .long{display:none}.nv-btn .short{display:inline}}
@media (prefers-reduced-motion:reduce){.nv-hint,.nv-check,.nv-spin,.nv-arrive{animation:none}.nv-btn,.nv-bar>div{transition:none}}
`;

  /* ======================================================================== */
  /* BOOTSTRAP                                                                */
  /* ======================================================================== */
  function waitForDeps(timeoutMs) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      (function check() {
        const T = window.THREE;
        if (T && T.OrbitControls) { THREE = T; OrbitControls = T.OrbitControls; E3D.init(T); resolve(); return; }
        if (Date.now() - t0 > timeoutMs) {
          reject(new Error(!T ? 'Não foi possível carregar o Three.js. Verifique sua conexão e recarregue a página.' : 'O OrbitControls não foi carregado (inclua examples/js/controls/OrbitControls.js depois do three.js).'));
          return;
        }
        setTimeout(check, 50);
      })();
    });
  }
  function carregarMapa() {
    if (window.MAPA_ESTACIA) return Promise.resolve(window.MAPA_ESTACIA); // assets/mapa_estacia.js (funciona em file://)
    return fetch(MAPA_URL).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch((e) => { throw new Error('Não consegui carregar o mapa (' + MAPA_URL + '): ' + e.message + '. Rode scripts/extrair_mapa.py e inclua assets/mapa_estacia.js no HTML.'); });
  }

  function bootstrap() {
    const rootEl = document.getElementById('root');
    if (!rootEl) { console.error('[navegacao] elemento #root não encontrado'); return; }
    const root = ReactDOM.createRoot(rootEl);
    root.render(<Splash msg="Carregando motor 3D e mapa…" />);
    Promise.all([waitForDeps(12000), carregarMapa()])
      .then(([, mapa]) => root.render(<ErrorBoundary><Navegacao mapa={mapa} /></ErrorBoundary>))
      .catch((e) => root.render(<Splash error={e.message} />));
  }

  if (window.__NAV_TEST__) window.__NAV_TEST__.api = { montarRota, buildModel, setT: (t) => { THREE = t; E3D.init(t); }, criarConversores };
  else bootstrap();
})();