const { useState } = React;

// --- DADOS DO SETOR E ROTA FIEL À PLANTA BAIXA ---
const SECTOR = {
  id: "A",
  title: "Setor A - Norte",
  sub: "Próx. Lojas Americanas",
  spotNumber: "A-145",
  // Rota saindo da Entrada Sul, contornando a Lojas Americanas pela esquerda e parando no Setor Norte
  routePoints: [
    { x: 50, y: 92 }, // 0: Portaria / Entrada Sul
    { x: 28, y: 92 }, // 1: Rotatória Sul / Giro à esquerda
    { x: 10, y: 78 }, // 2: Entrada da Alameda Oeste (Mão única)
    { x: 10, y: 22 }, // 3: Passagem lateral Lojas Americanas
    { x: 28, y: 12 }, // 4: Entrada no Bolsão Norte
    { x: 38, y: 12 }  // 5: Estacionado na Vaga A-145
  ]
};

const NAVIGATION_STEPS = [
  {
    id: 1,
    dist: "Em 30m",
    text: "Ao passar pela Entrada Sul, dobre à esquerda na via externa",
    sub: "Acesso à Alameda Oeste",
  },
  {
    id: 2,
    dist: "Em 180m",
    text: "Siga direto contornando a fachada das Lojas Americanas",
    sub: "Mantenha a velocidade limite de 20 km/h",
  },
  {
    id: 3,
    dist: "Em 50m",
    text: "Vire à direita ao norte para acessar o Bolsão do Setor A",
    sub: "Corredor de vagas A-100 a A-200",
  },
  {
    id: 4,
    dist: "Chegada",
    text: "Sua vaga A-145 está localizada à sua direita",
    sub: "Escanear QR Code para registrar veículo",
    isGreen: true
  }
];

