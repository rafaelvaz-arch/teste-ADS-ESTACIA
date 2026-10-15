const { useState, useEffect, useRef } = React;

// -----------------------------------------------------------------------------
// 1. COORDENADAS DOS NÓS BASEADAS NA PLANTA
// -----------------------------------------------------------------------------
const graphNodes = {
  // === PAVIMENTO TÉRREO (Z = 0) ===
  TJ_ENTRADA_SUL: { name: "Entrada Sul (Térreo)", x: 0, y: -18, z: 0 },
  TJ_ENTRADA_LESTE: { name: "Entrada Leste (Térreo)", x: 22, y: 0, z: 0 },
  TJ_ENTRADA_OESTE: { name: "Entrada Oeste (Térreo)", x: -22, y: 0, z: 0 },

  // Transições / Rampas no Térreo
  TJ_RAMPA_2_SUL: { name: "Rampa Sul (Valet Z=0)", x: -6, y: -18, z: 0 },
  TJ_RAMPA_1_NOROESTE: { name: "Rampa Noroeste (Z=0)", x: -12, y: 18, z: 0 },

  // Núcleos Pedestres Térreo
  TJ_ELEVADOR_CENTRAL: { name: "Praça Central (Z=0)", x: 0, y: 0, z: 0 },
  TJ_ELEVADOR_OESTE: { name: "Torre Oeste (Z=0)", x: -12, y: 0, z: 0 },
  TJ_ELEVADOR_LESTE: { name: "Torre Leste (Z=0)", x: 12, y: 0, z: 0 },

  // === PAVIMENTO SUBSOLO SS1 (Z = -1) ===
  // Chegadas das Rampas no Subsolo
  SS1_RAMPA_SUL_CHEGADA: { name: "Chegada Rampa Sul (SS1)", x: -6, y: -18, z: -1 },
  SS1_RAMPA_NOROESTE_CHEGADA: { name: "Chegada Rampa Noroeste (SS1)", x: -12, y: 18, z: -1 },

  // Núcleos Pedestres Subsolo
  SS1_FOYER_CENTRAL: { name: "Foyer Central (SS1)", x: 0, y: 0, z: -1 },
  SS1_NUCLEO_OESTE: { name: "Núcleo Oeste (SS1)", x: -12, y: 0, z: -1 },
  SS1_NUCLEO_LESTE: { name: "Núcleo Leste (SS1)", x: 12, y: 0, z: -1 },

  // Corredores/Alamedas Principais do Subsolo
  SS1_CORREDOR_SUL: { name: "Alameda Sul (SS1)", x: -6, y: -10, z: -1 },
  SS1_CORREDOR_NORTE: { name: "Alameda Norte (SS1)", x: -12, y: 10, z: -1 },
  SS1_CORREDOR_OESTE: { name: "Alameda Setor A (SS1)", x: -18, y: -10, z: -1 },
  SS1_CORREDOR_LESTE: { name: "Alameda Setor B (SS1)", x: 18, y: 10, z: -1 },

  // Vagas Destino (Subsolo SS1)
  SS1_SETOR_A_VAGA_145: { name: "Setor A — Vaga 145", x: -22, y: -10, z: -1 },
  SS1_SETOR_B_VAGA_089: { name: "Setor B — Vaga 089", x: 22, y: 10, z: -1 },
  SS1_SETOR_EV_VAGA_01: { name: "Vagas Elétricas EV-01", x: 4, y: 4, z: -1 }
};

