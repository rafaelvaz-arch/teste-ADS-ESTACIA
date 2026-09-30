const { useState, useEffect, useRef } = React;

function NavegacaoApp() {
  const [shopping, setShopping] = useState('cidade_jardim');
  const [vagasLivres, setVagasLivres] = useState([]);
  const [origem, setOrigem] = useState('TJ_ELEVADOR_CENTRAL');
  const [destino, setDestino] = useState('SS1_SETOR_A_VAGA_145');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const canvasRef = useRef(null);

  // Carrega disponibilidade ao iniciar
  useEffect(() => {
    carregarVagasDisponiveis();
  }, [shopping]);

  const carregarVagasDisponiveis = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/vagas/');
      const data = await res.json();
      if (data.status === 'success') {
        setVagasLivres(data.vagas);
      }
    } catch (err) {
      console.warn("Usando catálogo padrão de vagas.");
    }
  };

  const buscarERenderizarRota = async () => {
    setLoading(true);
    setStatus({ tipo: 'info', mensagem: 'Consultando Supabase e gerando trajeto A*...' });

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/v1/rota/?origem=${origem}&destino=${destino}`);
      const data = await response.json();

      if (data.status === 'success') {
        setStatus({
          tipo: 'sucesso',
          mensagem: `Rota calculada! Distância total: ${data.distance_meters}m em ${data.total_nodes} waypoints.`
        });
        desenharMapaETrilho(data.waypoints);
      } else {
        setStatus({ tipo: 'erro', mensagem: data.message });
        limparCanvas();
      }
    } catch (error) {
      setStatus({ tipo: 'erro', mensagem: 'Erro de comunicação com a API Django.' });
      limparCanvas();
    } finally {
      setLoading(false);
    }
  };

  const desenharMapaETrilho = (waypoints) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Fundo e Grid estilo Blueprint
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    if (!waypoints || waypoints.length === 0) return;

    // 2. Traçar linha neon da rota
    ctx.beginPath();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#0284c7'; // Glow externo
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    waypoints.forEach((ponto, index) => {
      const posX = ponto.x * 4.8 + 60;
      const posY = ponto.y * 2.1 + 50;
      if (index === 0) ctx.moveTo(posX, posY);
      else ctx.lineTo(posX, posY);
    });
    ctx.stroke();

    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#38bdf8'; // Núcleo ciano neon
    waypoints.forEach((ponto, index) => {
      const posX = ponto.x * 4.8 + 60;
      const posY = ponto.y * 2.1 + 50;
      if (index === 0) ctx.moveTo(posX, posY);
      else ctx.lineTo(posX, posY);
    });
    ctx.stroke();

    // 3. Desenhar nós com balões e textos desalinhados (evita sobreposição)
    waypoints.forEach((ponto, index) => {
      const posX = ponto.x * 4.8 + 60;
      const posY = ponto.y * 2.1 + 50;

      // Glow Ponto
      ctx.beginPath();
      ctx.arc(posX, posY, 10, 0, 2 * Math.PI);
      ctx.fillStyle = index === 0 ? 'rgba(34, 197, 94, 0.25)' : (index === waypoints.length - 1 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)');
      ctx.fill();

      // Ponto Central
      ctx.beginPath();
      ctx.arc(posX, posY, 6, 0, 2 * Math.PI);
      ctx.fillStyle = index === 0 ? '#22c55e' : (index === waypoints.length - 1 ? '#ef4444' : '#f59e0b');
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Rótulo dinâmico (alterna acima e abaixo para não colidir)
      const isEven = index % 2 === 0;
      const labelY = isEven ? posY - 18 : posY + 22;

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(posX - 40, labelY - 12, 110, 18, 4);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillText(`${ponto.node} (Z=${ponto.z})`, posX - 35, labelY);
    });
  };

  const limparCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  return (
    <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
      {/* Cabeçalho de Seleção de Shopping */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-5 mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">ESTACIA — Navegação Inteligente</h1>
          <p className="text-slate-400 text-xs mt-1">Selecione o estabelecimento e encontre sua vaga em tempo real</p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-slate-400">SHOPPING:</label>
          <select 
            value={shopping} 
            onChange={(e) => setShopping(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sky-400 text-xs font-semibold outline-none focus:border-sky-500"
          >
            <option value="cidade_jardim">Shopping Center Cidade Jardim</option>
            <option value="iguatemi" disabled>Shopping Iguatemi (Em breve)</option>
          </select>
        </div>
      </div>

      {/* Grid de Disponibilidade de Vagas do Supabase */}
      <div className="mb-6 bg-slate-950 border border-slate-800/80 rounded-xl p-4">
        <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase block mb-3">Vagas Disponíveis em Tempo Real (Supabase)</span>
        <div className="flex flex-wrap gap-3">
          {vagasLivres.map((v) => (
            <div key={v.id} className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-medium text-emerald-300">{v.setor} — Vaga {v.numero}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Formulário de Origem e Destino */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2">PONTO DE ENTRADA / ORIGEM</label>
          <select 
            value={origem} 
            onChange={(e) => setOrigem(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:border-sky-500 outline-none"
          >
            <option value="TJ_ELEVADOR_CENTRAL">Elevador Central (Térreo Z=0)</option>
            <option value="TJ_ENTRADA_SUL">Entrada Sul (Térreo Z=0)</option>
            <option value="TJ_RAMPA_1_TOPO">Topo Rampa 1 (Térreo Z=0)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2">VAGA DESTINO SELECIONADA</label>
          <select 
            value={destino} 
            onChange={(e) => setDestino(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:border-sky-500 outline-none"
          >
            <option value="SS1_SETOR_A_VAGA_145">Setor A — Vaga 145 (Subsolo SS1 Z=-1)</option>
            <option value="SS1_SETOR_B_VAGA_089">Setor B — Vaga 089 (Subsolo SS1 Z=-1)</option>
            <option value="SS1_SETOR_EV_01">Elétricos — Vaga EV 01 (Subsolo SS1 Z=-1)</option>
          </select>
        </div>

        <div className="flex items-end">
          <button 
            onClick={buscarERenderizarRota}
            disabled={loading}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2.5 px-4 rounded-lg transition-all text-xs tracking-wide disabled:opacity-50 shadow-lg shadow-sky-600/20"
          >
            {loading ? 'Calculando Rota...' : 'GERAR ROTA GPS 3D'}
          </button>
        </div>
      </div>

      {/* Painel de Status */}
      {status && (
        <div className={`p-3 rounded-lg text-xs mb-6 border ${
          status.tipo === 'sucesso' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
          status.tipo === 'erro' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
          'bg-sky-500/10 border-sky-500/30 text-sky-400'
        }`}>
          {status.mensagem}
        </div>
      )}

      {/* Viewport do Canvas Blueprint */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-center items-center overflow-x-auto">
        <canvas ref={canvasRef} width={800} height={400} className="rounded-lg shadow-inner" />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<NavegacaoApp />);