// --- COMPONENTE DO MAPA FIEL À PLANTA ARQUITETÔNICA ---
function FloorPlanMap({ progress, view }) {
  const pts = SECTOR.routePoints;
  const clampedIndex = Math.min(Math.max(0, progress), pts.length - 1);
  const currentPos = pts[clampedIndex];

  const fullPath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const donePath = pts
    .slice(0, clampedIndex + 1)
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-[#e3e8ec] shadow-inner">
      <div
        className={`h-full w-full transition-all duration-700 ease-out ${
          view === "3d"
            ? "scale-105 origin-bottom [transform:rotateX(30deg)_rotateZ(-2deg)]"
            : "scale-100 [transform:rotateX(0deg)]"
        }`}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full block">
          {/* Terreno do Entorno / Gramados */}
          <rect width="100" height="100" fill="#cbd5e1" />
          <path d="M 0,0 L 100,0 L 100,100 L 0,100 Z" fill="#94a3b8" opacity="0.3" />

          {/* Vias Asfaltadas Externa (Anel viário do Shopping) */}
          <rect x="4" y="4" width="92" height="92" rx="6" fill="#475569" />
          <rect x="14" y="18" width="72" height="64" rx="4" fill="#94a3b8" />

          {/* Área Marrom / Calçadas / Paisagismo da Planta */}
          <rect x="16" y="20" width="68" height="60" rx="3" fill="#e2e8f0" />

          {/* --- BLOCOS ARQUITETÔNICOS DAS LOJAS ÂNCORAS --- */}
          {/* 1. Lojas Americanas (Noroeste) */}
          <rect x="18" y="22" width="22" height="18" rx="1" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.4" />
          <text x="29" y="32" textAnchor="middle" fontSize="2" fill="#334155" fontWeight="700">Lojas Americanas</text>

          {/* 2. Área Carga & Serviços (Norte) */}
          <rect x="42" y="22" width="20" height="10" rx="1" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.4" />
          <text x="52" y="28" textAnchor="middle" fontSize="1.8" fill="#475569">Carga & Serviços</text>

          {/* 3. C&A (Nordeste / Sudeste) */}
          <rect x="64" y="22" width="18" height="20" rx="1" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.4" />
          <text x="73" y="33" textAnchor="middle" fontSize="2.2" fill="#334155" fontWeight="700">C&A</text>

          <rect x="18" y="58" width="22" height="18" rx="1" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.4" />
          <text x="29" y="68" textAnchor="middle" fontSize="2.2" fill="#334155" fontWeight="700">C&A</text>

          {/* 4. Riachuelo (Suldeste) */}
          <rect x="64" y="58" width="18" height="18" rx="1" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.4" />
          <text x="73" y="68" textAnchor="middle" fontSize="2.2" fill="#334155" fontWeight="700">Riachuelo</text>

          {/* Praça Central / Átrio Oval (Com espelhos d'água e vegetação) */}
          <ellipse cx="50" cy="50" rx="16" ry="7" fill="#86efac" opacity="0.6" stroke="#22c55e" strokeWidth="0.4" />
          <ellipse cx="50" cy="50" rx="10" ry="4" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="0.4" />
          <text x="50" y="51" textAnchor="middle" fontSize="2.2" fill="#0f172a" fontWeight="700">Praça Central / Átrio</text>

          {/* Vagas Demarcadas nos Perímetros (Simulação de Baias) */}
          <g stroke="#ffffff" strokeWidth="0.3" strokeDasharray="1 0.8">
            {/* Vagas Norte (Setor A) */}
            {Array.from({ length: 12 }).map((_, i) => (
              <line key={`n-${i}`} x1={20 + i * 5} y1="6" x2={20 + i * 5} y2="16" />
            ))}
            {/* Vagas Sul (Setor C/D) */}
            {Array.from({ length: 12 }).map((_, i) => (
              <line key={`s-${i}`} x1={20 + i * 5} y1="84" x2={20 + i * 5} y2="94" />
            ))}
          </g>

          {/* Entrada Principal Sul (Recuo da baia) */}
          <path d="M 42,84 Q 50,78 58,84 Z" fill="#2563eb" opacity="0.9" />
          <text x="50" y="83" textAnchor="middle" fontSize="2" fill="#ffffff" fontWeight="800">ENTRADA SUL</text>

          {/* --- ROTAS DA NAVEGAÇÃO --- */}
          {/* Guia pontilhada */}
          <path d={fullPath} fill="none" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1.2" />

          {/* Percurso Percorrido Azul */}
          <path d={donePath} fill="none" stroke="#2563eb" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />

          {/* Destino Vaga A-145 */}
          <g transform={`translate(${pts[pts.length - 1].x}, ${pts[pts.length - 1].y})`}>
            <circle cx="0" cy="0" r="3.5" fill="#22c55e" opacity="0.35" />
            <circle cx="0" cy="0" r="2" fill="#22c55e" stroke="#ffffff" strokeWidth="0.6" />
            <text x="0" y="-3" textAnchor="middle" fontSize="2.2" fill="#15803d" fontWeight="800">Vaga A-145</text>
          </g>

          {/* Marcador do Veículo em movimento */}
          <g transform={`translate(${currentPos.x}, ${currentPos.y})`}>
            <circle cx="0" cy="0" r="3.8" fill="#2563eb" opacity="0.3" />
            <circle cx="0" cy="0" r="2.2" fill="#2563eb" stroke="#ffffff" strokeWidth="0.8" />
          </g>
        </svg>
      </div>

      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm border border-slate-200">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Planta Baixa · Térreo
      </div>
    </div>
  );
}

