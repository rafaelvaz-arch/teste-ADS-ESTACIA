const { useState, useEffect } = React;

// Configuração do Supabase
const SUPABASE_URL = "https://mktgawqrfggmfnqcwvsm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SiOuuGYOJ08WYyczoUTvUA_6yasNb3Z";

const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

function MonitoramentoApp() {
  const [minutes, setMinutes] = useState(14);
  const [amount, setAmount] = useState(1.98);

  // Lê o código da vaga vindo do Check-in via URL ou assume A-145 como padrão
  const urlParams = new URLSearchParams(window.location.search);
  const vagaInicial = urlParams.get("vaga") || "A-145";

  const [vagaCodigo, setVagaCodigo] = useState(vagaInicial);
  const [vagaStatus, setVagaStatus] = useState("LIVRE");

  // Estado da Estadia / Pagamento
  const [statusPagamento, setStatusPagamento] = useState("PENDENTE");
  const [metodoPagamento, setMetodoPagamento] = useState(null);
  const [horaPagamento, setHoraPagamento] = useState(null);

  // Simulação do tempo decorrido
  useEffect(() => {
    const timer = setInterval(() => {
      setMinutes((prev) => prev + 1);
      setAmount((prev) => parseFloat((prev + 0.14).toFixed(2)));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // 1. Atualiza no Supabase (tabela 'vagas') de LIVRE para OCUPADA + Escuta Realtime
  useEffect(() => {
    if (!supabase) return;

    async function atualizarStatusNoSupabase() {
      const { data, error } = await supabase
        .from('vagas')
        .update({ status: 'OCUPADA' })
        .eq('codigo_vaga', vagaCodigo)
        .select();

      if (error) {
        console.error('Erro ao atualizar vaga no banco:', error);
      } else {
        console.log(`✅ Vaga ${vagaCodigo} atualizada no banco para OCUPADA:`, data);
        setVagaStatus('OCUPADA');
      }
    }

    atualizarStatusNoSupabase();

    // Escuta alterações na tabela 'vagas' em tempo real
    const channel = supabase
      .channel('vagas-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'vagas' },
        (payload) => {
          if (payload.new && payload.new.codigo_vaga === vagaCodigo && payload.new.status) {
            setVagaStatus(payload.new.status);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vagaCodigo]);

  // 2. Busca Inicial + Escuta em Tempo Real da Tabela 'estadias' (Pagamento)
  useEffect(() => {
    if (!supabase) return;

    const aplicarAtualizacaoEstadia = (dados) => {
      if (!dados) return;

      if (dados.status_pagamento) {
        setStatusPagamento(dados.status_pagamento);
      }

      if (dados.metodo_pagamento) {
        setMetodoPagamento(dados.metodo_pagamento);
      }

      if (dados.data_hora_pagamento) {
        const hora = new Date(dados.data_hora_pagamento).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        });
        setHoraPagamento(hora);
      }
    };

    // Consulta inicial da estadia ao carregar a página
    async function carregarEstadiaInicial() {
      const { data } = await supabase
        .from('estadias')
        .select('status_pagamento, metodo_pagamento, data_hora_pagamento')
        .eq('id_estadia', 7) // ID da estadia ativa
        .single();

      if (data) aplicarAtualizacaoEstadia(data);
    }

    carregarEstadiaInicial();

    // Escuta em Tempo Real da tabela 'estadias'
    const estadiasChannel = supabase
      .channel('estadias-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'estadias' },
        (payload) => {
          console.log('⚡ ESTADIA EM TEMPO REAL:', payload.new);
          if (payload.new) {
            aplicarAtualizacaoEstadia(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(estadiasChannel);
    };
  }, []);

  return (
    <div className="w-full max-w-md sm:max-w-lg app-card rounded-[32px] border border-white/20 shadow-2xl p-4 sm:p-6 flex flex-col gap-4 text-slate-800 font-sans mx-auto">
      
      {/* Header */}
      <header className="flex items-center gap-3">
        <button
          onClick={() => (window.location.href = "checkin.html")}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-700 shadow-sm border border-slate-200/60 hover:bg-slate-50 transition-colors"
        >
          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-slate-900 truncate">Monitoramento</h1>
          <p className="text-xs text-slate-500 truncate">Acompanhe seu estacionamento</p>
        </div>
      </header>

      {/* Botão Encontre meu Carro */}
      <button
        onClick={() => (window.location.href = "encontremeucarro.html")}
        className="w-full bg-white hover:bg-slate-50 border border-blue-500 text-blue-600 rounded-2xl py-3 text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Encontre meu Carro
      </button>

      {/* Card da Vaga e Métricas */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                VAGA ATUAL ({vagaStatus})
              </div>
              <div className="text-xl font-black text-slate-900">{vagaCodigo}</div>
            </div>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="metric-card-tempo rounded-2xl p-3">
            <div className="flex items-center gap-1.5 text-blue-600 mb-1">
              <svg className="w-3.5 h-3.5 animate-pulse-dot" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[10px] font-bold">Tempo</span>
            </div>
            <div className="text-base font-extrabold text-slate-900">0h {minutes}m</div>
          </div>

          <div className="metric-card-valor rounded-2xl p-3">
            <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
              <span className="text-[10px] font-black">$</span>
              <span className="text-[10px] font-bold">Valor</span>
            </div>
            <div className="text-base font-extrabold text-emerald-600">R$ {amount.toFixed(2).replace(".", ",")}</div>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div>
          <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
            <span>Progresso até próxima hora</span>
            <span>{60 - minutes} min restantes</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="progress-bar-fill bg-slate-900 h-full rounded-full"
              style={{ width: `${(minutes / 60) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Detalhes da Estadia */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs flex flex-col gap-3">
        <h3 className="text-xs font-bold text-slate-900">Detalhes da Estadia</h3>

        <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100">
          <span className="text-slate-400">Status do Pagamento</span>
          <span className={`font-bold ${statusPagamento === 'PAGO' ? 'text-emerald-600' : 'text-amber-600'}`}>
            {statusPagamento}
          </span>
        </div>

        {metodoPagamento && (
          <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100">
            <span className="text-slate-400">Método de Pagamento</span>
            <span className="font-bold text-slate-800">{metodoPagamento}</span>
          </div>
        )}

        {horaPagamento && (
          <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100">
            <span className="text-slate-400">Horário do Pagamento</span>
            <span className="font-bold text-slate-800">{horaPagamento}</span>
          </div>
        )}

        <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100">
          <span className="text-slate-400">Check-In</span>
          <span className="font-bold text-slate-800">21:44</span>
        </div>

        <div className="flex justify-between items-center text-xs pt-1">
          <span className="font-bold text-slate-900">Total a pagar</span>
          <span className="text-base font-black text-emerald-600">R$ {amount.toFixed(2).replace(".", ",")}</span>
        </div>
      </div>

      {/* Botão de Pagamento Sempre Ativo */}
      <div className="flex flex-col gap-2 mt-1">
        <button
          onClick={() => window.location.href = `pagamento.html?id=7&valor=${amount}&tempo=${encodeURIComponent(`0h ${minutes}m`)}`}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-3.5 text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Realizar Pagamento
        </button>

        <p className="text-[10px] text-center text-slate-400 font-medium flex items-center justify-center gap-1">
          <span>⏱</span> Você terá 20 minutos após o pagamento para sair
        </p>
      </div>

    </div>
  );
}

const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(rootElement);
root.render(<MonitoramentoApp />);