// -----------------------------------------------------------------------------
// 2. CONEXÕES COMPLETAS E CONECTADAS DO GRAFO
// -----------------------------------------------------------------------------
const graphEdges = [
  // --- Transições Verticais (Térreo <-> Subsolo) ---
  { from: "TJ_RAMPA_2_SUL", to: "SS1_RAMPA_SUL_CHEGADA", weight: 20 },
  { from: "TJ_RAMPA_1_NOROESTE", to: "SS1_RAMPA_NOROESTE_CHEGADA", weight: 20 },
  { from: "TJ_ELEVADOR_CENTRAL", to: "SS1_FOYER_CENTRAL", weight: 10 },
  { from: "TJ_ELEVADOR_OESTE", to: "SS1_NUCLEO_OESTE", weight: 12 },
  { from: "TJ_ELEVADOR_LESTE", to: "SS1_NUCLEO_LESTE", weight: 12 },

  // --- Conexões Conectadas no Térreo (Z=0) ---
  { from: "TJ_ENTRADA_SUL", to: "TJ_RAMPA_2_SUL", weight: 10 },
  { from: "TJ_ENTRADA_SUL", to: "TJ_ELEVADOR_CENTRAL", weight: 25 },
  { from: "TJ_ENTRADA_OESTE", to: "TJ_ELEVADOR_OESTE", weight: 15 },
  { from: "TJ_ENTRADA_LESTE", to: "TJ_ELEVADOR_LESTE", weight: 15 },
  { from: "TJ_ELEVADOR_LESTE", to: "TJ_ELEVADOR_CENTRAL", weight: 18 },
  { from: "TJ_ELEVADOR_OESTE", to: "TJ_ELEVADOR_CENTRAL", weight: 18 },
  { from: "TJ_ELEVADOR_OESTE", to: "TJ_RAMPA_1_NOROESTE", weight: 25 },

  // --- Conexões no Subsolo SS1 (Z=-1) ---
  { from: "SS1_RAMPA_SUL_CHEGADA", to: "SS1_CORREDOR_SUL", weight: 12 },
  { from: "SS1_CORREDOR_SUL", to: "SS1_CORREDOR_OESTE", weight: 15 },
  { from: "SS1_CORREDOR_OESTE", to: "SS1_SETOR_A_VAGA_145", weight: 8 },
  { from: "SS1_RAMPA_NOROESTE_CHEGADA", to: "SS1_CORREDOR_NORTE", weight: 12 },
  { from: "SS1_CORREDOR_NORTE", to: "SS1_CORREDOR_LESTE", weight: 18 },
  { from: "SS1_CORREDOR_LESTE", to: "SS1_SETOR_B_VAGA_089", weight: 8 },
  { from: "SS1_CORREDOR_SUL", to: "SS1_FOYER_CENTRAL", weight: 15 },
  { from: "SS1_FOYER_CENTRAL", to: "SS1_SETOR_EV_VAGA_01", weight: 10 },
  { from: "SS1_FOYER_CENTRAL", to: "SS1_NUCLEO_LESTE", weight: 15 },
  { from: "SS1_NUCLEO_LESTE", to: "SS1_CORREDOR_LESTE", weight: 12 },
  { from: "SS1_FOYER_CENTRAL", to: "SS1_NUCLEO_OESTE", weight: 15 },
  { from: "SS1_NUCLEO_OESTE", to: "SS1_CORREDOR_OESTE", weight: 12 }
];