// --- COMPONENTE DA TELA ---
function NavegacaoApp() {
  const [view, setView] = useState("2d");
  const [stepIndex, setStepIndex] = useState(0);

  const totalSteps = NAVIGATION_STEPS.length;
  const isLastStep = stepIndex >= totalSteps - 1;

  const handleNextStep = () => {
    if (!isLastStep) {
      setStepIndex((prev) => prev + 1);
    } else {
      // Redireciona para a nova tela de Check-in ao finalizar
      window.location.href = "checkin.html";
    }
  };

  const handleBackToSetores = () => {
    window.location.href = "setores.html";
  };

  return (
    <div className="w-full max-w-md sm:max-w-lg bg-[#fbf8f3] rounded-[32px] border border-slate-200/80 shadow-2xl p-4 sm:p-6 flex flex-col gap-4 text-slate-800 font-sans mx-auto">
      
      {/* Header com o Botão de Voltar Padronizado */}
      <header className="flex items-center gap-3">
        <button
          onClick={handleBackToSetores}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-700 shadow-sm border border-slate-200/60 hover:bg-slate-50 transition-colors"
        >
          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-slate-900 truncate">Shopping Center Cidade Jardim</h1>
          <p className="text-xs text-slate-500 truncate">
            Rota até a vaga {SECTOR.spotNumber} · {SECTOR.title}
          </p>
        </div>
      </header>

      {/* Mapa do Estacionamento */}
      <div className="relative">
        <FloorPlanMap progress={stepIndex} view={view} />
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={() => setView((prev) => (prev === "3d" ? "2d" : "3d"))}
            className="px-3 py-1.5 text-xs font-bold bg-white/95 rounded-full shadow-md text-slate-700 border border-slate-200"
          >
            Modo {view === "3d" ? "2D" : "3D"}
          </button>
        </div>
      </div>

      {/* Card do Setor */}
      <div className="rounded-2xl p-3.5 flex justify-between items-center bg-white border border-slate-200/80 shadow-xs">
        <div>
          <div className="text-base font-extrabold text-slate-900">{SECTOR.title}</div>
          <div className="text-xs text-slate-500">SCN · Asa Norte, Brasília - DF</div>
          <div className="text-xs text-blue-600 font-semibold mt-1">
            {totalSteps} passos · Vaga {SECTOR.spotNumber} · {SECTOR.sub}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-blue-600">
            {isLastStep ? "0m" : `${(totalSteps - 1 - stepIndex) * 90}m`}
          </div>
          <div className="text-[10px] text-slate-400">até a vaga</div>
        </div>
      </div>

      {/* Passos do Guia */}
      <div className="flex flex-col gap-2">
        {NAVIGATION_STEPS.map((item, idx) => {
          const isActive = stepIndex === idx;
          const isDone = stepIndex > idx;

          return (
            <div
              key={item.id}
              className={`rounded-2xl p-3 flex items-center gap-3 border transition-all ${
                item.isGreen && (isActive || isDone)
                  ? "border-emerald-500 bg-emerald-50/60"
                  : isActive
                  ? "border-blue-600 bg-blue-50/60 shadow-xs"
                  : "border-slate-200/80 bg-white"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 text-sm font-bold ${
                  item.isGreen ? "bg-emerald-500" : isActive ? "bg-blue-600" : "bg-slate-400"
                }`}
              >
                {item.id}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-[10px] font-bold ${item.isGreen ? "text-emerald-600" : "text-blue-600"}`}>
                  {item.dist}
                </div>
                <div className="text-xs font-bold text-slate-800 leading-tight truncate">
                  {item.text}
                </div>
                <div className="text-[10px] text-slate-400">{item.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ações */}
      <div className="flex gap-3 mt-1">
        <button
          onClick={handleBackToSetores}
          className="flex-1 border border-slate-300 rounded-full text-xs font-bold py-3 text-slate-700 bg-white hover:bg-slate-50"
        >
          Voltar ao Mapa
        </button>
        <button
          onClick={handleNextStep}
          className={`flex-1 text-white rounded-full text-xs font-bold py-3 shadow-md ${
            isLastStep ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isLastStep ? "Finalizar Navegação" : "Próximo Passo"}
        </button>
      </div>

    </div>
  );
}

const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(rootElement);
root.render(<NavegacaoApp />);