/* =============================================================================
 * js/navegacao.jsx
 * Navegação indoor 3D — Shopping Cidade Jardim / Parque das Palmeiras
 * Pavimentos: Térreo (Z = +12) e Subsolo SS1 (Z = -12)  |  Destino: Vaga A-145
 * ========================================================================== */

const { useState, useEffect, useRef, useCallback } = React;

/* -------------------------------------------------------------------------- */
/* Constantes de cena                                                         */
/* -------------------------------------------------------------------------- */
const PLANE_W = 56;
const PLANE_H = 38;
const Z_TERREO = 12.0;
const Z_SUBSOLO = -12.0;
const LIFT = 0.35; // Altura da rota acima do piso (evita z-fighting)
const ROUTE_RADIUS = 0.1;
const CORNER_RADIUS = 1.3; // Raio das curvas de 90°
const GPS_DURATION = 32; // Duração da simulação em segundos
const PITCH_SOFTEN = 0.5; // Inclinação suave do veículo na rampa
const CAM_MIN_Z = 14; // Câmera nunca desce abaixo do plano do Térreo
const TEXTURES = {
  terreo: 'assets/planta_terreo.png',
  subsolo: 'assets/planta_subsolo.png',
};

/* Conversão de pixels das plantas 1280x720 -> Coordenadas do mundo Three.js */
const IMG_W = 1280;
const IMG_H = 720;
const px = (x, y, z) => ({
  x: (x / IMG_W - 0.5) * PLANE_W,
  y: (0.5 - y / IMG_H) * PLANE_H,
  z: z + LIFT,
});

/* -------------------------------------------------------------------------- */
/* Grafo da Rota (Calibração Exata da Rampa e Pistas)                          */
/* -------------------------------------------------------------------------- */
const ROUTE_NODES = [
  // ---- TÉRREO -------------------------------------------------------------
  px(1095, 598, Z_TERREO), // 0 Origem: Pista inferior direita
  px(480,  598, Z_TERREO), // 1 Segue reto até alinhar com a Rampa 2
  px(480,  580, Z_TERREO), // 2 Entra no topo da Rampa 2 (Início da descida)

  // ---- TRANSIÇÃO PELA RAMPA 2 (Inclinação suave em diagonal) --------------
  px(480,  610, (Z_TERREO + Z_SUBSOLO) / 2), // 3 Meio da rampa (Z = 0)
  px(480,  640, Z_SUBSOLO),                  // 4 Base da rampa no Subsolo

  // ---- SUBSOLO SS1 ----------------------------------------------------------
  px(480,  652, Z_SUBSOLO), // 5 Saída da rampa na pista do Subsolo
  px(625,  652, Z_SUBSOLO), // 6 Vira à direita e entra no Corredor Central
  px(625,  168, Z_SUBSOLO), // 7 Sobe o Corredor Central até à Alameda Norte
  px(440,  168, Z_SUBSOLO), // 8 Vira à esquerda na Alameda Norte
  px(440,  214, Z_SUBSOLO), // 9 Entra na vaga A-145 (Chegada)
];

const SPOT = ROUTE_NODES[ROUTE_NODES.length - 1];
const START = ROUTE_NODES[0];