// -----------------------------------------------------------------------------
// 3. ALGORITMO A*
// -----------------------------------------------------------------------------
function calculateHeuristic(nodeAKey, nodeBKey) {
  const nodeA = graphNodes[nodeAKey];
  const nodeB = graphNodes[nodeBKey];
  const dx = nodeA.x - nodeB.x;
  const dy = nodeA.y - nodeB.y;
  const dz = (nodeA.z - nodeB.z) * 15;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function findShortestPathAStar(startKey, targetKey) {
  if (!graphNodes[startKey] || !graphNodes[targetKey]) return null;

  const openSet = new Set([startKey]);
  const cameFrom = {};
  const gScore = {};
  const fScore = {};

  Object.keys(graphNodes).forEach((node) => {
    gScore[node] = Infinity;
    fScore[node] = Infinity;
  });

  gScore[startKey] = 0;
  fScore[startKey] = calculateHeuristic(startKey, targetKey);

  while (openSet.size > 0) {
    let current = null;
    let lowestF = Infinity;
    openSet.forEach((node) => {
      if (fScore[node] < lowestF) {
        lowestF = fScore[node];
        current = node;
      }
    });

    if (current === targetKey) {
      const path = [current];
      while (cameFrom[current]) {
        current = cameFrom[current];
        path.unshift(current);
      }
      return { path, totalDistance: gScore[targetKey] };
    }

    openSet.delete(current);
    const neighbors = graphEdges.filter((e) => e.from === current || e.to === current);

    neighbors.forEach((edge) => {
      const neighbor = edge.from === current ? edge.to : edge.from;
      const tentativeGScore = gScore[current] + edge.weight;

      if (tentativeGScore < gScore[neighbor]) {
        cameFrom[neighbor] = current;
        gScore[neighbor] = tentativeGScore;
        fScore[neighbor] = gScore[neighbor] + calculateHeuristic(neighbor, targetKey);
        openSet.add(neighbor);
      }
    });
  }

  return null;
}

// -----------------------------------------------------------------------------
// 4. COMPONENTE PRINCIPAL COM MAPA 3D E VIAS
// -----------------------------------------------------------------------------
function NavegacaoApp() {
  const [shopping, setShopping] = useState('cidade_jardim');
  const [origem, setOrigem] = useState('TJ_ENTRADA_LESTE');
  const [destino, setDestino] = useState('SS1_SETOR_A_VAGA_145');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const routeGroupRef = useRef(null);

  useEffect(() => {
    if (typeof THREE === "undefined") return;

    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080e1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, -55, 38);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Iluminação
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0x00d2ff, 0.6);
    dirLight.position.set(10, -20, 40);
    scene.add(dirLight);

    // --- PAVIMENTOS 3D ---
    // Térreo (Z = 0)
    const terreoGeo = new THREE.PlaneGeometry(56, 42);
    const terreoMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      transparent: true,
      opacity: 0.6
    });
    const terreoMesh = new THREE.Mesh(terreoGeo, terreoMat);
    terreoMesh.position.set(0, 0, 5);
    scene.add(terreoMesh);

    const terreoEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(terreoGeo),
      new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 })
    );
    terreoEdges.position.set(0, 0, 5);
    scene.add(terreoEdges);

    // Subsolo SS1 (Z = -1)
    const subsoloGeo = new THREE.PlaneGeometry(56, 42);
    const subsoloMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.9,
      transparent: true,
      opacity: 0.85
    });
    const subsoloMesh = new THREE.Mesh(subsoloGeo, subsoloMat);
    subsoloMesh.position.set(0, 0, -5);
    scene.add(subsoloMesh);

    const subsoloEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(subsoloGeo),
      new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 2 })
    );
    subsoloEdges.position.set(0, 0, -5);
    scene.add(subsoloEdges);

    // --- DESENHA TODAS AS VIAS DE CIRCULAÇÃO EM LINHAS FINAS ---
    graphEdges.forEach((edge) => {
      const nodeA = graphNodes[edge.from];
      const nodeB = graphNodes[edge.to];

      const zA = nodeA.z === 0 ? 5.1 : -4.9;
      const zB = nodeB.z === 0 ? 5.1 : -4.9;

      const points = [
        new THREE.Vector3(nodeA.x, nodeA.y, zA),
        new THREE.Vector3(nodeB.x, nodeB.y, zB)
      ];

      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineDashedMaterial({
        color: nodeA.z !== nodeB.z ? 0xf59e0b : 0x334155,
        dashSize: nodeA.z !== nodeB.z ? 0.8 : 100,
        gapSize: nodeA.z !== nodeB.z ? 0.8 : 0
      });

      const line = new THREE.Line(lineGeo, lineMat);
      line.computeLineDistances();
      scene.add(line);
    });

    // Grupo para Rota
    const routeGroup = new THREE.Group();
    scene.add(routeGroup);
    routeGroupRef.current = routeGroup;

    // --- DESENHA OS NÓS / WAYPOINTS ---
    Object.keys(graphNodes).forEach((key) => {
      const node = graphNodes[key];
      const z3D = node.z === 0 ? 5.2 : -4.8;

      const isVaga = key.includes("VAGA");
      const geo = new THREE.SphereGeometry(isVaga ? 0.8 : 0.45, 16, 16);
      const mat = new THREE.MeshStandardMaterial({
        color: isVaga ? 0x10b981 : node.z === 0 ? 0x38bdf8 : 0x0284c7,
        emissive: isVaga ? 0x059669 : 0x000000
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(node.x, node.y, z3D);
      scene.add(mesh);
    });

    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (container && renderer.domElement) {
        container.innerHTML = "";
      }
    };
  }, []);

  // Desenha a Rota GPS 3D Em Destaque
  const drawRoute3D = (pathKeys) => {
    const routeGroup = routeGroupRef.current;
    if (!routeGroup) return;

    while (routeGroup.children.length > 0) {
      routeGroup.remove(routeGroup.children[0]);
    }

    if (!pathKeys || pathKeys.length < 2) return;

    for (let i = 0; i < pathKeys.length - 1; i++) {
      const nodeA = graphNodes[pathKeys[i]];
      const nodeB = graphNodes[pathKeys[i + 1]];

      const zA = nodeA.z === 0 ? 5.3 : -4.7;
      const zB = nodeB.z === 0 ? 5.3 : -4.7;

      const pA = new THREE.Vector3(nodeA.x, nodeA.y, zA);
      const pB = new THREE.Vector3(nodeB.x, nodeB.y, zB);

      const distance = pA.distanceTo(pB);
      const cylGeo = new THREE.CylinderGeometry(0.35, 0.35, distance, 12);
      const cylMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00a8ff,
        emissiveIntensity: 0.9,
        roughness: 0.1
      });

      const cylinder = new THREE.Mesh(cylGeo, cylMat);
      cylinder.position.copy(pA).add(pB).multiplyScalar(0.5);
      cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pB.clone().sub(pA).normalize());

      routeGroup.add(cylinder);
    }
  };

  const buscarERenderizarRota = () => {
    setLoading(true);
    setStatus({ tipo: "info", mensagem: "Calculando trajeto A*..." });

    setTimeout(() => {
      const result = findShortestPathAStar(origem, destino);
      if (result) {
        setStatus({
          tipo: "success",
          mensagem: `Rota GPS 3D Gerada! Distância: ${result.totalDistance}m | Waypoints: ${result.path.length}`
        });
        drawRoute3D(result.path);
      } else {
        setStatus({ tipo: "error", mensagem: "Não foi possível calcular a rota 3D entre estes dois pontos." });
        drawRoute3D([]);
      }
      setLoading(false);
    }, 150);
  };

  return (
    <div className="p-4 bg-slate-900 text-white rounded-xl shadow-2xl w-full border border-slate-800">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-cyan-400">ESTACIA — Navegação GPS 3D</h2>
          <p className="text-xs text-slate-400">Visão em Camadas: Térreo (Z=0) e Estacionamento Subsolo (Z=-1)</p>
        </div>
        <div>
          <select 
            value={shopping} 
            onChange={(e) => setShopping(e.target.value)}
            className="bg-slate-800 text-xs p-2 rounded border border-slate-700 text-white"
          >
            <option value="cidade_jardim">Shopping Center Cidade Jardim</option>
          </select>
        </div>
      </div>

      <div className="mb-4 p-3 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-400">VAGAS DISPONÍVEIS:</span>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 bg-emerald-950 text-emerald-400 rounded border border-emerald-800">
            ● Setor A — Vaga 145
          </span>
          <span className="px-2 py-1 bg-emerald-950 text-emerald-400 rounded border border-emerald-800">
            ● Setor B — Vaga 089
          </span>
          <span className="px-2 py-1 bg-emerald-950 text-emerald-400 rounded border border-emerald-800">
            ● EV-01 (Elétricos)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-xs mb-1 text-slate-400">ORIGEM (TÉRREO)</label>
          <select
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
            className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="TJ_ENTRADA_SUL">Entrada Sul (Térreo Z=0)</option>
            <option value="TJ_ENTRADA_LESTE">Entrada Leste (Térreo Z=0)</option>
            <option value="TJ_ENTRADA_OESTE">Entrada Oeste (Térreo Z=0)</option>
            <option value="TJ_ELEVADOR_CENTRAL">Praça Central (Térreo Z=0)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs mb-1 text-slate-400">DESTINO (SUBSOLO SS1)</label>
          <select
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="SS1_SETOR_A_VAGA_145">Setor A — Vaga 145 (Subsolo SS1 Z=-1)</option>
            <option value="SS1_SETOR_B_VAGA_089">Setor B — Vaga 089 (Subsolo SS1 Z=-1)</option>
            <option value="SS1_SETOR_EV_VAGA_01">Elétricos — Vaga EV-01 (Subsolo SS1 Z=-1)</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={buscarERenderizarRota}
            disabled={loading}
            className="w-full p-2 bg-cyan-500 hover:bg-cyan-400 font-bold rounded transition text-sm text-slate-950 disabled:opacity-50"
          >
            {loading ? 'GERANDO...' : 'GERAR ROTA GPS 3D'}
          </button>
        </div>
      </div>

      {status && (
        <div className={`mb-4 p-3 rounded text-sm border ${
          status.tipo === 'success' ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300' :
          status.tipo === 'error' ? 'bg-rose-950/80 border-rose-800 text-rose-300' :
          'bg-cyan-950/80 border-cyan-800 text-cyan-300'
        }`}>
          {status.mensagem}
        </div>
      )}

      <div 
        ref={mountRef} 
        className="w-full h-[480px] bg-slate-950 border border-slate-800 rounded-lg overflow-hidden relative cursor-grab active:cursor-grabbing"
      >
        <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded border border-slate-800 text-[11px] text-slate-300 pointer-events-none z-10">
          🖱️ Clique e arraste para rodar a câmara | Scroll para dar Zoom
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 5. INICIALIZAÇÃO REACT 18
// -----------------------------------------------------------------------------
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<NavegacaoApp />);
}