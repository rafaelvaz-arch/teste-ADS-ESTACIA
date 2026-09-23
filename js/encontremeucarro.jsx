const { useState } = React;

const STEPS = [
  {
    id: 1,
    icon: "🛍️",
    title: "Saia da Riachuelo",
    dist: "Distancia: 15m",
    detail: "Saia da porta principal da Riachuelo em direcao ao Atrio Central",
    mapPos: { x: 38, y: 68 }
  },
  {
    id: 2,
    icon: "🚶",
    title: "Siga pelo Atrio Central",
    dist: "Distancia: 35m",
    detail: "Caminhe em direcao ao Norte pelo corredor principal em direcao a Saida Norte",
    mapPos: { x: 51.5, y: 45 }
  },
  {
    id: 3,
    icon: "🚪",
    title: "Atravesse a Saida Norte",
    dist: "Distancia: 20m",
    detail: "Saia pelas portas da Saida Norte em direcao ao estacionamento",
    mapPos: { x: 51.5, y: 24 }
  },
  {
    id: 4,
    icon: "✅",
    title: "Voce chegou!",
    dist: "Seu carro esta a sua direita",
    detail: "A vaga A145 fica no Setor A (Bolsao Nordeste)",
    isArrival: true,
    mapPos: { x: 72, y: 14 }
  }
];

