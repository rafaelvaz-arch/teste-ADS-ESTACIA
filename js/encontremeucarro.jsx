/* =============================================================================
 * js/encontremeucarro.jsx — "Encontre meu carro" (rota a pé) · v2
 *
 * Mesma base da navegação do carro: cena em METROS, mapa extraído por visão computacional
 * (assets/mapa_estacia.js) e núcleo compartilhado js/estacia3d.js (A*, pisos, cenário, carro).
 *
 * Fluxo: 1) vaga salva (?vaga=, estacia_vaga_destino, check-in ou A-145)
 *        2) o usuário escolhe onde está
 *        3) rota a pé: Térreo (trecho autoral) → torre de elevadores/escada rolante → foyer central do
 *           SS1 → A* pelos corredores até a frente da vaga
 *        4) card flutuante com o passo a passo, gerado da geometria
 *
 * Eixos/escala: x leste, y norte, z para cima; Térreo em z = 0, SS1 em z = -GAP (3,6 m).
 * Câmera: mesma matemática do modo GPS 3D (rumo suavizado + referencial inclinado), mais baixa e próxima.
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

  const E3D = window.Estacia3D;
  if (!E3D) {
    const el = document.getElementById('root');
    if (el) el.textContent = 'Falta carregar js/estacia3d.js antes de encontremeucarro.jsx.';
    return;
  }
  const {
    GAP, LIFT, MIN_CLEAR, pedirVaga, acharVaga, clamp, criarConversores, decodificarGrade, celulaLivreMaisProxima, aEstrela,
    simplificar, douglasPeucker, colapsarCurtos, buildPoints, idxOf, sampleAt, makeFloor, planeWithHole, makeLabel, makeRing,
    buildCar, buildCenario,
  } = E3D;

  /* ======================================================================== */
  /* CONFIGURAÇÃO                                                             */
  /* ======================================================================== */
  const VAGA_ID = pedirVaga();
  const PAVIMENTO = 'Subsolo SS1';
  const BACK_URL = 'monitoramento.html';
  const MAPA_URL = 'assets/mapa_estacia.json';

  const WALK_SPEED = 1.35; // m/s
  const CORNER_R = 1.8;
  const SAMPLES = 900;
  const TUBE_R = 0.14, TUBE_SEGS = 800, TUBE_RADIAL = 8;
  const FADE_LOW = 0.12, FADE_TOP = 0.88;
  const CHASE = { back: 9, height: 6.5, ahead: 4.5, look: 10, curveLook: 18, tilt: 0.4 };
  const FOV_FOLLOW = 55, FOV_OVERVIEW = 40;
  const SPEEDS = [1, 2, 4];

  /* Torre de elevadores do Térreo (E1/E2) que desce ao foyer central do SS1. Pixels da planta do Térreo.
   * (A torre leste não é usada: na planta ela fica a ~30 m do núcleo leste do SS1 — vide docs/PIPELINE_CV.md.) */
  const TORRE_TERREO_PX = [538, 325];

  /* Pontos de partida (pixels da planta do Térreo). `via` = pontos intermediários. A planta não tem Cinemas. */
  const ORIGENS = [
    { id: 'entrada-sul', label: 'Entrada Sul (principal)', hint: 'Pórtico / valet', px: [602, 552], via: [[602, 440]],
      go: 'Entre pelo pórtico e siga em frente pelo saguão sul até a torre de elevadores, ao lado da Praça Central.' },
    { id: 'entrada-oeste', label: 'Entrada Oeste', hint: 'Acesso oeste do mall', px: [172, 347], via: [[440, 347]],
      go: 'Siga pelo eixo oeste do mall, passando pela Praça das Águas, até a torre de elevadores.' },
    { id: 'entrada-leste', label: 'Entrada Leste', hint: 'Acesso leste do mall', px: [1108, 347], via: [[840, 347], [660, 360]],
      go: 'Siga pelo eixo leste do mall, passando pela Praça do Fogo, e contorne a Praça Central até a torre de elevadores.' },
    { id: 'praca-alimentacao', label: 'Praça de Alimentação', hint: 'Restaurantes e fast food', px: [700, 470], via: [[640, 405]],
      go: 'Saia da praça de alimentação para o norte e siga pela Praça Central até a torre de elevadores.' },
    { id: 'praca-central', label: 'Praça Central / Grande Átrio', hint: 'Café e cúpula de vidro', px: [640, 360], via: [],
      go: 'A torre de elevadores fica a poucos passos, no lado oeste da Praça Central.' },
    { id: 'ancora-1', label: 'Âncora 1 — Lojas Americanas', hint: 'Ala noroeste', px: [332, 225], via: [[430, 300]],
      go: 'Saia pela porta do mall, vire em direção à Praça Central e siga até a torre de elevadores.' },
    { id: 'ancora-2', label: 'Âncora 2 — C&A', hint: 'Ala sudoeste', px: [332, 470], via: [[430, 395]],
      go: 'Saia pela porta do mall, vire em direção à Praça Central e siga até a torre de elevadores.' },
    { id: 'ancora-3', label: 'Âncora 3 — Renner', hint: 'Ala nordeste', px: [948, 225], via: [[850, 300], [660, 335]],
      go: 'Saia pela porta do mall, siga em direção à Praça Central e contorne-a até a torre de elevadores.' },
    { id: 'ancora-4', label: 'Âncora 4 — Riachuelo', hint: 'Ala sudeste', px: [948, 470], via: [[850, 395], [660, 380]],
      go: 'Saia pela porta do mall, siga em direção à Praça Central e contorne-a até a torre de elevadores.' },
  ];

  /* ======================================================================== */
  /* ROTA A PÉ                                                                */
  /* ======================================================================== */
  const angAt = (nodes, k) => { // giro no nó k, em graus (+ = esquerda)
    const p = nodes[k - 1], c = nodes[k], n = nodes[k + 1];
    const x1 = c.x - p.x, y1 = c.y - p.y, x2 = n.x - c.x, y2 = n.y - c.y;
    return Math.atan2(x1 * y2 - y1 * x2, x1 * x2 + y1 * y2) * 57.2958;
  };

  function montarRotaPedestre(mapa, origem, acessivel) {
    const cv = criarConversores(mapa);
    const vaga = acharVaga(mapa, VAGA_ID);
    const zT = LIFT, zS = -GAP + LIFT, P = (x, y, z) => ({ x, y, z });
    const ciano = mapa.subsolo.caixas.filter((c) => c.cor === 'ciano' && Math.abs((c.y0 + c.y1) / 2) < 15).sort((a, b) => a.x0 - b.x0);
    const foyer = ciano[1]; // núcleo oeste, FOYER CENTRAL, núcleo leste
    if (!foyer) throw new Error('Não achei o foyer central no mapa.');
    const cf = [(foyer.x0 + foyer.x1) / 2, (foyer.y0 + foyer.y1) / 2];
    const tower = cv.terPxToM(TORRE_TERREO_PX[0], TORRE_TERREO_PX[1]);
    const pts = [origem.px].concat(origem.via || []).map((p) => cv.terPxToM(p[0], p[1]));
    const terreo = pts.concat([tower]).map((p) => P(p[0], p[1], zT));
    const iT = terreo.length - 1;
    const link = acessivel ? [P(tower[0], tower[1], zS), P(cf[0], cf[1], zS)] : [P(cf[0], cf[1], zS)];
    const iS = iT + link.length;

    // SS1: A* a partir do foyer; testa as 4 bordas do foyer e fica com o menor caminho
    const G = decodificarGrade(mapa.subsolo.custo);
    const cellOf = (X, Y) => { const [sx, sy] = cv.mToSsPx(X, Y); return [Math.floor(sx / G.cell), Math.floor(sy / G.cell)]; };
    const metersOf = (c) => cv.ssPxToM((c[0] + 0.5) * G.cell, (c[1] + 0.5) * G.cell);
    const fy = vaga.frente === 'N' ? 1 : -1;
    const acesso = [vaga.x, vaga.y + fy * (vaga.h / 2 + 2.2)];
    const goal = celulaLivreMaisProxima(G, ...cellOf(acesso[0], acesso[1]), MIN_CLEAR);
    const bordas = [[cf[0], foyer.y1 + 1.5], [cf[0], foyer.y0 - 1.5], [foyer.x0 - 1.5, cf[1]], [foyer.x1 + 1.5, cf[1]]];
    let melhor = null;
    bordas.forEach((b) => {
      const s = celulaLivreMaisProxima(G, ...cellOf(b[0], b[1]), MIN_CLEAR);
      const p = s && goal ? aEstrela(G, s, goal) : null;
      if (p && (!melhor || p.length < melhor.length)) melhor = p;
    });
    if (!melhor) throw new Error('A* não encontrou caminho a pé até a vaga ' + VAGA_ID + '.');
    let simples = simplificar(G, melhor).map((c) => { const m = metersOf(c); return P(m[0], m[1], zS); });
    simples = colapsarCurtos(douglasPeucker(simples, 0.6), 3.0);
    while (simples.length > 2 && Math.hypot(simples[simples.length - 1].x - acesso[0], simples[simples.length - 1].y - acesso[1]) < 5) simples.pop();
    const ss1 = [P(cf[0], cf[1], zS)].concat(simples.filter((p) => Math.hypot(p.x - cf[0], p.y - cf[1]) > 0.5));
    ss1.push(P(acesso[0], acesso[1], zS));
    ss1.push(P(vaga.x, vaga.y + fy * (vaga.h / 2 - 0.4), zS)); // para na frente do carro

    const nodes = terreo.concat(link.slice(0, -1), ss1);
    return { nodes, iT, iS, vaga, foyer, acessivel, origem, fy };
  }

  function buildModel(rota) {
    const { nodes, iT, iS, vaga, origem, acessivel } = rota;
    const pts = buildPoints(nodes, CORNER_R, 2.5);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const N = SAMPLES, P = [], Tg = [];
    for (let i = 0; i <= N; i++) { P.push(curve.getPointAt(i / N)); Tg.push(curve.getTangentAt(i / N)); }
    const K = 14, turn = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const u = Tg[i], v = Tg[Math.min(N, i + K)], lu = Math.hypot(u.x, u.y), lv = Math.hypot(v.x, v.y);
      if (lu < 1e-4 || lv < 1e-4) continue;
      turn[i] = clamp(Math.acos(clamp((u.x * v.x + u.y * v.y) / (lu * lv), -1, 1)) / (Math.PI / 2), 0, 1);
    }
    const cumM = new Float32Array(N + 1), cumT = new Float32Array(N + 1);
    for (let i = 1; i <= N; i++) {
      const dm = P[i].distanceTo(P[i - 1]), dz = Math.abs(P[i].z - P[i - 1].z) / Math.max(dm, 1e-6);
      let v = WALK_SPEED * (1 - 0.35 * turn[i]);
      if (dz > 0.05) v = acessivel ? 1.0 : 0.7; // escada rolante / elevador
      cumM[i] = cumM[i - 1] + dm; cumT[i] = cumT[i - 1] + dm / v;
    }
    const total = cumM[N];
    let from = 0;
    const markOf = (n) => {
      const nv = new THREE.Vector3(n.x, n.y, n.z); let best = Infinity, bi = from;
      for (let i = from; i <= N; i++) { const d = P[i].distanceToSquared(nv); if (d < best) { best = d; bi = i; } }
      from = bi; return cumM[bi];
    };
    const marks = nodes.map(markOf);

    // passo a passo: Térreo -> descida -> trechos do SS1 (curvas a < 12 m formam uma só)
    const ult = nodes.length - 2, m0 = marks[iT], m1 = marks[iS];
    const steps = [
      { nivel: 'Térreo', titulo: 'Siga até a torre de elevadores', detalhe: origem.go, a: 0, b: m0 },
      { nivel: 'Descida', titulo: 'Desça ao ' + PAVIMENTO,
        detalhe: acessivel ? 'Pegue o elevador (E1/E2) e desça um pavimento.' : 'Pegue a escada rolante e desça um pavimento (o elevador E1/E2 fica ao lado).', a: m0, b: m1 },
    ];
    const cortes = []; // {m, dir}
    let k = iS + 1;
    while (k < ult) {
      let soma = 0, mSum = 0, cnt = 0, j = k;
      for (;;) { soma += angAt(nodes, j); mSum += marks[j]; cnt++; if (j + 1 < ult && marks[j + 1] - marks[j] < 12) j++; else break; }
      if (Math.abs(soma) >= 45) cortes.push({ m: mSum / cnt, dir: soma > 0 ? 'esquerda' : 'direita' });
      k = j + 1;
    }
    const aFinal = angAt(nodes, ult), lado = aFinal > 0 ? 'esquerda' : 'direita';
    let prev = m1, prevTitulo = 'Saia do foyer e siga em frente';
    cortes.forEach((c) => {
      steps.push({ nivel: PAVIMENTO, titulo: prevTitulo, detalhe: 'Siga por cerca de ' + Math.max(1, Math.round((c.m - prev) / 5) * 5) + ' m.', a: prev, b: c.m });
      prev = c.m; prevTitulo = 'Vire à ' + c.dir + ' e siga em frente';
    });
    steps.push({ nivel: PAVIMENTO, titulo: prevTitulo, detalhe: 'Siga por cerca de ' + Math.max(1, Math.round((marks[ult] - prev) / 5) * 5) + ' m até a fileira da vaga.', a: prev, b: marks[ult] });
    steps.push({ nivel: PAVIMENTO, titulo: 'Vaga ' + vaga.codigo + ' à ' + lado,
      detalhe: 'Vire à ' + lado + ' e siga até a frente do seu carro, estacionado na vaga ' + vaga.codigo + '.', a: marks[ult], b: total });
    steps.forEach((s) => { s.a /= total; s.b /= total; });
    steps[steps.length - 1].b = 1;
    return { curve, pts, N, P, Tg, cumM, cumT, total, totalT: cumT[N], steps, length: curve.getLength() };
  }

  /* ======================================================================== */
  /* HELPERS DE CENA                                                          */
  /* ======================================================================== */
  function personMarker() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x00e5ff, emissiveIntensity: 1.3, transparent: true });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), mat); head.position.z = 1.65;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 1.15, 14), mat); body.rotation.x = Math.PI / 2; body.position.z = 0.78;
    [head, body].forEach((m) => { m.renderOrder = 12; });
    g.add(head, body);
    return g;
  }
  function disposeGroup(g) {
    g.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
  }
  const fmtT = (s) => { const t = Math.max(0, Math.round(s)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  const hasFsApi = () => !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);

  function safeBack(fallback) {
    try {
      if (document.referrer && window.history.length > 1) {
        const u = new URL(document.referrer);
        if (u.origin === window.location.origin && /(monitoramento|principal|index)\.html$/.test(u.pathname)) { window.history.back(); return; }
      }
    } catch (e) { /* referrer inválido */ }
    window.location.assign(fallback);
  }

  /* ======================================================================== */
  /* UI                                                                       */
  /* ======================================================================== */
  function Splash({ msg, error }) {
    return (
      <div className="ec-stage ec-splash">
        <style>{CSS}</style>
        <div role={error ? 'alert' : 'status'} className={'ec-splash-box' + (error ? ' err' : '')}>
          {!error && <span className="ec-spin" />}
          <p>{error || msg}</p>
          {error && <button className="ec-btn" onClick={() => window.location.reload()}>Tentar novamente</button>}
        </div>
      </div>
    );
  }
  class ErrorBoundary extends React.Component {
    constructor(p) { super(p); this.state = { err: null }; }
    static getDerivedStateFromError(err) { return { err }; }
    componentDidCatch(err) { console.error('[encontremeucarro]', err); }
    render() { return this.state.err ? <Splash error={'Erro ao exibir a tela: ' + (this.state.err.message || this.state.err)} /> : this.props.children; }
  }

  function EncontreMeuCarro({ mapa }) {
    const stageRef = useRef(null), mountRef = useRef(null), three = useRef(null);
    const sim = useRef({ playing: false, t: 0, speed: 2, mode: 'overview', manual: false, boost: 0, model: null, fit: null, dirty: true, initHeading: true, focusT: -1, goal: null });
    const bay = React.useMemo(() => acharVaga(mapa, VAGA_ID), [mapa]);

    const [origemId, setOrigemId] = useState(null), [acessivel, setAcessivel] = useState(false), [picker, setPicker] = useState(true);
    const [cardOpen, setCardOpen] = useState(true), [listOpen, setListOpen] = useState(false), [erro, setErro] = useState(null), [rota, setRota] = useState(null);
    const [hud, setHud] = useState({ pct: 0, step: 0, level: 'Térreo', eta: 0 });
    const [playing, setPlaying] = useState(false), [mode, setModeState] = useState('overview'), [manual, setManual] = useState(false);
    const [speed, setSpeed] = useState(2), [isFs, setIsFs] = useState(false);
    const origem = ORIGENS.find((o) => o.id === origemId) || null;

    /* ---------------- cena base (uma vez) ---------------- */
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

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a1220);
      const camera = new THREE.PerspectiveCamera(FOV_OVERVIEW, 1, 0.3, 1500);
      camera.up.set(0, 0, 1);
      camera.position.set(-20, -110, 100);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true; controls.dampingFactor = 0.08; controls.screenSpacePanning = true; controls.minDistance = 4; controls.maxDistance = 500;
      controls.addEventListener('start', () => { const S = sim.current; S.goal = null; if (!S.manual) { S.manual = true; setManual(true); } });

      scene.add(new THREE.AmbientLight(0xffffff, physical ? 1.9 : 0.95));
      const sun = new THREE.DirectionalLight(0xffffff, physical ? 1.5 : 0.75); sun.position.set(60, -80, 160); scene.add(sun);

      const fT = makeFloor(mapa.meta.texturas.terreo, 'TÉRREO', 0, FADE_TOP, 2, renderer, planeWithHole(mapa, null));
      const fS = makeFloor(mapa.meta.texturas.subsolo, 'SUBSOLO SS1', -GAP, 0.97, 1, renderer, planeWithHole(mapa, null));
      scene.add(fT.mesh, fS.mesh, buildCenario(mapa, bay.id));

      // o carro do usuário, estacionado na vaga (de frente para o fundo da vaga), com marcador amarelo
      const meuCarro = buildCar(lk);
      meuCarro.position.set(bay.x, bay.y, -GAP + 0.02); meuCarro.rotation.z = bay.frente === 'N' ? -Math.PI / 2 : Math.PI / 2; meuCarro.scale.set(0.92, 0.92, 0.92);
      const spotRing = makeRing(0xfacc15, 1.6, 2.3); spotRing.position.set(bay.x, bay.y, -GAP + 0.1);
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 9, 8), new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.55 }));
      beacon.rotation.x = Math.PI / 2; beacon.position.set(bay.x, bay.y, -GAP + 4.5); beacon.renderOrder = 8;
      const lblSpot = makeLabel('Seu carro · ' + VAGA_ID, '#facc15', 5, 1.25); lblSpot.position.set(bay.x, bay.y, -GAP + 9);
      const lT = makeLabel('TÉRREO', '#7dd3fc', 14, 3.5); lT.position.set(-70, -58, 1);
      const lS = makeLabel('SUBSOLO SS1', '#7dd3fc', 14, 3.5); lS.position.set(-70, -58, -GAP + 1);
      scene.add(meuCarro, spotRing, beacon, lblSpot, lT, lS);

      const routeGroup = new THREE.Group(); scene.add(routeGroup);
      const walker = personMarker(); walker.visible = false; scene.add(walker);
      const walkRing = makeRing(0x00f0ff, 0.5, 0.85); walkRing.visible = false; scene.add(walkRing);

      const cv0 = criarConversores(mapa), tw = cv0.terPxToM(TORRE_TERREO_PX[0], TORRE_TERREO_PX[1]);
      sim.current.fit = new THREE.Box3().setFromPoints([new THREE.Vector3(tw[0], tw[1], 0), new THREE.Vector3(bay.x, bay.y, -GAP)]).expandByScalar(28);

      const resize = () => {
        const w = Math.max(mount.clientWidth, 1), h = Math.max(mount.clientHeight, 1);
        camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
      };
      resize();
      let ro = null; if (window.ResizeObserver) { ro = new ResizeObserver(resize); ro.observe(mount); }
      window.addEventListener('resize', resize);
      three.current = { scene, camera, controls, routeGroup, walker, walkRing };

      const pos = new THREE.Vector3(), tan = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3(), goalPos = new THREE.Vector3(), goalTgt = new THREE.Vector3();
      const hS = new THREE.Vector2(1, 0), clock = new THREE.Clock(), bc = new THREE.Vector3(), bs = new THREE.Vector3();
      let kappa = 0, phiS = 0, lastSeg = -1, lastHud = 0, raf = 0, frames = 0, acc = 0, firstFrame = true;

      const loop = () => {
        raf = requestAnimationFrame(loop);
        const rawDt = clock.getDelta(), dt = Math.min(rawDt, 0.05), now = clock.elapsedTime, S = sim.current, M = S.model;
        const pu = 1 + 0.18 * Math.sin(now * 4);
        spotRing.scale.set(pu, pu, 1);
        lblSpot.scale.set(5 * clamp(camera.position.distanceTo(lblSpot.position) * 0.016, 0.9, 4.5) / 1.25, clamp(camera.position.distanceTo(lblSpot.position) * 0.016, 0.9, 4.5), 1);
        lT.visible = lS.visible = S.mode === 'overview';

        let carZ = 0;
        if (M) {
          if (S.playing) {
            S.t += dt * S.speed;
            if (S.t >= M.totalT) { S.t = M.totalT; S.playing = false; setPlaying(false); S.dirty = true; }
          }
          const idx = idxOf(M.cumT, S.t), u = idx / M.N, meters = sampleAt(M.cumM, idx);
          M.curve.getPointAt(u, pos); M.curve.getTangentAt(u, tan);
          carZ = pos.z;
          walker.visible = walkRing.visible = true;
          walker.position.set(pos.x, pos.y, pos.z - LIFT + 0.02); walkRing.position.set(pos.x, pos.y, pos.z - LIFT + 0.08);
          walkRing.scale.set(pu, pu, 1);
          const hxy = Math.hypot(tan.x, tan.y); if (hxy > 0.05) walker.rotation.z = Math.atan2(tan.y, tan.x);

          const seg = Math.min(TUBE_SEGS - 1, Math.floor(u * TUBE_SEGS));
          const rg = M.tube;
          if (rg && seg !== lastSeg) { lastSeg = seg; const st = seg * TUBE_RADIAL * 6; rg.core.setDrawRange(st, rg.total - st); rg.glow.setDrawRange(st, rg.total - st); }

          // câmera
          S.boost = Math.min(1, S.boost + dt / 1.2);
          const rate = 2 + 5 * S.boost;
          if (S.mode === 'follow') {
            const stepLook = CHASE.look / M.length, stepCurve = CHASE.curveLook / M.length;
            M.curve.getTangentAt(Math.min(1, u + stepLook), tB);
            let hx = tan.x * 0.4 + tB.x * 0.6, hy = tan.y * 0.4 + tB.y * 0.6;
            const hl = Math.hypot(hx, hy);
            if (hl > 1e-4) {
              hx /= hl; hy /= hl;
              if (S.initHeading) { hS.set(hx, hy); S.initHeading = false; }
              const kh = 1 - Math.exp(-3.5 * dt); hS.x += (hx - hS.x) * kh; hS.y += (hy - hS.y) * kh;
              const n = Math.hypot(hS.x, hS.y) || 1; hS.x /= n; hS.y /= n;
            }
            M.curve.getTangentAt(Math.min(1, u + stepCurve), tC);
            const la = Math.hypot(tan.x, tan.y), lc = Math.hypot(tC.x, tC.y);
            const kt = la > 1e-4 && lc > 1e-4 ? clamp(Math.acos(clamp((tan.x * tC.x + tan.y * tC.y) / (la * lc), -1, 1)) / (Math.PI / 2), 0, 1) : 0;
            kappa += (kt - kappa) * (1 - Math.exp(-3 * dt));
            const phi0 = Math.atan2(tan.z, Math.hypot(tan.x, tan.y)), phi1 = Math.atan2(tB.z, Math.hypot(tB.x, tB.y));
            phiS += ((phi0 + phi1) * 0.5 - phiS) * (1 - Math.exp(-5 * dt));
            if (!S.manual) {
              const B = CHASE.back + 3 * kappa, H = CHASE.height + 3 * kappa, A = CHASE.ahead - 2 * kappa;
              const psi = CHASE.tilt * phiS, cp = Math.cos(psi), sp = Math.sin(psi);
              const fx = cp * hS.x, fy = cp * hS.y, fz = sp, nx = -sp * hS.x, ny = -sp * hS.y, nz = cp;
              goalPos.set(pos.x - fx * B + nx * H, pos.y - fy * B + ny * H, pos.z - fz * B + nz * H);
              goalTgt.set(pos.x + fx * A + nx * 0.8, pos.y + fy * A + ny * 0.8, pos.z + fz * A + nz * 0.8);
              if (firstFrame) { camera.position.copy(goalPos); controls.target.copy(goalTgt); }
              camera.position.lerp(goalPos, 1 - Math.exp(-rate * dt)); controls.target.lerp(goalTgt, 1 - Math.exp(-(rate + 1.5) * dt));
            }
          }
          if (now - lastHud > 0.1 || S.dirty) {
            S.dirty = false; lastHud = now;
            const f = meters / M.total; let si = M.steps.findIndex((s) => f <= s.b + 1e-6); if (si < 0) si = M.steps.length - 1;
            setHud({ pct: clamp(f * 100, 0, 100), step: si, eta: Math.max(0, M.totalT - S.t), level: pos.z > -GAP * 0.25 ? 'Térreo' : pos.z < -GAP * 0.75 ? PAVIMENTO : 'Descida' });
          }
        } else { walker.visible = walkRing.visible = false; }

        const fz = clamp((carZ + GAP * 0.55) / (GAP * 0.45), 0, 1);
        const alvo = FADE_LOW + (FADE_TOP - FADE_LOW) * fz * fz * (3 - 2 * fz);
        fT.mat.opacity += ((M ? alvo : (S.showSS1 ? 0.16 : FADE_TOP)) - fT.mat.opacity) * (1 - Math.exp(-6 * dt));

        const fovGoal = S.mode === 'follow' ? FOV_FOLLOW : FOV_OVERVIEW;
        if (Math.abs(camera.fov - fovGoal) > 0.05) { camera.fov += (fovGoal - camera.fov) * (1 - Math.exp(-4 * dt)); camera.updateProjectionMatrix(); }
        if (S.mode === 'overview' && !S.manual) {
          S.fit.getCenter(bc); S.fit.getSize(bs);
          const tn = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), d = Math.max((bs.y / 2) / tn, (bs.x / 2) / (tn * camera.aspect)) * 1.08;
          goalPos.set(bc.x, bc.y - d * 0.3, d + 4); goalTgt.set(bc.x, bc.y - d * 0.14, -GAP * 0.4);
          const rate = 2 + 5 * (S.boost = Math.min(1, S.boost + dt / 1.2));
          if (firstFrame) { camera.position.copy(goalPos); controls.target.copy(goalTgt); }
          camera.position.lerp(goalPos, 1 - Math.exp(-rate * dt)); controls.target.lerp(goalTgt, 1 - Math.exp(-rate * dt));
        }
        firstFrame = false;
        controls.update();

        frames++; acc += rawDt;
        if (frames === 90) { if (acc / frames > 0.032 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.5); renderer.setPixelRatio(pixelRatio); resize(); } frames = 0; acc = 0; }
        renderer.render(scene, camera);
      };
      loop();
      window.__nav = { sim: sim.current, camera, controls, scene };

      return () => {
        cancelAnimationFrame(raf); if (ro) ro.disconnect(); window.removeEventListener('resize', resize); controls.dispose();
        disposeGroup(scene); renderer.dispose();
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
        three.current = null;
      };
    }, []);

    /* ---------------- rota (quando muda a origem ou o modo acessível) ---------------- */
    useEffect(() => {
      const tc = three.current; if (!tc) return;
      const S = sim.current, g = tc.routeGroup;
      while (g.children.length) disposeGroup(g.children.pop());
      S.playing = false; S.t = 0; S.model = null; S.dirty = true; setPlaying(false); setRota(null);
      if (!origem) return;
      let m, r;
      try { r = montarRotaPedestre(mapa, origem, acessivel); m = buildModel(r); } catch (e) { console.error(e); setErro('Não foi possível calcular a rota: ' + e.message); return; }
      setErro(null);
      const core = new THREE.Mesh(new THREE.TubeGeometry(m.curve, TUBE_SEGS, TUBE_R, TUBE_RADIAL, false), new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, depthTest: false }));
      const glow = new THREE.Mesh(new THREE.TubeGeometry(m.curve, TUBE_SEGS, TUBE_R * 2.6, TUBE_RADIAL, false),
        new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
      core.renderOrder = 20; glow.renderOrder = 21; g.add(core, glow);
      m.tube = { core: core.geometry, glow: glow.geometry, total: core.geometry.index.count };
      const o = r.nodes[0], ring = makeRing(0x4ade80, 1.2, 1.8); ring.position.set(o.x, o.y, 0.1);
      const lbl = makeLabel('Você está aqui', '#4ade80', 7, 1.75); lbl.position.set(o.x, o.y, 5);
      g.add(ring, lbl);
      S.model = m; S.fit = new THREE.Box3().setFromPoints(m.pts).expandByScalar(16);
      S.manual = false; S.boost = 0; S.mode = 'overview'; S.initHeading = true; setModeState('overview'); setManual(false);
      setRota({ steps: m.steps, total: m.total, totalT: m.totalT });
    }, [origemId, acessivel]);

    useEffect(() => {
      const on = () => setIsFs(!!(document.fullscreenElement || document.webkitFullscreenElement));
      document.addEventListener('fullscreenchange', on); document.addEventListener('webkitfullscreenchange', on);
      return () => { document.removeEventListener('fullscreenchange', on); document.removeEventListener('webkitfullscreenchange', on); };
    }, []);

    /* ---------------- ações ---------------- */
    const escolher = (id) => { setOrigemId(id); setPicker(false); setCardOpen(true); };
    const setCameraMode = useCallback((m) => { const S = sim.current; S.mode = m; S.manual = false; S.boost = 0; if (m === 'follow') S.initHeading = true; setModeState(m); setManual(false); }, []);
    const recenter = useCallback(() => { const S = sim.current; S.manual = false; S.boost = 0; setManual(false); }, []);
    const togglePlay = () => {
      const S = sim.current; if (!S.model) return;
      if (S.t >= S.model.totalT) S.t = 0;
      if (S.playing) { S.playing = false; setPlaying(false); return; }
      if (S.t === 0) setCameraMode('follow');
      S.playing = true; S.dirty = true; setPlaying(true);
    };
    const reiniciar = () => { const S = sim.current; S.t = 0; S.playing = false; S.dirty = true; setPlaying(false); setCameraMode('overview'); };
    const irParaPasso = (i) => {
      const S = sim.current; if (!S.model) return;
      const idx = idxOf(S.model.cumM, S.model.steps[i].a * S.model.total); // metros -> índice da amostra
      S.t = sampleAt(S.model.cumT, idx); S.playing = false; setPlaying(false); S.dirty = true; setCameraMode('follow');
    };
    const cycleSpeed = () => { const S = sim.current, n = SPEEDS[(SPEEDS.indexOf(S.speed) + 1) % SPEEDS.length]; S.speed = n; setSpeed(n); };
    const toggleFs = () => {
      if (!hasFsApi()) { setIsFs((v) => !v); return; }
      const el = stageRef.current;
      if (!(document.fullscreenElement || document.webkitFullscreenElement)) (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      else (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    };

    const pseudoFs = isFs && !hasFsApi();
    const emRota = !!(origem && rota);
    const minutos = rota ? Math.max(1, Math.round(rota.totalT / 60)) : 0;

    return (
      <div ref={stageRef} className="ec-stage" style={pseudoFs ? { position: 'fixed', inset: 0, zIndex: 9999 } : undefined}>
        <style>{CSS}</style>
        <div ref={mountRef} className="ec-canvas" />
        {erro && <div className="ec-erro" role="alert">{erro}</div>}

        <header className="ec-top">
          <button className="ec-btn" onClick={() => safeBack(BACK_URL)}>← Voltar</button>
          {emRota && !picker && (
            <div className="ec-seg" role="group" aria-label="Modo de câmera">
              <button className={mode === 'follow' ? 'on' : ''} aria-pressed={mode === 'follow'} onClick={() => setCameraMode('follow')}>Seguir</button>
              <button className={mode === 'overview' ? 'on' : ''} aria-pressed={mode === 'overview'} onClick={() => setCameraMode('overview')}>Visão geral</button>
            </div>
          )}
          <div className="ec-tools">
            {emRota && !picker && <button className="ec-btn" onClick={() => setPicker(true)} title="Trocar ponto de partida">Trocar</button>}
            <button className="ec-btn ec-sq" onClick={toggleFs} aria-label={isFs ? 'Sair da tela cheia' : 'Tela cheia'}>{isFs ? '⤡' : '⛶'}</button>
          </div>
        </header>

        {(picker || !emRota) && (
          <section className="ec-sheet" aria-label="Encontre meu carro">
            <h1>Encontre meu carro</h1>
            <div className="ec-vaga"><span>Vaga do seu ticket</span><strong>{VAGA_ID} · {PAVIMENTO}</strong></div>
            <h2>Onde você está agora?</h2>
            <ul className="ec-list" role="radiogroup">
              {ORIGENS.map((o) => (
                <li key={o.id}>
                  <button role="radio" aria-checked={o.id === origemId} className={'ec-opt' + (o.id === origemId ? ' on' : '')} onClick={() => escolher(o.id)}>
                    <strong>{o.label}</strong><span>{o.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {emRota && !picker && (
          <section className={'ec-card' + (cardOpen ? '' : ' closed')} aria-label="Passo a passo da caminhada">
            <button className="ec-card-head" onClick={() => setCardOpen((v) => !v)} aria-expanded={cardOpen}>
              <span><strong>De {origem.label} até a vaga {VAGA_ID}</strong><small>≈ {Math.round(rota.total)} m · {minutos} min a pé · {hud.level}</small></span>
              <span>{cardOpen ? '▾' : '▸'}</span>
            </button>
            {cardOpen && (
              <>
                <div className="ec-now" aria-live="polite">
                  <span className="ec-num on">{hud.step + 1}</span>
                  <span className="ec-txt"><strong>{rota.steps[hud.step].titulo}</strong><em>{rota.steps[hud.step].nivel}</em><span>{rota.steps[hud.step].detalhe}</span></span>
                </div>
                <div className="ec-bar"><div style={{ width: hud.pct + '%' }} /></div>
                <div className="ec-actions">
                  <button className="ec-btn ec-go" onClick={togglePlay}>{playing ? '⏸ Pausar' : hud.pct >= 100 ? '↺ Ver de novo' : hud.pct > 0 ? '▶ Continuar' : '▶ Acompanhar'}</button>
                  <button className="ec-btn" onClick={reiniciar} disabled={hud.pct === 0 && !playing} aria-label="Reiniciar">↺</button>
                  <button className={'ec-btn' + (manual ? ' ec-hint' : '')} onClick={recenter} aria-label="Recentralizar câmera">🎯</button>
                  <button className="ec-btn" onClick={cycleSpeed} aria-label={'Velocidade ' + speed + ' vezes'}>⚡{speed}×</button>
                  <button className={'ec-btn' + (acessivel ? ' ec-on' : '')} onClick={() => setAcessivel((v) => !v)} aria-pressed={acessivel} title="Rota acessível (elevador)" aria-label="Rota acessível, usar elevador">♿</button>
                </div>
                <button className="ec-more" onClick={() => setListOpen((v) => !v)} aria-expanded={listOpen}>{listOpen ? 'Ocultar passos ▴' : 'Ver todos os passos (' + rota.steps.length + ') ▾'}</button>
                {listOpen && (
                  <ol className="ec-steps">
                    {rota.steps.map((s, i) => (
                      <li key={i} className={i === hud.step && (hud.pct > 0 || playing) ? 'on' : i < hud.step ? 'done' : ''}>
                        <button onClick={() => irParaPasso(i)} aria-label={'Ver passo ' + (i + 1) + ' no mapa'}>
                          <span className="ec-num">{i < hud.step ? '✓' : i + 1}</span>
                          <span className="ec-txt"><strong>{s.titulo}</strong><em>{s.nivel}</em><span>{s.detalhe}</span></span>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </section>
        )}
      </div>
    );
  }

  const CSS = `
html,body{margin:0;height:100%;background:#0a1220}
.ec-stage{position:relative;width:100%;height:100vh;height:100dvh;overflow:hidden;background:#0a1220;color:#e6f1ff;font-family:"Segoe UI",system-ui,-apple-system,Roboto,sans-serif;-webkit-tap-highlight-color:transparent}
.ec-canvas{position:absolute;inset:0}
.ec-top{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;gap:6px;padding:max(8px,env(safe-area-inset-top)) 8px 0;pointer-events:none}
.ec-top>*{pointer-events:auto}.ec-tools{display:flex;gap:6px}
.ec-btn{white-space:nowrap;appearance:none;border:1px solid rgba(125,211,252,.35);background:rgba(10,18,32,.84);color:#e6f1ff;padding:9px 12px;border-radius:11px;font:600 13px/1 inherit;font-family:inherit;cursor:pointer;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.ec-btn:hover:not(:disabled){background:rgba(24,44,72,.92);border-color:#7dd3fc}.ec-btn:disabled{opacity:.45;cursor:default}.ec-sq{padding:9px 11px}
.ec-btn:focus-visible,.ec-opt:focus-visible,.ec-card-head:focus-visible,.ec-steps button:focus-visible,.ec-seg button:focus-visible{outline:2px solid #00f0ff;outline-offset:2px}
.ec-go{background:#00c8d8;border-color:#00f0ff;color:#04202a;flex:1}.ec-go:hover:not(:disabled){background:#00e5ff}
.ec-hint{border-color:#00f0ff;animation:ecPulse 1.4s ease-in-out infinite}
.ec-seg{display:flex;padding:3px;border-radius:11px;background:rgba(10,18,32,.84);border:1px solid rgba(125,211,252,.35)}
.ec-seg button{white-space:nowrap;appearance:none;border:0;background:none;color:#b6c9df;padding:7px 10px;border-radius:8px;font:600 12px/1 inherit;font-family:inherit;cursor:pointer}.ec-seg button.on{background:#00c8d8;color:#04202a}
.ec-sheet,.ec-card{position:absolute;background:rgba(10,18,32,.9);border:1px solid rgba(125,211,252,.3);border-radius:14px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.ec-sheet{top:calc(max(8px,env(safe-area-inset-top)) + 46px);left:8px;width:min(380px,calc(100% - 16px));max-height:calc(100% - 70px);overflow:auto;padding:14px}
.ec-sheet h1{margin:0 0 10px;font-size:19px}.ec-sheet h2{margin:14px 0 8px;font-size:14px;color:#b6c9df}
.ec-vaga{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:10px;background:rgba(250,204,21,.1);border:1px solid rgba(250,204,21,.5)}.ec-vaga span{font-size:12px;color:#fde68a}.ec-vaga strong{font-size:18px;color:#facc15}
.ec-list{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.ec-opt{width:100%;display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;padding:9px 12px;border-radius:10px;background:rgba(15,34,54,.7);border:1px solid rgba(125,211,252,.25);color:#e6f1ff;font-family:inherit;cursor:pointer}
.ec-opt span{font-size:12px;color:#9db4cc}.ec-opt:hover{border-color:#7dd3fc}.ec-opt.on{border-color:#00f0ff;background:rgba(0,240,255,.12)}
.ec-card{left:50%;bottom:max(8px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(560px,calc(100% - 16px));max-height:50vh;display:flex;flex-direction:column;overflow:hidden}
.ec-card-head{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;padding:10px 12px;background:none;border:0;color:#e6f1ff;font-family:inherit;text-align:left;cursor:pointer}
.ec-card-head span:first-child{display:flex;flex-direction:column;gap:2px}.ec-card-head small{color:#9db4cc;font-size:11.5px}
.ec-now{display:flex;gap:9px;padding:4px 12px 2px;align-items:flex-start}.ec-num.on{background:#00f0ff;color:#04202a;border-color:#00f0ff}
.ec-on{border-color:#00f0ff;box-shadow:inset 0 0 0 1px #00f0ff}
.ec-more{appearance:none;background:none;border:0;color:#7dd3fc;font:600 12px/1 inherit;font-family:inherit;padding:2px 12px 10px;text-align:left;cursor:pointer}
.ec-steps{list-style:none;margin:0;padding:0 8px 8px;overflow:auto;max-height:26vh}
.ec-steps button{width:100%;display:flex;gap:9px;text-align:left;padding:7px 6px;border-radius:8px;background:none;border:0;color:inherit;font-family:inherit;cursor:pointer;opacity:.62}
.ec-steps li.on button{opacity:1;background:rgba(0,240,255,.1)}.ec-steps li.done button{opacity:.4}
.ec-num{flex:0 0 22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;background:#0f2236;border:1px solid #38bdf8}.ec-steps li.on .ec-num{background:#00f0ff;color:#04202a;border-color:#00f0ff}
.ec-txt{display:flex;flex-direction:column;gap:1px;font-size:12.5px;line-height:1.35;color:#b6c9df}.ec-txt strong{font-size:13.5px;color:#e6f1ff}.ec-txt em{font-style:normal;font-size:11px;color:#7dd3fc}
.ec-bar{height:4px;margin:6px 12px 0;border-radius:2px;background:rgba(125,211,252,.2);overflow:hidden}.ec-bar div{height:100%;background:#00f0ff;box-shadow:0 0 8px #00f0ff}
.ec-actions{display:flex;align-items:center;gap:6px;padding:8px 12px 8px}
.ec-erro{position:absolute;left:8px;right:8px;bottom:60px;padding:12px 14px;border-radius:10px;background:#3b0d12;border:1px solid #f87171;color:#fecaca;font-size:14px}
.ec-splash{display:grid;place-items:center}.ec-splash-box{text-align:center;padding:24px;max-width:340px}.ec-splash-box.err p{color:#fecaca}
.ec-spin{display:block;width:34px;height:34px;margin:0 auto 14px;border-radius:50%;border:3px solid rgba(125,211,252,.25);border-top-color:#00f0ff;animation:ecSpin .9s linear infinite}
@keyframes ecSpin{to{transform:rotate(360deg)}}@keyframes ecPulse{0%,100%{box-shadow:0 0 0 0 rgba(0,240,255,.5)}50%{box-shadow:0 0 0 8px rgba(0,240,255,0)}}
@media (prefers-reduced-motion:reduce){.ec-hint,.ec-spin{animation:none}}
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
        if (Date.now() - t0 > timeoutMs) { reject(new Error(!T ? 'Não foi possível carregar o Three.js. Verifique sua conexão e recarregue a página.' : 'O OrbitControls não foi carregado (inclua examples/js/controls/OrbitControls.js depois do three.js).')); return; }
        setTimeout(check, 50);
      })();
    });
  }
  function carregarMapa() {
    if (window.MAPA_ESTACIA) return Promise.resolve(window.MAPA_ESTACIA);
    return fetch(MAPA_URL).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch((e) => { throw new Error('Não consegui carregar o mapa (' + MAPA_URL + '): ' + e.message + '. Rode scripts/extrair_mapa.py e inclua assets/mapa_estacia.js no HTML.'); });
  }
  function bootstrap() {
    const rootEl = document.getElementById('root');
    if (!rootEl) { console.error('[encontremeucarro] elemento #root não encontrado'); return; }
    const root = ReactDOM.createRoot(rootEl);
    root.render(<Splash msg="Carregando motor 3D e mapa…" />);
    Promise.all([waitForDeps(12000), carregarMapa()])
      .then(([, mapa]) => root.render(<ErrorBoundary><EncontreMeuCarro mapa={mapa} /></ErrorBoundary>))
      .catch((e) => root.render(<Splash error={e.message} />));
  }
  if (window.__ENC_TEST__) window.__ENC_TEST__.api = { ORIGENS, montarRotaPedestre, buildModel, setT: (t) => { THREE = t; E3D.init(t); } };
  else bootstrap();
})();