/* Constrói pontos com curvas arredondadas para não estufar nos cantos */
function buildRoutePoints(nodes, radius, step) {
  const V = (n) => new THREE.Vector3(n.x, n.y, n.z);
  const out = [];
  const push = (v) => {
    if (!out.length || out[out.length - 1].distanceTo(v) > 1e-4) out.push(v);
  };

  push(V(nodes[0]));
  for (let i = 1; i < nodes.length - 1; i++) {
    const prev = V(nodes[i - 1]);
    const cur = V(nodes[i]);
    const next = V(nodes[i + 1]);
    const d1 = new THREE.Vector2(cur.x - prev.x, cur.y - prev.y);
    const d2 = new THREE.Vector2(next.x - cur.x, next.y - cur.y);
    const len1 = d1.length();
    const len2 = d2.length();
    d1.normalize();
    d2.normalize();

    if (d1.dot(d2) > 0.999) {
      push(cur);
      continue;
    }
    const r = Math.min(radius, len1 * 0.5, len2 * 0.5);
    const a = cur.clone().lerp(prev, r / cur.distanceTo(prev));
    const b = cur.clone().lerp(next, r / cur.distanceTo(next));
    push(a);
    for (let k = 1; k < 8; k++) {
      const t = k / 8;
      const p = new THREE.Vector3()
        .addScaledVector(a, (1 - t) * (1 - t))
        .addScaledVector(cur, 2 * (1 - t) * t)
        .addScaledVector(b, t * t);
      push(p);
    }
    push(b);
  }
  push(V(nodes[nodes.length - 1]));

  const dense = [out[0]];
  for (let i = 1; i < out.length; i++) {
    const a = out[i - 1];
    const b = out[i];
    const n = Math.floor(a.distanceTo(b) / step);
    for (let j = 1; j <= n; j++) {
      const p = a.clone().lerp(b, j / (n + 1));
      if (p.distanceTo(b) > 1e-3) dense.push(p);
    }
    dense.push(b);
  }
  return dense;
}

/* -------------------------------------------------------------------------- */
/* Helpers de Three.js                                                        */
/* -------------------------------------------------------------------------- */
function setSRGB(renderer, THREE_) {
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE_.SRGBColorSpace;
  else renderer.outputEncoding = THREE_.sRGBEncoding;
}
function setTexSRGB(tex) {
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
  else tex.encoding = THREE.sRGBEncoding;
}

function placeholderTexture(label) {
  const c = document.createElement('canvas');
  c.width = IMG_W;
  c.height = IMG_H;
  const g = c.getContext('2d');
  g.fillStyle = '#1b2430';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(120,160,200,.18)';
  g.lineWidth = 1;
  for (let x = 0; x <= c.width; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); }
  for (let y = 0; y <= c.height; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
  g.fillStyle = 'rgba(200,225,255,.5)';
  g.font = 'bold 46px sans-serif';
  g.textAlign = 'center';
  g.fillText(label, c.width / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c);
  setTexSRGB(t);
  return t;
}

function makeFloor(url, label, z, opacity, renderOrder, renderer) {
  const mat = new THREE.MeshBasicMaterial({
    map: placeholderTexture(label + ' (carregando…)'),
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PLANE_W, PLANE_H), mat);
  mesh.position.set(0, 0, z);
  mesh.renderOrder = renderOrder;

  new THREE.TextureLoader().load(
    url,
    (tex) => {
      setTexSRGB(tex);
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      mat.map = tex;
      mat.needsUpdate = true;
    },
    undefined,
    () => console.warn('[navegacao] Erro ao carregar a textura:', url)
  );

  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 })
  );
  frame.position.copy(mesh.position);
  frame.renderOrder = renderOrder + 0.5;
  return { mesh, frame };
}

function makeLabel(text, color) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(8,16,28,.82)';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.strokeRect(3, 3, c.width - 6, c.height - 6);
  g.fillStyle = color;
  g.font = 'bold 54px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2 + 3);
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })
  );
  sp.scale.set(7, 1.75, 1);
  sp.renderOrder = 20;
  return sp;
}

function makeRing(color, inner, outer) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false })
  );
  m.renderOrder = 8;
  return m;
}