function EncontreMeuCarroApp() {
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = STEPS.length;
  const activeData = STEPS[currentStep];

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      window.location.href = "monitoramento.html";
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      window.location.href = "monitoramento.html";
    }
  };

  const progressPercent = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="w-full max-w-md sm:max-w-lg app-card rounded-[32px] border border-white/20 shadow-2xl p-4 sm:p-6 flex flex-col gap-4 text-slate-800 font-sans mx-auto min-h-[660px] justify-between">
      
      {/* Header */}
      <header className="flex items-center gap-3">
        <button 
          onClick={handlePrev}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-700 shadow-sm border border-slate-200/60 hover:bg-slate-50 transition-colors"
        >
          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path>
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-slate-900 truncate">Encontre meu Carro</h1>
          <p className="text-xs text-slate-500 truncate">Origem: Riachuelo para Vaga A145 (Setor A)</p>
        </div>
      </header>

      {/* Cards Indicadores */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-3 rounded-2xl text-center border border-slate-100 shadow-xs flex flex-col items-center justify-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">VAGA</p>
          <p className="text-lg font-black text-blue-600 mt-0.5">A145</p>
        </div>
        <div className="bg-white p-3 rounded-2xl text-center border border-slate-100 shadow-xs flex flex-col items-center justify-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">SETOR</p>
          <p className="text-lg font-black text-slate-900 mt-0.5">Setor A</p>
        </div>
      </div>

      {/* Planta Fiel ao Desenho Original */}
      <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-xs flex flex-col gap-3">
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PLANTA BAIXA REAL</span>
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Terreo</span>
        </div>

        <div className="relative w-full h-56 bg-[#e2e8f0] rounded-2xl overflow-hidden border border-slate-300">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* Fundo Estacionamento */}
            <rect x="0" y="0" width="100" height="100" fill="#cbd5e1"></rect>

            {/* Vagas do Setor A (Lado Superior Direito - Nordeste) */}
            <line x1="60" y1="10" x2="90" y2="10" stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="1 1"></line>
            <line x1="60" y1="16" x2="90" y2="16" stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="1 1"></line>
            <text x="75" y="7" fontSize="2.5" textAnchor="middle" fill="#334155" fontWeight="bold">SETOR A</text>

            {/* Estrutura do Predio do Shopping */}
            <rect x="13" y="24" width="74" height="60" fill="#ffffff" stroke="#334155" strokeWidth="1.2" rx="1"></rect>

            {/* Atrio / Corredor Central */}
            <rect x="47" y="24" width="9" height="60" fill="#f8fafc"></rect>
            <text x="51.5" y="54" fontSize="1.8" textAnchor="middle" fill="#94a3b8" fontWeight="bold">ATRIO CENTRAL</text>

            {/* Bloco Esquerdo Superior: C&A e Lojas Americanas */}
            <rect x="15" y="26" width="15" height="26" fill="#e0e7ff" stroke="#a5b4fc" strokeWidth="0.5" rx="0.5"></rect>
            <text x="22.5" y="40" fontSize="2.2" textAnchor="middle" fill="#3730a3" fontWeight="bold">CEA</text>

            <rect x="31" y="26" width="15" height="26" fill="#fee2e2" stroke="#fca5a5" strokeWidth="0.5" rx="0.5"></rect>
            <text x="38.5" y="38" fontSize="1.7" textAnchor="middle" fill="#991b1b" fontWeight="bold">AMERICANAS</text>

            {/* Bloco Esquerdo Inferior: Riachuelo */}
            <rect x="15" y="54" width="31" height="28" fill="#fef3c7" stroke="#fde047" strokeWidth="0.6" rx="0.5"></rect>
            <text x="30.5" y="69" fontSize="3" textAnchor="middle" fill="#854d0e" fontWeight="bold">RIACHUELO</text>

            {/* Bloco Direito: Lojas Menores (L-01, L-03, etc) */}
            <rect x="57" y="26" width="28" height="26" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="0.5" rx="0.5"></rect>
            <rect x="57" y="54" width="28" height="28" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="0.5" rx="0.5"></rect>
            <text x="71" y="40" fontSize="2" textAnchor="middle" fill="#64748b" fontWeight="bold">LOJAS 01-04</text>

            {/* Portas / Acessos Principais */}
            <rect x="47" y="23" width="9" height="1.8" fill="#1e40af" rx="0.3"></rect>
            <text x="51.5" y="21" fontSize="2" textAnchor="middle" fill="#1e40af" fontWeight="black">SAIDA NORTE</text>

            <rect x="47" y="84" width="9" height="1.8" fill="#64748b" rx="0.3"></rect>
            <text x="51.5" y="88" fontSize="2" textAnchor="middle" fill="#475569" fontWeight="bold">SAIDA SUL</text>

            {/* Porta de Saida da Riachuelo para o Atrio */}
            <rect x="45.8" y="66" width="1.2" height="4" fill="#854d0e" rx="0.2"></rect>

            {/* Rota (Riachuelo -> Atrio -> Saida Norte -> Setor A Vaga A145) */}
            <path 
              d="M 38 68 L 51.5 68 L 51.5 24 L 72 24 L 72 14" 
              fill="none" 
              stroke="#2563eb" 
              strokeWidth="1.8" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeDasharray="2 1"
            ></path>

            {/* Marcador da Vaga A145 */}
            <circle cx="72" cy="14" r="3.5" fill="#10b981" stroke="#ffffff" strokeWidth="0.8"></circle>
            <text x="72" y="9" fontSize="3" textAnchor="middle" fill="#047857" fontWeight="black">A145</text>

            {/* Marcador de Posicao Atual */}
            <circle cx={activeData.mapPos.x} cy={activeData.mapPos.y} r="3.5" fill="#2563eb" stroke="#ffffff" strokeWidth="0.8"></circle>
            <circle cx={activeData.mapPos.x} cy={activeData.mapPos.y} r="6.5" fill="#2563eb" className="animate-ping opacity-45"></circle>
          </svg>
        </div>

        {/* Progresso */}
        <div className="px-1 pt-1">
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/50">
            <div 
              className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 h-full rounded-full transition-all duration-300"
              style={{ width: progressPercent + "%" }}
            ></div>
          </div>
          <div className="flex justify-between items-center mt-2 text-[10px] font-bold text-slate-400">
            <span>Passo {currentStep + 1} de {totalSteps}</span>
            <span className="text-blue-600">{activeData.dist}</span>
          </div>
        </div>
      </div>

      {/* Card de Detalhes do Passo */}
      <div className="flex flex-col gap-2">
        {!activeData.isArrival ? (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
              {activeData.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold text-slate-900 truncate">{activeData.title}</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">{activeData.detail}</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-xs flex items-center gap-3 text-emerald-800">
            <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
              {activeData.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-black text-emerald-700 truncate">{activeData.title}</h3>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">{activeData.detail}</p>
            </div>
          </div>
        )}

        {currentStep < totalSteps - 1 && (
          <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-200/50 flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0">A SEGUIR:</span>
            <p className="text-[11px] font-semibold text-slate-600 truncate">{STEPS[currentStep + 1].title}</p>
          </div>
        )}
      </div>

      {/* Botao de Navegacao */}
      <button 
        onClick={handleNext}
        className={`w-full mt-auto py-3.5 rounded-2xl text-xs font-bold shadow-md transition-all text-white flex items-center justify-center gap-2 ${
          activeData.isArrival ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {activeData.isArrival ? 'Concluir Navegacao' : 'Proximo Passo ->'}
      </button>

    </div>
  );
}

const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(rootElement);
root.render(<EncontreMeuCarroApp />);