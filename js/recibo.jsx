const { useState, useEffect, useRef } = React;

const SUPABASE_URL = "https://mktgawqrfggmfnqcwvsm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SiOuuGYOJ08WYyczoUTvUA_6yasNb3Z";
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

function ReciboApp() {
  const ticketRef = useRef(null);
  const [baixandoPng, setBaixandoPng] = useState(false);

  // 1. Lê parâmetros da URL e dados salvos no sessionStorage
  const urlParams = new URLSearchParams(window.location.search);
  const dadosSalvos = JSON.parse(sessionStorage.getItem('estacia_recibo_dados') || '{}');

  const idEstadia = Number(urlParams.get('id') || dadosSalvos.id_estadia || 7);
  const [vagaCodigo, setVagaCodigo] = useState(urlParams.get('vaga') || dadosSalvos.vaga || 'A-145');
  const [valorPago, setValorPago] = useState(Number(urlParams.get('valor') || dadosSalvos.valor || 0));
  const [tempoPermanencia, setTempoPermanencia] = useState(urlParams.get('tempo') || dadosSalvos.tempo || '0h 15m');
  const [metodoPagamento, setMetodoPagamento] = useState(urlParams.get('metodo') || dadosSalvos.metodo || 'PIX');

  // 2. Recupera o horário exato de Check-in salvo pelo monitoramento.jsx
  const [horaCheckin] = useState(() => {
    const inicioSalvo = sessionStorage.getItem('estacia_inicio_estadia');
    if (inicioSalvo) {
      return new Date(Number(inicioSalvo)).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return dadosSalvos.hora_checkin || '--:--';
  });

  // 3. Recupera ou registra o timestamp exato da confirmação do pagamento
    const [pagamentoTimestamp] = useState(() => {
    const salvo = sessionStorage.getItem('estacia_pagamento_timestamp');
    return salvo ? Number(salvo) : null;
  });

  const dataPagamentoFormatada = pagamentoTimestamp
    ? new Date(pagamentoTimestamp).toLocaleDateString('pt-BR')
    : new Date().toLocaleDateString('pt-BR');

  const horaPagamentoFormatada = pagamentoTimestamp
    ? new Date(pagamentoTimestamp).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    : '--:--';

  // 4. Cronômetro regressivo de 20 minutos (só inicia se houver pagamento confirmado)
  const calcularSegundosRestantes = () => {
    const LIMITE_20_MIN = 20 * 60;
    if (!pagamentoTimestamp) return LIMITE_20_MIN;
    const decorridos = Math.floor((Date.now() - pagamentoTimestamp) / 1000);
    return Math.max(0, LIMITE_20_MIN - decorridos);
  };

  const [timeLeft, setTimeLeft] = useState(calcularSegundosRestantes);

  useEffect(() => {
    if (!pagamentoTimestamp) return;

    const interval = setInterval(() => {
      const restante = calcularSegundosRestantes();
      setTimeLeft(restante);
      if (restante <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [pagamentoTimestamp]);
  // 5. Sincroniza também com o Supabase caso falte algum dado na sessão
  useEffect(() => {
    if (!supabase) return;

    async function buscarDadosEstadia() {
      const { data } = await supabase
        .from('estadias')
        .select('metodo_pagamento, data_hora_pagamento')
        .eq('id_estadia', idEstadia)
        .single();

      if (data && data.metodo_pagamento && !urlParams.get('metodo') && !dadosSalvos.metodo) {
        setMetodoPagamento(data.metodo_pagamento);
      }
    }

    buscarDadosEstadia();
  }, [idEstadia]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Opção 1: Baixar como PNG usando html2canvas
  const handleBaixarPNG = async () => {
    if (!ticketRef.current || !window.html2canvas) {
      alert('Aguarde o carregamento da ferramenta de imagem.');
      return;
    }

    setBaixandoPng(true);
    try {
      const canvas = await window.html2canvas(ticketRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true
      });

      const link = document.createElement('a');
      link.download = `ticket-estacia-${vagaCodigo}-${idEstadia}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Erro ao gerar PNG:', err);
      alert('Não foi possível gerar a imagem PNG.');
    } finally {
      setBaixandoPng(false);
    }
  };

  // Opção 2: Baixar como PDF (abre diálogo de impressão/Salvar como PDF limpo)
  const handleBaixarPDF = () => {
    window.print();
  };

  // Finaliza saída e libera vaga no Supabase (mesma lógica do pagamento.jsx)
  const handleConcluirSaida = async () => {
    try {
      if (supabase) {
        await supabase
          .from('vagas')
          .update({ status: 'LIVRE' })
          .eq('codigo_vaga', vagaCodigo);

        await supabase
          .from('estadias')
          .update({
            status_pagamento: 'PENDENTE',
            data_hora_pagamento: null,
            metodo_pagamento: null
          })
          .eq('id_estadia', idEstadia);
      }
    } catch (err) {
      console.error('Erro ao liberar vaga:', err);
    } finally {
      sessionStorage.removeItem('estacia_inicio_estadia');
      sessionStorage.removeItem('estacia_pagamento_timestamp');
      sessionStorage.removeItem('estacia_recibo_dados');
      window.location.href = 'principal.html';
    }
  };

  return (
    <div className="w-full max-w-md flex flex-col gap-4 mx-auto">

      {/* Barra Superior (oculta no PDF) */}
      <header className="flex items-center justify-between text-white no-print px-1">
        <button
          type="button"
          onClick={() => (window.location.href = 'monitoramento.html')}
          className="w-10 h-10 bg-white/15 hover:bg-white/25 rounded-full flex items-center justify-center text-white backdrop-blur-xs transition-colors cursor-pointer"
          title="Voltar ao monitoramento"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center">
          <h1 className="text-base font-bold tracking-tight">Comprovante Digital</h1>
          <p className="text-[11px] text-blue-200">Ticket de liberação de saída</p>
        </div>

        <div className="w-10" />
      </header>

      {/* Banner do Cronômetro de 20 Minutos (oculto no PDF) */}
      <div className={`no-print rounded-2xl p-3.5 border flex items-center justify-between shadow-lg ${
        timeLeft > 0
          ? 'bg-white/95 border-blue-200 text-slate-800'
          : 'bg-red-50 border-red-300 text-red-800'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            timeLeft > 0 ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'
          }`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth="2"></circle>
              <polyline points="12 6 12 12 16 14" strokeWidth="2"></polyline>
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Tempo para saída
            </p>
            <p className="text-xs font-semibold text-slate-700">
              {timeLeft > 0 ? 'Apresente na cancela se solicitado' : 'Tempo de tolerância expirado'}
            </p>
          </div>
        </div>

        <div className={`text-xl font-black tabular-nums px-3 py-1 rounded-xl ${
          timeLeft > 0 ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* CARD DO RECIBO / TICKET (Área capturada no PNG e no PDF) */}
      <div
        id="ticket-para-download"
        ref={ticketRef}
        className="bg-white rounded-[28px] shadow-2xl p-6 text-slate-800 flex flex-col gap-5 border border-slate-100"
      >
        {/* Cabeçalho do Ticket */}
        <div className="flex flex-col items-center text-center gap-2 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div>
            <span className="text-xs font-extrabold tracking-widest uppercase text-blue-600">
              EstaciA 
            </span>
            <h2 className="text-xl font-black text-slate-900 mt-0.5">
              Recibo de Pagamento
            </h2>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            PAGAMENTO CONFIRMADO
          </span>
        </div>

        {/* Destaque da Vaga */}
       {/* Destaque da Vaga */}
        <div className="bg-blue-50/80 border border-blue-100 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 block">
            Vaga Utilizada
          </span>
          <span className="text-3xl font-black text-blue-950 mt-0.5">{vagaCodigo}</span>
        </div>
        

        {/* Lista de Informações Ligadas ao Sistema */}
        <div className="flex flex-col gap-2.5 text-xs">
          <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
            <span className="text-slate-400 font-medium">Data</span>
            <span className="font-bold text-slate-800">{dataPagamentoFormatada}</span>
          </div>

          <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
            <span className="text-slate-400 font-medium">Check-in (Entrada)</span>
            <span className="font-bold text-slate-800">{horaCheckin}</span>
          </div>

          <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
            <span className="text-slate-400 font-medium">Horário do Pagamento</span>
            <span className="font-bold text-slate-800">{horaPagamentoFormatada}</span>
          </div>

          <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
            <span className="text-slate-400 font-medium">Tempo de Permanência</span>
            <span className="font-bold text-slate-800">{tempoPermanencia}</span>
          </div>

          <div className="flex justify-between items-center py-1.5">
            <span className="text-slate-400 font-medium">Método de Pagamento</span>
            <span className="font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg uppercase">
              {metodoPagamento}
            </span>
          </div>
        </div>

        {/* Divisória Picotada */}
        <div className="ticket-divider my-1"></div>

        {/* Total Pago */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <span className="text-xs font-bold text-slate-900 block">Total Pago</span>
            <span className="text-[10px] text-slate-400">Tolerância de 20 minutos após pagamento</span>
          </div>
          <span className="text-2xl font-black text-blue-600">
            R$ {valorPago.toFixed(2).replace('.', ',')}
          </span>
        </div>
      </div>

      {/* Botões de Download: PNG e PDF (ocultos no PDF) */}
      <div className="grid grid-cols-2 gap-3 no-print">
        <button
          type="button"
          onClick={handleBaixarPNG}
          disabled={baixandoPng}
          className="bg-white hover:bg-blue-50 text-blue-700 font-bold text-xs py-3.5 px-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {baixandoPng ? 'Gerando...' : 'Baixar PNG'}
        </button>

        <button
          type="button"
          onClick={handleBaixarPDF}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-3.5 px-4 rounded-2xl shadow-lg border border-blue-400/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Baixar PDF
        </button>
      </div>

      {/* Botão para encerrar sessão e liberar vaga */}
      <button
        type="button"
        onClick={handleConcluirSaida}
        className="no-print w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold text-xs py-3 rounded-2xl transition-all cursor-pointer"
      >
        Concluir Saída e Voltar ao Início
      </button>

    </div>
  );
}

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(<ReciboApp />);