function buildCar(lightK) {
  const car = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1f6bff, metalness: 0.75, roughness: 0.28 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0a1020, metalness: 0.3, roughness: 0.15 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0d0f14, roughness: 0.9 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0x66f7ff, emissive: 0x00e5ff, emissiveIntensity: 2.2,
  });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.6, 0.22), bodyMat);
  chassis.position.set(0, 0, 0.24);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.56, 0.12), bodyMat);
  hood.position.set(0.45, 0, 0.4);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.22), glassMat);
  cabin.position.set(-0.12, 0, 0.46);
  car.add(chassis, hood, cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.12, 14);
  [[0.42, 0.31], [0.42, -0.31], [-0.42, 0.31], [-0.42, -0.31]].forEach(([x, y]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, y, 0.13);
    car.add(w);
  });

  const lampGeo = new THREE.BoxGeometry(0.06, 0.14, 0.07);
  [0.2, -0.2].forEach((y) => {
    const l = new THREE.Mesh(lampGeo, lampMat);
    l.position.set(0.66, y, 0.3);
    car.add(l);
  });

  const spot = new THREE.SpotLight(0x66f7ff, 3 * lightK, 9, Math.PI / 5, 0.6, 1);
  spot.position.set(0.7, 0, 0.32);
  spot.target.position.set(4, 0, 0.1);
  const glow = new THREE.PointLight(0x00e5ff, 1.2 * lightK, 4, 2);
  glow.position.set(0.8, 0, 0.35);
  car.add(spot, spot.target, glow);

  car.traverse((o) => {
    if (o.isMesh) {
      o.renderOrder = 10;
      o.material.transparent = true;
    }
  });
  return car;
}

const hasFullscreenApi = () =>
  !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);

/* -------------------------------------------------------------------------- */
/* Passos instrucionais                                                       */
/* -------------------------------------------------------------------------- */
const STEPS = [
  { t: 'Siga pela via inferior do Térreo', d: 'Acompanhe a rota ciano pela pista inferior e acesse o topo da Rampa 2.' },
  { t: 'Desça a rampa para o Subsolo SS1', d: 'Entre na Rampa 2 e desça com atenção até ao SS1 com os faróis acesos.' },
  { t: 'Suba o corredor central', d: 'Na base da rampa, vire à direita e siga em frente por todo o corredor central.' },
  { t: 'Vire à esquerda e estacione na vaga A-145', d: 'Na Alameda Norte, vire à esquerda e entre na vaga A-145.' },
];

