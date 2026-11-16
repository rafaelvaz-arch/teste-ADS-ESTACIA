const { useState, useEffect, useRef } = React;

function CheckinApp() {
  // Estados unificados (priorizando a lógica do teste, mas nomes do ADS-ESTACIA)
  const [etapa, setEtapa] = useState('camera'); // 'camera' | 'validando' | 'recusado' | 'veiculo'
  const [mensagemErro, setMensagemErro] = useState('');
  const [erroCamera, setErroCamera] = useState('');
  const [codigoManual, setCodigoManual] = useState('');
  const [vagaConfirmada, setVagaConfirmada] = useState(null); // { id_vaga, codigo }

  // Dados do veículo (do teste)
  const [tipoIdentificacao, setTipoIdentificacao] = useState('PLACA');
  const [identificadorVeiculo, setIdentificadorVeiculo] = useState('');
  const [salvandoEstadia, setSalvandoEstadia] = useState(false);

  // Refs da câmera (do teste)
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animacaoRef = useRef(null);
  const streamRef = useRef(null);
  const lendoRef = useRef(false);

  // Recupera vaga de destino da sessão (do ADS-ESTACIA, para exibir no topo se houver)
  const destinoSessao = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('estacia_vaga_destino') || 'null');
    } catch (e) { return null; }
  })();

  // --- LÓGICA DA CÂMERA (Copiado/Adaptado do checkinteste.jsx) ---

  const pararCamera = () => {
    if (animacaoRef.current) {
      cancelAnimationFrame(animacaoRef.current);
      animacaoRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const escanearFrame = () => {
    if (lendoRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { alpha: false }); // Otimização
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Certifique-se de que o jsQR está carregado no index.html via CDN
      const qrCode = window.jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (qrCode && qrCode.data) {
        lendoRef.current = true;
        const codigoLido = qrCode.data.trim().toUpperCase();
        pararCamera();
        validarVagaNoBanco(codigoLido);
        return;
      }
    }

    animacaoRef.current = requestAnimationFrame(escanearFrame);
  };

  const iniciarCamera = async () => {
    setErroCamera('');
    lendoRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } } // Prefere câmera traseira
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', true);
        await videoRef.current.play();
        animacaoRef.current = requestAnimationFrame(escanearFrame);
      }
    } catch (err) {
      console.error(err);
      setErroCamera('Não foi possível acessar a câmera. Verifique as permissões ou digite o código manualmente.');
    }
  };

  // Gerencia o ciclo de vida da câmera baseado na etapa atual
  useEffect(() => {
    if (etapa === 'camera') {
      iniciarCamera();
    } else {
      pararCamera();
    }
    return () => pararCamera();
  }, [etapa]);

  // --- INTEGRAÇÃO SUPABASE (Copiado/Adaptado do checkinteste.jsx) ---

  const validarVagaNoBanco = async (codigoVaga) => {
    if (!codigoVaga) return;
    pararCamera();
    setEtapa('validando');

    try {
      // Pega usuário logado (do teste)
      const usuarioStr = localStorage.getItem('usuarioLogado');
      const usuario = usuarioStr ? JSON.parse(usuarioStr) : null;

      if (!usuario || !usuario.id_usuario) {
        window.location.href = 'index.html'; // Redireciona se não logado
        return;
      }

      // Chama a função RPC do banco (lógica do teste)
      const { data, error } = await supabase.rpc('realizar_checkin', {
        p_codigo_vaga: codigoVaga,
        p_id_usuario: usuario.id_usuario
      });

      if (error) {
        console.error("Supabase Error:", error);
        setMensagemErro('Erro ao validar vaga no servidor: ' + error.message);
        setEtapa('recusado');
        return;
      }

      if (data && data.sucesso) {
        // Sucesso: Vaga livre, agora pedir dados do veículo
        setVagaConfirmada({ id_vaga: data.id_vaga, codigo: codigoVaga });
        setEtapa('veiculo');
      } else {
        // Vaga ocupada ou erro na regra de negócio
        setMensagemErro((data && data.mensagem) || 'Esta vaga não está disponível.');
        setEtapa('recusado');
      }
    } catch (err) {
      console.error("Connection Error:", err);
      setMensagemErro('Falha de conexão com o servidor.');
      setEtapa('recusado');
    }
  };

  // Grava a estadia final (combinação das lógicas)
  const confirmarEstadia = async (e) => {
    e.preventDefault();
    if (!identificadorVeiculo.trim() || !vagaConfirmada) return;

    setSalvandoEstadia(true);
    try {
      const usuario = JSON.parse(localStorage.getItem('usuarioLogado'));
      const identificadorFormatado = identificadorVeiculo.trim().toUpperCase();

      // Insere na tabela estadias (lógica do teste)
      const { data: estadia, error } = await supabase
        .from('estadias')
        .insert([
          {
            id_usuario: usuario.id_usuario,
            id_vaga: vagaConfirmada.id_vaga,
            tipo_identificacao: tipoIdentificacao,
            identificador_veiculo: identificadorFormatado,
            data_hora_entrada: new Date().toISOString(),
            taxa_por_hora: 8.50 // Valor padrão, altere se necessário
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Salva dados locais para o monitoramento (lógica do teste)
      localStorage.setItem(
        'vagaAtual',
        JSON.stringify({
          id_vaga: vagaConfirmada.id_vaga,
          codigo_vaga: vagaConfirmada.codigo,
          id_estadia: estadia.id_estadia,
          veiculo: identificadorFormatado
        })
      );

      // Redireciona (usando a navegação do ADS-ESTACIA)
      window.location.href = 'monitoramento.html';
    } catch (err) {
      console.error("Estadia Error:", err);
      alert('Erro ao registrar estadia: ' + err.message);
      setSalvandoEstadia(false);
    }
  };

  const tentarNovamente = () => {
    setMensagemErro('');
    setCodigoManual('');
    setEtapa('camera');
  };

  // --- RENDERIZAÇÃO VISUAL (Design do checkinADS-ESTACIA.jsx) ---

  return (
    <div className="w-full max-w-md sm:max-w-lg bg-[#e8f1fd] rounded-[32px] border border-slate-200/80 shadow-2xl p-4 sm:p-6 flex flex-col gap-4 text-slate-800 font-sans mx-auto my-8">
      {/* Cabeçalho (Design ADS-ESTACIA) */}
      <header className="flex items-center gap-3">
        <a
          href={destinoSessao ? "navegacao.html" : "principal.html"}
          onClick={pararCamera}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-700 shadow-sm border border-slate-200/60 hover:bg-slate-50 transition-colors"
        >
          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-slate-900 truncate">Check-in</h1>
          <p className="text-xs text-slate-500 truncate">
            {destinoSessao ? `Confirmar vaga ${destinoSessao.vaga}` : 'Registre seu veículo na vaga'}
          </p>
        </div>
      </header>

      {/* ETAPA 1: CÂMERA (Design ADS-ESTACIA + Lógica Teste) */}
      {etapa === 'camera' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col items-center gap-4">
          <div className="text-center">
            <h2 className="font-extrabold text-slate-900 text-base">Escaneie o QR Code</h2>
            <p className="text-xs text-slate-400 mt-1">Aponte a câmera para o código na vaga</p>
          </div>

          {/* Área do Vídeo */}
          <div className="relative w-64 h-64 bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border-2 border-dashed border-slate-700 shadow-inner">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="hidden" />
            {/* Linha de escaneamento animada (CSS necessário no index.html) */}
            <div className="absolute left-4 right-4 h-0.5 bg-blue-500 shadow-[0_0_12px_#3b82f6] animate-scan-line pointer-events-none" />
          </div>

          {erroCamera && (
            <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl text-center border border-amber-200">
              {erroCamera}
            </p>
          )}

          {/* Campo manual (Design ADS-ESTACIA) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              validarVagaNoBanco(codigoManual.trim().toUpperCase());
            }}
            className="w-full pt-3 border-t border-slate-100 flex gap-2"
          >
            <input
              type="text"
              value={codigoManual}
              onChange={(e) => setCodigoManual(e.target.value)}
              placeholder="Ou digite o código (ex: A-145)"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs uppercase focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <button
              type="submit"
              className="bg-blue-600 text-white text-xs font-bold px-5 py-2 rounded-xl hover:bg-blue-700 transition-colors"
            >
              Validar
            </button>
          </form>
        </div>
      )}

      {/* ETAPA 2: VALIDANDO (Spinner limpo) */}
      {etapa === 'validando' && (
        <div className="bg-white rounded-3xl p-12 shadow-sm flex flex-col items-center gap-4 text-center border border-slate-100">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-800">Verificando disponibilidade...</p>
        </div>
      )}

      {/* ETAPA 3: RECUSADO (Design alerta ADS-ESTACIA) */}
      {etapa === 'recusado' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col items-center gap-5 text-center border-2 border-red-200">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-4xl font-black">
            ✕
          </div>
          <div>
            <h2 className="font-extrabold text-red-700 text-lg">Acesso Negado</h2>
            <p className="text-sm text-slate-600 mt-1 px-2">{mensagemErro}</p>
          </div>
          <button
            onClick={tentarNovamente}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl text-sm hover:bg-blue-700 transition-colors shadow-md"
          >
            Tentar Ler Outro QR Code
          </button>
        </div>
      )}

      {/* ETAPA 4: FORMULÁRIO VEÍCULO (Design ADS-ESTACIA) */}
      {etapa === 'veiculo' && vagaConfirmada && (
        <form onSubmit={confirmarEstadia} className="bg-white rounded-3xl p-6 shadow-sm flex flex-col gap-5 border border-slate-100">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xl">
              ✓
            </div>
            <div>
              <p className="text-sm font-extrabold text-emerald-900">QR Code lido com sucesso!</p>
              <p className="text-xs text-emerald-700">Vaga identificada: <strong className="font-bold">{vagaConfirmada.codigo}</strong></p>
            </div>
          </div>

          {/* Tipo de Identificação */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-900">Tipo de Identificação</label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              {['PLACA', 'CHASSI'].map(tipo => (
                 <button
                    key={tipo}
                    type="button"
                    onClick={() => setTipoIdentificacao(tipo)}
                    className={`py-2.5 text-xs font-bold rounded-lg transition-colors ${
                      tipoIdentificacao === tipo
                        ? "bg-blue-600 text-white shadow"
                        : "text-slate-600 hover:bg-white/50"
                    }`}
                  >
                    {tipo === 'PLACA' ? 'Placa do Veículo' : 'Chassi'}
                  </button>
              ))}
            </div>
          </div>

          {/* Input do Veículo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-900">
              {tipoIdentificacao === 'PLACA' ? 'Digite a Placa' : 'Digite o Chassi'}
            </label>
            <input
              type="text"
              required
              value={identificadorVeiculo}
              onChange={(e) => setIdentificadorVeiculo(e.target.value)}
              placeholder={tipoIdentificacao === 'PLACA' ? 'Ex: ABC1D23' : 'Ex: 9BWZZZ377VT004251'}
              maxLength={tipoIdentificacao === 'PLACA' ? 7 : 17}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm uppercase font-medium tracking-wider focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <button
            type="submit"
            disabled={salvandoEstadia}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl text-sm shadow-lg hover:bg-blue-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {salvandoEstadia ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Salvando...
              </>
            ) : 'Confirmar Check-in e Iniciar Estadia'}
          </button>
        </form>
      )}
    </div>
  );
}

// Render no elemento root
const rootElement = document.getElementById("root");
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<CheckinApp />);
} else {
  console.error("Elemento 'root' não encontrado no HTML.");
}