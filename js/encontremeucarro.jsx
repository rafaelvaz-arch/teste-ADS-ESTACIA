/* =============================================================================
 * js/encontremeucarro.jsx
 * "Encontre Meu Carro" — rota pedestre 3D (Térreo ⇄ Subsolo SS1)
 * ========================================================================== */
(function () {
  const React = window.React;
  const ReactDOM = window.ReactDOM;

  if (!React || !ReactDOM) {
    console.error("[encontremeucarro] React ou ReactDOM não encontrados.");
    return;
  }

  const { useState, useEffect, useRef, useMemo } = React;

  /* ======================================================================== */
  /* CONFIGURAÇÃO                                                             */
  /* ======================================================================== */
  const PLANE_W = 56;
  const PLANE_H = 38;
  const Z_T = 12.0;
  const Z_S = -12.0;
  const LIFT = 0.3; // rota acima do piso (evita z-fighting)
  const CORNER_R = 1.0;
  const CAM_MIN_Z = 14; 
  const M_PER_UNIT = 3.2; 
  const WALK_SPEED = 1.3; // m/s
  const BACK_URL = 'monitoramento.html'; // Redirecionamento fixo para a tela de monitoramento
  const TICKET_KEYS = ['estacia_ticket', 'ticket', 'ticketAtivo'];

  const FLOORS = {
    terreo: { w: 1600, h: 872, url: 'assets/planta_terreo.png', z: Z_T },
    subsolo: { w: 1280, h: 720, url: 'assets/planta_subsolo.png', z: Z_S },
  };

  const toWorld = (floor, x, y) => ({
    x: (x / FLOORS[floor].w - 0.5) * PLANE_W,
    y: (0.5 - y / FLOORS[floor].h) * PLANE_H,
    z: FLOORS[floor].z + LIFT,
  });
  const T = (x, y) => toWorld('terreo', x, y);
  const S = (x, y) => toWorld('subsolo', x, y);

  const HUBS = {
    escada: { nome: 'escadas rolantes', unico: 'a escada rolante', s: S(625, 335), dy: -3 },
    elevador: { nome: 'elevadores', unico: 'o elevador', s: S(586, 335), dy: -0.25 },
  };

  const ORIGENS = [
    { id: 'entrada-principal', label: 'Entrada Principal', hint: 'Acesso oeste (noite)',
      path: [[215, 428], [560, 428], [690, 480]],
      go: 'Entre pelo eixo principal e siga direto pela Praça Central, em direção às escadas rolantes.' },
    { id: 'entrada-sul', label: 'Entrada Sul', hint: 'Porte-cochère', south: true,
      path: [[808, 640], [808, 560], [786, 520]],
      go: 'Siga em frente pela entrada sul, em direção ao átrio, onde ficam as escadas rolantes.' },
    { id: 'entrada-leste', label: 'Entrada Leste', hint: 'Acesso leste',
      path: [[1405, 430], [1060, 430], [900, 480]],
      go: 'Atravesse a Praça do Fogo e siga reto em direção ao átrio, onde ficam as escadas rolantes.' },
    { id: 'praca-alimentacao', label: 'Praça de Alimentação', hint: 'Restaurantes e fast food',
      path: [[1000, 565], [905, 510], [850, 480]],
      go: 'Saia da praça de alimentação para o lado oeste e siga em direção às escadas rolantes, ao lado do átrio.' },
    { id: 'ancoras-oeste', label: 'Lojas Âncoras — ala oeste', hint: 'Lojas Americanas / C&A',
      path: [[385, 345], [560, 420], [690, 480]],
      go: 'Pegue o corredor da ala oeste, siga em direção à Praça Central e continue até as escadas rolantes.' },
    { id: 'ancoras-leste', label: 'Lojas Âncoras — ala leste', hint: 'C&A / Riachuelo',
      path: [[1215, 345], [1060, 420], [900, 480]],
      go: 'Pegue o corredor da ala leste, siga em direção à Praça Central e continue até as escadas rolantes.' },
    { id: 'cinemas', label: 'Cinemas', hint: 'Ala leste (posição estimada)',
      path: [[1130, 300], [1010, 400], [900, 480]],
      go: 'Desça pelo corredor em direção à Praça Central e siga até as escadas rolantes, no átrio.' },
  ];

  const VAGAS = {
    'A-144': { nivel: 'subsolo', px: [425, 214], aisleY: 168 },
    'A-145': { nivel: 'subsolo', px: [440, 214], aisleY: 168 },
    'A-146': { nivel: 'subsolo', px: [455, 214], aisleY: 168 },
    'T-032': { nivel: 'terreo', px: [690, 700] },
  };
  const NIVEL_LABEL = { subsolo: 'Subsolo SS1', terreo: 'Térreo' };

  /* ======================================================================== */
  /* DADOS & HELPERS                                                          */
  /* ======================================================================== */
  async function carregarVagaSalva() {
    const q = new URLSearchParams(window.location.search);
    if (q.get('vaga')) return { vaga: q.get('vaga'), ticket: q.get('ticket'), fonte: 'url' };

    for (const k of TICKET_KEYS) {
      try {
        const raw = window.localStorage.getItem(k);
        if (!raw) continue;
        const o = JSON.parse(raw);
        const vaga = o.vaga || o.codigoVaga || o.spot;
        if (vaga) return { ...o, vaga, fonte: 'ticket' };
      } catch (e) { }
    }
    return { vaga: 'A-145', pavimento: 'SS1', ticket: null, fonte: 'demo' };
  }

  function resolverVaga(ticket) {
    const code = String(ticket.vaga || '').trim().toUpperCase();
    let def = VAGAS[code];
    if (!def && ticket.coords) {
      const nivel = /te[rr]reo|térreo/i.test(ticket.pavimento || '') ? 'terreo' : 'subsolo';
      def = { nivel, px: [ticket.coords.x, ticket.coords.y], aisleY: ticket.coords.aisleY || 168 };
    }
    if (!def) return { ok: false, code };
    const world = def.nivel === 'terreo' ? T(def.px[0], def.px[1]) : S(def.px[0], def.px[1]);
    return { ok: true, code, nivel: def.nivel, world, def };
  }

  const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-3;
  const len3 = (n) => n.reduce((s, p, i) => (i ? s + Math.hypot(p.x - n[i - 1].x, p.y - n[i - 1].y, p.z - n[i - 1].z) : 0), 0);
  const lenXY = (n) => n.reduce((s, p, i) => (i ? s + Math.hypot(p.x - n[i - 1].x, p.y - n[i - 1].y) : 0), 0);
  const lado = (esquerda) => (esquerda ? 'esquerda' : 'direita');

  function montarRota(o, vaga, acessivel) {
    const hub = acessivel ? HUBS.elevador : HUBS.escada;
    const code = vaga.code;
    const secs = [];

    if (vaga.nivel === 'subsolo') {
      const hs = hub.s;
      const ht = { x: hs.x, y: hs.y + hub.dy, z: Z_T + LIFT };
      const cx = S(620, 0).x;
      const aisle = S(0, vaga.def.aisleY).y;
      const corr = { x: cx, y: aisle, z: Z_S + LIFT };
      const sp = vaga.world;

      const s3 = [hs];
      if (Math.abs(hs.x - cx) > 0.3) s3.push({ x: cx, y: hs.y, z: hs.z });
      s3.push(corr);

      const dirX = Math.sign(sp.x - cx) || -1;
      const viraEsq = dirX < 0; 
      const ladoVaga = dirX * (sp.y - aisle) > 0; 

      secs.push(
        { nodes: [...o.path.map(([x, y]) => T(x, y)), ht], nivel: 'Térreo',
          titulo: 'Siga em direção ' + (acessivel ? 'aos elevadores' : 'às escadas rolantes'), detalhe: o.go },
        { nodes: [ht, hs], nivel: 'Descida',
          titulo: 'Desça ao ' + NIVEL_LABEL.subsolo,
          detalhe: 'Use ' + hub.unico + ' para descer um pavimento. Você chega ao foyer central do SS1.' },
        { nodes: s3, nivel: NIVEL_LABEL.subsolo,
          titulo: 'Siga pelo corredor central',
          detalhe: 'Saia do foyer e siga em frente, no sentido norte, até o cruzamento com a Alameda Norte.' },
        { nodes: [corr, { x: sp.x, y: aisle, z: corr.z }, sp], nivel: NIVEL_LABEL.subsolo,
          titulo: 'Vaga ' + code + ' à ' + lado(ladoVaga),
          detalhe: 'Vire à ' + lado(viraEsq) + ' na Alameda Norte e siga até a vaga ' + code + ', que fica à ' + lado(ladoVaga) + '.' }
      );
    } else {
      const sp = vaga.world;
      const saida = T(808, 640);
      const aprox = { x: saida.x, y: sp.y, z: saida.z };
      const viraEsq = sp.x > saida.x; 
      if (!o.south) {
        secs.push({
          nodes: [...o.path.map(([x, y]) => T(x, y)), T(808, 560), saida], nivel: 'Térreo',
          titulo: 'Siga até a Entrada Sul',
          detalhe: o.go.replace(/escadas rolantes[^.]*/i, 'Entrada Sul') });
      }
      secs.push(
        { nodes: [saida, aprox], nivel: 'Térreo', titulo: 'Saia para o estacionamento externo',
          detalhe: 'Atravesse a Entrada Sul e siga em frente pelo estacionamento externo.' },
        { nodes: [aprox, sp], nivel: 'Térreo', titulo: 'Vaga ' + code + ' à ' + lado(viraEsq),
          detalhe: 'Vire à ' + lado(viraEsq) + ' e siga até a vaga ' + code + '.' }
      );
    }

    const nodes = [];
    secs.forEach((s) => s.nodes.forEach((p) => { if (!nodes.length || !near(nodes[nodes.length - 1], p)) nodes.push(p); }));
    const lens = secs.map((s) => len3(s.nodes));
    const total = lens.reduce((a, b) => a + b, 0);
    let acc = 0;
    secs.forEach((s, i) => { s.a = acc / total; acc += lens[i]; s.b = acc / total; });

    const horizontal = secs.reduce((a, s) => a + lenXY(s.nodes), 0);
    const metros = Math.round(horizontal * M_PER_UNIT + (vaga.nivel === 'subsolo' ? 6 : 0));
    return { nodes, secs, metros, minutos: Math.max(1, Math.round(metros / WALK_SPEED / 60)), duracao: Math.min(38, Math.max(10, total / 2.2)) };
  }

  function buildPoints(nodes, radius, step) {
    const THREEObj = window.THREE;
    if (!THREEObj) return [];
    const V = (n) => new THREEObj.Vector3(n.x, n.y, n.z);
    const out = [];
    const push = (v) => { if (!out.length || out[out.length - 1].distanceTo(v) > 1e-4) out.push(v); };
    push(V(nodes[0]));
    for (let i = 1; i < nodes.length - 1; i++) {
      const prev = V(nodes[i - 1]), cur = V(nodes[i]), next = V(nodes[i + 1]);
      const d1 = new THREEObj.Vector2(cur.x - prev.x, cur.y - prev.y);
      const d2 = new THREEObj.Vector2(next.x - cur.x, next.y - cur.y);
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
        push(new THREEObj.Vector3().addScaledVector(a, (1 - t) * (1 - t)).addScaledVector(cur, 2 * (1 - t) * t).addScaledVector(b, t * t));
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

  /* ======================================================================== */
  /* THREE.JS HELPERS                                                         */
  /* ======================================================================== */
  const setTexSRGB = (t) => { 
    const THREEObj = window.THREE;
    if ('colorSpace' in t) t.colorSpace = THREEObj.SRGBColorSpace; else t.encoding = THREEObj.sRGBEncoding; 
  };

  function placeholderTexture(label, w, h) {
    const THREEObj = window.THREE;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#1b2430'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,160,200,.18)';
    for (let x = 0; x <= w; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = 'rgba(200,225,255,.5)'; g.font = 'bold 46px sans-serif'; g.textAlign = 'center';
    g.fillText(label, w / 2, h / 2);
    const t = new THREEObj.CanvasTexture(c); setTexSRGB(t); return t;
  }

  function makeFloor(key, label, opacity, order, renderer) {
    const THREEObj = window.THREE;
    const f = FLOORS[key];
    const mat = new THREEObj.MeshBasicMaterial({
      map: placeholderTexture(label + ' (carregando…)', f.w, f.h),
      transparent: true, opacity, side: THREEObj.DoubleSide, depthWrite: false,
    });
    const mesh = new THREEObj.Mesh(new THREEObj.PlaneGeometry(PLANE_W, PLANE_H), mat);
    mesh.position.set(0, 0, f.z);
    mesh.renderOrder = order;
    new THREEObj.TextureLoader().load(f.url, (tex) => {
      setTexSRGB(tex); 
      if (renderer.capabilities) tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      mat.map = tex; mat.needsUpdate = true;
    }, undefined, () => console.warn('[encontremeucarro] textura não carregou:', f.url));
    const frame = new THREEObj.LineSegments(new THREEObj.EdgesGeometry(mesh.geometry),
      new THREEObj.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 }));
    frame.position.copy(mesh.position); frame.renderOrder = order + 0.5;
    return [mesh, frame];
  }

  function makeRing(color, a, b) {
    const THREEObj = window.THREE;
    const m = new THREEObj.Mesh(new THREEObj.RingGeometry(a, b, 40),
      new THREEObj.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: THREEObj.DoubleSide, depthWrite: false }));
    m.renderOrder = 8; return m;
  }

  function personMarker() {
    const THREEObj = window.THREE;
    const g = new THREEObj.Group();
    const mat = new THREEObj.MeshStandardMaterial({ color: 0xffffff, emissive: 0x00e5ff, emissiveIntensity: 1.4, transparent: true });
    const head = new THREEObj.Mesh(new THREEObj.SphereGeometry(0.24, 16, 12), mat); head.position.z = 0.95;
    const body = new THREEObj.Mesh(new THREEObj.CylinderGeometry(0.18, 0.2, 0.62, 12), mat);
    body.rotation.x = Math.PI / 2; body.position.z = 0.4;
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

  /* ======================================================================== */
  /* COMPONENTE PRINCIPAL                                                      */
  /* ======================================================================== */
  function EncontreMeuCarro() {
    const mountRef = useRef(null);
    const three = useRef(null);
    const sim = useRef({ playing: false, progress: 0, curve: null, duration: 20, fracs: [], camGoal: null, focusUntil: 0 });

    const [ticket, setTicket] = useState(null);
    const [origemId, setOrigemId] = useState(null);
    const [acessivel, setAcessivel] = useState(false);
    const [picker, setPicker] = useState(true);
    const [cardOpen, setCardOpen] = useState(true);
    const [stepIdx, setStepIdx] = useState(0);
    const [pct, setPct] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [erro, setErro] = useState(null);

    const vaga = useMemo(() => (ticket ? resolverVaga(ticket) : null), [ticket]);
    const origem = ORIGENS.find((o) => o.id === origemId) || null;
    const plano = useMemo(
      () => (vaga && vaga.ok && origem ? montarRota(origem, vaga, acessivel) : null),
      [vaga, origem, acessivel]
    );

    useEffect(() => { carregarVagaSalva().then(setTicket); }, []);

    useEffect(() => {
      const mount = mountRef.current;
      if (!mount) return;

      const THREEObj = window.THREE;
      const OrbitControls = THREEObj ? (THREEObj.OrbitControls || window.OrbitControls) : null;

      if (!THREEObj || !OrbitControls) { 
        setErro('Dependências 3D não carregadas. Verifique a ordem dos scripts no HTML.'); 
        return undefined; 
      }

      setErro(null);

      const renderer = new THREEObj.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREEObj.SRGBColorSpace; else renderer.outputEncoding = THREEObj.sRGBEncoding;
      const k = 'outputColorSpace' in renderer ? 2 : 1;
      mount.appendChild(renderer.domElement);

      const scene = new THREEObj.Scene();
      scene.background = new THREEObj.Color(0x0a1220);
      const camera = new THREEObj.PerspectiveCamera(40, 1, 0.1, 500);
      camera.up.set(0, 0, 1);
      const HOME = { pos: new THREEObj.Vector3(0, -72, 52), target: new THREEObj.Vector3(0, 0, 0) };
      camera.position.copy(HOME.pos);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true; controls.dampingFactor = 0.08;
      controls.minDistance = 14; controls.maxDistance = 150;
      controls.addEventListener('start', () => { sim.current.camGoal = null; sim.current.focusUntil = 0; });
      controls.update();

      scene.add(new THREEObj.AmbientLight(0xffffff, 0.9 * k));
      const sun = new THREEObj.DirectionalLight(0xffffff, 0.8 * k); sun.position.set(20, -30, 60); scene.add(sun);

      scene.add(...makeFloor('terreo', 'TÉRREO', 0.88, 2, renderer), ...makeFloor('subsolo', 'SUBSOLO SS1', 0.95, 1, renderer));
      
      const carGroup = new THREEObj.Group(); 
      const routeGroup = new THREEObj.Group(); 
      const walker = personMarker(); walker.visible = false;
      scene.add(carGroup, routeGroup, walker);
      const walkRing = makeRing(0x00f0ff, 0.35, 0.55); walkRing.visible = false; scene.add(walkRing);

      const resize = () => {
        const w = Math.max(mount.clientWidth, 1), h = Math.max(mount.clientHeight, 1);
        camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
      };
      resize();
      const ro = new ResizeObserver(resize); ro.observe(mount);

      three.current = { scene, camera, controls, carGroup, routeGroup, walker, walkRing, HOME, k };

      const clock = new THREEObj.Clock();
      const p = new THREEObj.Vector3(), prev = new THREEObj.Vector3(), des = new THREEObj.Vector3(), d = new THREEObj.Vector3();
      let lastPct = -1, lastStep = -1, raf = 0;

      const loop = () => {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.elapsedTime;
        const s = sim.current;

        if (s.playing && s.curve) {
          s.progress += dt / s.duration;
          if (s.progress >= 1) { s.progress = 1; s.playing = false; setPlaying(false); }
        }
        if (s.curve) {
          s.curve.getPointAt(s.progress, p);
          walker.visible = walkRing.visible = true;
          walker.position.set(p.x, p.y, p.z - LIFT);
          walkRing.position.set(p.x, p.y, p.z - LIFT + 0.06);
          const pu = 1 + 0.2 * Math.sin(t * 5); walkRing.scale.set(pu, pu, 1);
        } else { walker.visible = walkRing.visible = false; }

        if (s.camGoal) {
          const e = 1 - Math.exp(-4 * dt);
          camera.position.lerp(s.camGoal.pos, e); controls.target.lerp(s.camGoal.target, e);
          if (camera.position.distanceTo(s.camGoal.pos) < 0.1) s.camGoal = null;
        } else if (s.curve && (s.playing || t < s.focusUntil)) {
          prev.copy(controls.target);
          des.set(p.x, p.y, p.z * 0.5);
          controls.target.lerp(des, 1 - Math.exp(-3 * dt));
          camera.position.add(d.copy(controls.target).sub(prev));
        }
        controls.update();
        if (camera.position.z < CAM_MIN_Z) camera.position.z = CAM_MIN_Z;

        const p100 = Math.round(s.progress * 100);
        if (p100 !== lastPct) { lastPct = p100; setPct(p100); }
        if (s.fracs.length) {
          let i = s.fracs.findIndex((b) => s.progress <= b + 1e-6); if (i < 0) i = s.fracs.length - 1;
          if (i !== lastStep) { lastStep = i; setStepIdx(i); }
        }
        renderer.render(scene, camera);
      };
      loop();

      return () => {
        cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
        disposeGroup(scene); renderer.dispose();
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
        three.current = null;
      };
    }, []);

    /* -------------------- Rota (CatmullRomCurve3) ---------------------- */
    useEffect(() => {
      const tc = three.current; if (!tc) return;
      const THREEObj = window.THREE;
      const s = sim.current, g = tc.routeGroup;
      while (g.children.length) { const c = g.children.pop(); disposeGroup(c); }
      s.playing = false; s.progress = 0; s.curve = null; s.fracs = []; s.camGoal = null; s.focusUntil = 0;
      setPlaying(false); setPct(0); setStepIdx(0);

      if (!plano) {
        s.camGoal = { pos: tc.HOME.pos.clone(), target: tc.HOME.target.clone() };
        return;
      }
      const pts = buildPoints(plano.nodes, CORNER_R, 2.2);
      const curve = new THREEObj.CatmullRomCurve3(pts, false, 'centripetal');
      s.curve = curve; s.duration = plano.duracao; s.fracs = plano.secs.map((x) => x.b);

      const core = new THREEObj.Mesh(new THREEObj.TubeGeometry(curve, 700, 0.09, 8, false), new THREEObj.MeshBasicMaterial({ color: 0x00f0ff, transparent: true }));
      g.add(core);

      const o = plano.nodes[0];
      const ring = makeRing(0x4ade80, 0.5, 0.8); ring.position.set(o.x, o.y, o.z - LIFT + 0.08);
      g.add(ring);

      const box = new THREEObj.Box3().setFromPoints(pts);
      const c = box.getCenter(new THREEObj.Vector3()), sz = box.getSize(new THREEObj.Vector3());
      const dist = Math.max(38, Math.hypot(sz.x, sz.y) * 1.25);
      const dir = new THREEObj.Vector3(0, -0.8, 0.65).normalize();
      s.camGoal = { pos: c.clone().add(dir.multiplyScalar(dist)), target: new THREEObj.Vector3(c.x, c.y, 0) };
    }, [plano]);

    const escolherOrigem = (id) => { setOrigemId(id); setPicker(false); setCardOpen(true); };
    const togglePlay = () => {
      const s = sim.current; if (!s.curve) return;
      if (s.progress >= 1) s.progress = 0;
      s.camGoal = null; s.playing = !s.playing; setPlaying(s.playing);
    };
    const irParaPasso = (i) => {
      const s = sim.current; if (!plano) return;
      s.progress = plano.secs[i].a; s.playing = false; setPlaying(false);
      s.camGoal = null; s.focusUntil = Infinity;
    };

    // Redirecionamento correto para a tela de monitoramento
    const voltar = () => { 
      window.location.href = BACK_URL; 
    };

    const vagaTxt = vaga && vaga.ok ? vaga.code + ' · ' + NIVEL_LABEL[vaga.nivel] : vaga ? vaga.code : '…';

    return (
      <div className="ec-stage">
        <style>{CSS}</style>
        <div ref={mountRef} className="ec-canvas" />
        {erro && <div className="ec-erro">{erro}</div>}

        <header className="ec-top">
          <button className="ec-btn" onClick={voltar}>← Voltar</button>
          {origem && !picker && (
            <button className="ec-btn" onClick={() => setPicker(true)}>Trocar ponto de partida</button>
          )}
        </header>

        {(picker || !origem) && (
          <section className="ec-sheet" aria-label="Encontre meu carro">
            <h1>Encontre meu carro</h1>
            <div className="ec-vaga">
              <span className="ec-vaga-k">Vaga do seu ticket </span>
              <strong>{vagaTxt}</strong>
            </div>
            <h2>Onde você está agora?</h2>
            <ul className="ec-list">
              {ORIGENS.map((o) => (
                <li key={o.id}>
                  <button className={'ec-opt' + (o.id === origemId ? ' on' : '')} onClick={() => escolherOrigem(o.id)}>
                    <strong>{o.label}</strong><span>{o.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {plano && !picker && (
          <section className={'ec-card' + (cardOpen ? '' : ' closed')}>
            <button className="ec-card-head" onClick={() => setCardOpen((v) => !v)}>
              <span>
                <strong>De {origem.label} até a vaga {vaga.code}</strong>
                <small>≈ {plano.metros} m · {plano.minutos} min a pé</small>
              </span>
              <span>{cardOpen ? '▾' : '▸'}</span>
            </button>
            {cardOpen && (
              <>
                <ol className="ec-steps">
                  {plano.secs.map((s, i) => (
                    <li key={i} className={i === stepIdx && (pct > 0 || playing) ? 'on' : i < stepIdx ? 'done' : ''}>
                      <button onClick={() => irParaPasso(i)}>
                        <span className="ec-num">{i + 1}</span>
                        <span className="ec-txt">
                          <strong>{s.titulo}</strong>
                          <em>{s.nivel}</em>
                          <span>{s.detalhe}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
                <div className="ec-bar"><div style={{ width: pct + '%' }} /></div>
                <div className="ec-actions">
                  <button className="ec-btn ec-go" onClick={togglePlay}>
                    {playing ? '⏸ Pausar' : pct >= 100 ? '↺ Ver de novo' : '▶ Acompanhar caminhada'}
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    );
  }

  const CSS = `
html,body{margin:0;height:100%;background:#0a1220}
.ec-stage{position:relative;width:100%;height:100vh;overflow:hidden;background:#0a1220;color:#e6f1ff;font-family:sans-serif}
.ec-canvas{position:absolute;inset:0}
.ec-top{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;padding:12px;z-index:10}
.ec-btn{background:rgba(10,18,32,.82);border:1px solid rgba(125,211,252,.35);color:#e6f1ff;padding:10px 14px;border-radius:10px;cursor:pointer}
.ec-go{background:#00c8d8;color:#04202a;border-color:#00f0ff;font-weight:bold}
.ec-sheet,.ec-card{position:absolute;background:rgba(10,18,32,.88);border:1px solid rgba(125,211,252,.3);border-radius:14px;z-index:10}
.ec-sheet{top:60px;left:12px;width:min(380px,calc(100% - 24px));padding:16px}
.ec-vaga{padding:12px;border-radius:10px;background:rgba(250,204,21,.1);border:1px solid rgba(250,204,21,.5);margin-bottom:12px}
.ec-vaga strong{font-size:20px;color:#facc15}
.ec-list{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.ec-opt{width:100%;text-align:left;padding:10px;border-radius:10px;background:rgba(15,34,54,.7);border:1px solid rgba(125,211,252,.25);color:#fff;cursor:pointer}
.ec-opt.on{border-color:#00f0ff;background:rgba(0,240,255,.12)}
.ec-card{left:50%;bottom:12px;transform:translateX(-50%);width:min(560px,calc(100% - 24px));padding:12px}
.ec-card-head{display:flex;justify-content:space-between;width:100%;background:none;border:0;color:#fff;cursor:pointer}
.ec-steps{list-style:none;margin:10px 0;padding:0;max-height:180px;overflow:auto}
.ec-steps button{display:flex;gap:10px;width:100%;background:none;border:0;color:#fff;text-align:left;padding:6px 0;cursor:pointer}
.ec-num{width:24px;height:24px;border-radius:50%;background:#0f2236;border:1px solid #38bdf8;display:grid;place-items:center;font-size:12px}
.ec-bar{height:5px;background:rgba(125,211,252,.2);border-radius:3px;margin:8px 0}
.ec-bar div{height:100%;background:#00f0ff}
.ec-actions{display:flex;gap:12px;margin-top:8px}
.ec-erro{position:absolute;left:12px;right:12px;bottom:90px;padding:12px;background:#3b0d12;border:1px solid #f87171;color:#fecaca;border-radius:10px;z-index:20}
`;

  /* Renderização compatível com React 17 e 18 UMD */
  const rootEl = document.getElementById('root');
  if (rootEl) {
    if (ReactDOM.createRoot) {
      ReactDOM.createRoot(rootEl).render(<EncontreMeuCarro />);
    } else if (ReactDOM.render) {
      ReactDOM.render(<EncontreMeuCarro />, rootEl);
    }
  }
})();