/* -------------------------------------------------------------------------- */
/* Componente Principal                                                       */
/* -------------------------------------------------------------------------- */
function Navegacao() {
  const stageRef = useRef(null);
  const mountRef = useRef(null);
  const sim = useRef({ playing: false, progress: 0, follow: true, resetCamera: null });

  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [pct, setPct] = useState(0);
  const [level, setLevel] = useState('Térreo');
  const [step, setStep] = useState(0);
  const [follow, setFollow] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    const OrbitControls = THREE.OrbitControls || window.OrbitControls;
    if (!OrbitControls) {
      setError('OrbitControls não encontrado. Inclua examples/js/controls/OrbitControls.js.');
      return undefined;
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    setSRGB(renderer, THREE);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    const legacyLights = !('outputColorSpace' in renderer);
    const lightK = legacyLights ? 1 : 4;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1220);
    scene.fog = new THREE.Fog(0x0a1220, 120, 260);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
    camera.up.set(0, 0, 1);
    const HOME_POS = new THREE.Vector3(0, -72, 52);
    const HOME_TARGET = new THREE.Vector3(0, 0, 0);
    camera.position.copy(HOME_POS);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(HOME_TARGET);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.minDistance = 16;
    controls.maxDistance = 150;
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 0.9 * (legacyLights ? 1 : 2)));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8 * (legacyLights ? 1 : 2));
    sun.position.set(20, -30, 60);
    scene.add(sun);

    const terreo = makeFloor(TEXTURES.terreo, 'TÉRREO', Z_TERREO, 0.88, 2, renderer);
    const subsolo = makeFloor(TEXTURES.subsolo, 'SUBSOLO SS1', Z_SUBSOLO, 0.95, 1, renderer);
    scene.add(terreo.mesh, terreo.frame, subsolo.mesh, subsolo.frame);

    const pillars = [];
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
      pillars.push(sx * PLANE_W / 2, sy * PLANE_H / 2, Z_SUBSOLO, sx * PLANE_W / 2, sy * PLANE_H / 2, Z_TERREO);
    });
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pillars, 3));
    scene.add(new THREE.LineSegments(pg, new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.25 })));

    const lblT = makeLabel('TÉRREO', '#7dd3fc');
    lblT.position.set(-22, -PLANE_H / 2 - 1.8, Z_TERREO + 0.5);
    const lblS = makeLabel('SUBSOLO SS1', '#7dd3fc');
    lblS.position.set(-22, -PLANE_H / 2 - 1.8, Z_SUBSOLO + 0.5);
    scene.add(lblT, lblS);

    const points = buildRoutePoints(ROUTE_NODES, CORNER_RADIUS, 2.5);
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const tubeCore = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 900, ROUTE_RADIUS, 8, false),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true })
    );
    tubeCore.renderOrder = 6;
    const tubeGlow = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 900, ROUTE_RADIUS * 3, 8, false),
      new THREE.MeshBasicMaterial({
        color: 0x00e5ff, transparent: true, opacity: 0.2,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    tubeGlow.renderOrder = 7;
    scene.add(tubeCore, tubeGlow);

    const startRing = makeRing(0x4ade80, 0.5, 0.75);
    startRing.position.set(START.x, START.y, Z_TERREO + 0.08);
    const spotRing = makeRing(0xfacc15, 0.45, 0.7);
    spotRing.position.set(SPOT.x, SPOT.y, Z_SUBSOLO + 0.08);
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 6, 8),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.55 })
    );
    beacon.rotation.x = Math.PI / 2;
    beacon.position.set(SPOT.x, SPOT.y, Z_SUBSOLO + 3);
    beacon.renderOrder = 8;
    const lblSpot = makeLabel('A-145', '#facc15');
    lblSpot.scale.set(3.6, 0.9, 1);
    lblSpot.position.set(SPOT.x, SPOT.y, Z_SUBSOLO + 6.6);
    scene.add(startRing, spotRing, beacon, lblSpot);

    const car = buildCar(lightK);
    scene.add(car);

    const resize = () => {
      const w = Math.max(mount.clientWidth, 1);
      const h = Math.max(mount.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    window.addEventListener('resize', resize);

    sim.current.resetCamera = () => {
      camera.position.copy(HOME_POS);
      controls.target.copy(HOME_TARGET);
      controls.update();
    };

    const clock = new THREE.Clock();
    const tmpP = new THREE.Vector3();
    const tmpT = new THREE.Vector3();
    const tmpL = new THREE.Vector3();
    const tmpU = new THREE.Vector3();
    const basis = new THREE.Matrix4();
    const targetQ = new THREE.Quaternion();
    const UP = new THREE.Vector3(0, 0, 1);
    const prevTarget = new THREE.Vector3();
    const desired = new THREE.Vector3();
    let lastPct = -1;
    let lastLevel = '';
    let lastStep = -1;
    let first = true;
    let raf = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      const s = sim.current;
      const time = clock.elapsedTime;

      if (s.playing) {
        s.progress += dt / GPS_DURATION;
        if (s.progress >= 1) {
          s.progress = 1;
          s.playing = false;
          setPlaying(false);
        }
      }

      curve.getPointAt(s.progress, tmpP);
      curve.getTangentAt(s.progress, tmpT);
      tmpT.z *= PITCH_SOFTEN;
      tmpT.normalize();
      tmpL.crossVectors(UP, tmpT).normalize();
      tmpU.crossVectors(tmpT, tmpL).normalize();
      basis.makeBasis(tmpT, tmpL, tmpU);
      targetQ.setFromRotationMatrix(basis);
      if (first) { car.quaternion.copy(targetQ); first = false; }
      else car.quaternion.slerp(targetQ, 1 - Math.exp(-12 * dt));
      car.position.set(tmpP.x, tmpP.y, tmpP.z - LIFT + 0.02);

      prevTarget.copy(controls.target);
      if (s.playing && s.follow) {
        desired.set(tmpP.x, tmpP.y, tmpP.z * 0.5);
        controls.target.lerp(desired, 1 - Math.exp(-3 * dt));
        camera.position.add(tmpL.copy(controls.target).sub(prevTarget));
      }
      controls.update();
      if (camera.position.z < CAM_MIN_Z) camera.position.z = CAM_MIN_Z;

      const pulse = 1 + 0.18 * Math.sin(time * 4);
      spotRing.scale.set(pulse, pulse, 1);
      startRing.scale.set(pulse, pulse, 1);

      const p100 = Math.round(s.progress * 100);
      if (p100 !== lastPct) { lastPct = p100; setPct(p100); }
      const lv = tmpP.z > Z_TERREO - 4 ? 'Térreo' : tmpP.z < Z_SUBSOLO + 4 ? 'Subsolo SS1' : 'Rampa';
      if (lv !== lastLevel) { lastLevel = lv; setLevel(lv); }
      const st = lv === 'Térreo' ? 0 : lv === 'Rampa' ? 1 : tmpP.y > px(0, 200, 0).y ? 3 : 2;
      if (st !== lastStep) { lastStep = st; setStep(st); }

      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', resize);
      controls.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setIsFs(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = stageRef.current;
    if (!hasFullscreenApi()) { setIsFs((v) => !v); return; }
    const active = document.fullscreenElement || document.webkitFullscreenElement;
    if (!active) (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    else (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  }, []);

  const toggleGPS = () => {
    const s = sim.current;
    if (s.progress >= 1) s.progress = 0;
    s.playing = !s.playing;
    setPlaying(s.playing);
  };
  const resetGPS = () => {
    sim.current.progress = 0;
    sim.current.playing = false;
    setPlaying(false);
  };
  const toggleFollow = () => {
    sim.current.follow = !sim.current.follow;
    setFollow(sim.current.follow);
  };

  const gpsLabel = playing ? '⏸ Pausar' : pct >= 100 ? '↺ Simular novamente' : pct > 0 ? '▶ Continuar' : '▶ Simular GPS';
  const pseudoFs = isFs && !hasFullscreenApi();

  return (
    <div
      ref={stageRef}
      className="nv-stage"
      style={pseudoFs ? { position: 'fixed', inset: 0, zIndex: 9999 } : undefined}
    >
      <style>{CSS}</style>
      <div ref={mountRef} className="nv-canvas" />

      {error && <div className="nv-error">{error}</div>}

      <header className="nv-top">
        <button className="nv-btn" onClick={() => { window.location.href = 'setores.html'; }}>
          ← Voltar para Setores
        </button>
        <button className="nv-btn nv-btn-ok" onClick={() => { window.location.href = 'monitoramento.html'; }}>
          ✓ Finalizar Rota
        </button>
      </header>

      <aside className={'nv-panel' + (panelOpen ? '' : ' nv-closed')}>
        <button className="nv-panel-head" onClick={() => setPanelOpen((v) => !v)} aria-expanded={panelOpen}>
          <span>Rota até a vaga A-145</span>
          <span className="nv-chev">{panelOpen ? '▾' : '▸'}</span>
        </button>
        {panelOpen && (
          <ol className="nv-steps">
            {STEPS.map((s, i) => (
              <li key={s.t} className={i === step ? 'on' : i < step ? 'done' : ''}>
                <span className="nv-num">{i + 1}</span>
                <div>
                  <strong>{s.t}</strong>
                  <p>{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </aside>

      <footer className="nv-dock">
        <div className="nv-progress" aria-label={'Progresso da rota: ' + pct + '%'}>
          <div className="nv-bar"><div style={{ width: pct + '%' }} /></div>
          <span>{level} · {pct}%</span>
        </div>
        <div className="nv-actions">
          <button className="nv-btn nv-btn-go" onClick={toggleGPS}>{gpsLabel}</button>
          <button className="nv-btn" onClick={resetGPS} disabled={pct === 0 && !playing}>Reiniciar</button>
          <button className={'nv-btn' + (follow ? ' nv-on' : '')} onClick={toggleFollow} aria-pressed={follow}>
            Seguir veículo
          </button>
          <button className="nv-btn" onClick={() => sim.current.resetCamera && sim.current.resetCamera()}>
            Recentralizar
          </button>
          <button className="nv-btn" onClick={toggleFullscreen}>{isFs ? '⤡ Sair da tela cheia' : '⛶ Tela cheia'}</button>
        </div>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Estilos CSS                                                                */
/* -------------------------------------------------------------------------- */
const CSS = `
html,body{margin:0;height:100%;background:#0a1220}
.nv-stage{position:relative;width:100%;height:100vh;height:100dvh;overflow:hidden;background:#0a1220;
  font-family:"Segoe UI",system-ui,-apple-system,Roboto,sans-serif;color:#e6f1ff}
.nv-canvas{position:absolute;inset:0}
.nv-top{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;gap:8px;
  padding:max(12px,env(safe-area-inset-top)) 12px 0;pointer-events:none}
.nv-top .nv-btn{pointer-events:auto}
.nv-btn{appearance:none;border:1px solid rgba(125,211,252,.35);background:rgba(10,18,32,.78);color:#e6f1ff;
  padding:10px 14px;border-radius:10px;font:600 14px/1 inherit;font-family:inherit;cursor:pointer;
  backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:background .15s,border-color .15s}
.nv-btn:hover:not(:disabled){background:rgba(24,44,72,.9);border-color:#7dd3fc}
.nv-btn:focus-visible,.nv-panel-head:focus-visible{outline:2px solid #00f0ff;outline-offset:2px}
.nv-btn:disabled{opacity:.45;cursor:default}
.nv-btn-ok{border-color:rgba(74,222,128,.6);color:#bbf7d0}
.nv-btn-go{background:#00c8d8;border-color:#00f0ff;color:#04202a}
.nv-btn-go:hover:not(:disabled){background:#00e5ff;border-color:#7df9ff}
.nv-on{border-color:#00f0ff;box-shadow:inset 0 0 0 1px #00f0ff}
.nv-panel{position:absolute;top:calc(max(12px,env(safe-area-inset-top)) + 52px);left:12px;width:min(340px,calc(100% - 24px));
  background:rgba(10,18,32,.82);border:1px solid rgba(125,211,252,.3);border-radius:12px;
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);overflow:hidden}
.nv-panel-head{width:100%;display:flex;justify-content:space-between;align-items:center;padding:12px 14px;
  background:none;border:0;color:#e6f1ff;font:700 15px/1.2 inherit;font-family:inherit;cursor:pointer;text-align:left}
.nv-steps{list-style:none;margin:0;padding:0 14px 12px;max-height:42vh;overflow:auto}
.nv-steps li{display:flex;gap:10px;padding:9px 8px;border-radius:8px;opacity:.6}
.nv-steps li.on{opacity:1;background:rgba(0,240,255,.1)}
.nv-steps li.done{opacity:.4}
.nv-steps strong{font-size:14px}
.nv-steps p{margin:3px 0 0;font-size:13px;line-height:1.4;color:#b6c9df}
.nv-num{flex:0 0 24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;
  background:#0f2236;border:1px solid #38bdf8}
.nv-steps li.on .nv-num{background:#00f0ff;color:#04202a;border-color:#00f0ff}
.nv-dock{position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;gap:10px;
  padding:0 12px max(14px,env(safe-area-inset-bottom));pointer-events:none}
.nv-dock>*{pointer-events:auto}
.nv-progress{display:flex;align-items:center;gap:10px;width:min(520px,100%);font-size:13px;color:#b6c9df}
.nv-bar{flex:1;height:6px;border-radius:3px;background:rgba(125,211,252,.2);overflow:hidden}
.nv-bar>div{height:100%;background:#00f0ff;box-shadow:0 0 10px #00f0ff}
.nv-progress span{min-width:104px;text-align:right}
.nv-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
.nv-error{position:absolute;inset:auto 12px 90px 12px;padding:12px 14px;border-radius:10px;background:#3b0d12;
  border:1px solid #f87171;color:#fecaca;font-size:14px}
@media (max-width:560px){.nv-btn{padding:9px 11px;font-size:13px}.nv-steps{max-height:30vh}}
@media (prefers-reduced-motion:reduce){.nv-btn{transition:none}}
`;

/* -------------------------------------------------------------------------- */
/* Montagem no DOM (React 18)                                                 */
/* -------------------------------------------------------------------------- */
const rootElement = document.getElementById('root');
if (rootElement && typeof ReactDOM !== 'undefined') {
  ReactDOM.createRoot(rootElement).render(<Navegacao />);
}