const { useState, useEffect, useRef } = React;

function CheckinApp() {
  const [etapa, setEtapa] = useState('camera'); // 'camera' | 'validando' | 'recusado' | 'veiculo'
  const [mensagemErro, setMensagemErro] = useState('');
  const [erroCamera, setErroCamera] = useState('');
  const [codigoManual, setCodigoManual] = useState('');
  const [vagaConfirmada, setVagaConfirmada] = useState(null); // { id_vaga, codigo }

  // Dados do veículo
  const [tipoIdentificacao, setTipoIdentificacao] = useState('PLACA');
  const [identificadorVeiculo, setIdentificadorVeiculo] = useState('');
  const [salvandoEstadia, setSalvandoEstadia] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animacaoRef = useRef(null);
  const streamRef = useRef(null);
  const lendoRef = useRef(false);

  // Encerra a câmera com segurança
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

  // Inicia a câmera e o loop de leitura do QR Code
  const iniciarCamera = async () => {
    setErroCamera('');
    lendoRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', true);
        await videoRef.current.play();
        animacaoRef.current = requestAnimationFrame(escanearFrame);
      }
    } catch (err) {
      setErroCamera('Não foi possível acessar a câmera. Verifique a permissão ou digite o código abaixo.');
    }
  };

  const escanearFrame = () => {
    if (lendoRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
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

  useEffect(() => {
    if (etapa === 'camera') {
      iniciarCamera();
    }
    return () => pararCamera();
  }, [etapa]);

  // Consulta a função atômica no Supabase
  const validarVagaNoBanco = async (codigoVaga) => {
    if (!codigoVaga) return;
    pararCamera();
    setEtapa('validando');

    try {
      const usuarioStr = localStorage.getItem('usuarioLogado');
      const usuario = usuarioStr ? JSON.parse(usuarioStr) : null;

      if (!usuario || !usuario.id_usuario) {
        window.location.href = 'index.html';
        return;
      }

      const { data, error } = await supabase.rpc('realizar_checkin', {
        p_codigo_vaga: codigoVaga,
        p_id_usuario: usuario.id_usuario
      });

      if (error) {
        setMensagemErro('Erro ao validar vaga no servidor: ' + error.message);
        setEtapa('recusado');
        return;
      }

      if (data && data.sucesso) {
        setVagaConfirmada({ id_vaga: data.id_vaga, codigo: codigoVaga });
        setEtapa('veiculo');
      } else {
        setMensagemErro((data && data.mensagem) || 'Esta vaga já está em uso.');
        setEtapa('recusado');
      }
    } catch (err) {
      setMensagemErro('Falha de conexão: ' + err.message);
      setEtapa('recusado');
    }
  };

  // Grava a estadia e redireciona para o monitoramento
  const confirmarEstadia = async (e) => {
    e.preventDefault();
    if (!identificadorVeiculo.trim()) return;

    setSalvandoEstadia(true);
    try {
      const usuario = JSON.parse(localStorage.getItem('usuarioLogado'));
      const placaFormatada = identificadorVeiculo.trim().toUpperCase();

      const { data: estadia, error } = await supabase
        .from('estadias')
        .insert([
          {
            id_usuario: usuario.id_usuario,
            id_vaga: vagaConfirmada.id_vaga,
            tipo_identificacao: tipoIdentificacao,
            identificador_veiculo: placaFormatada,
            data_hora_entrada: new Date().toISOString(),
            taxa_por_hora: 8.50
          }
        ])
        .select()
        .single();

      if (error) {
        alert('Erro ao registrar estadia: ' + error.message);
        setSalvandoEstadia(false);
        return;
      }

      // Salva a vaga real ocupada para o "Encontre meu carro" e Monitoramento
      localStorage.setItem(
        'vagaAtual',
        JSON.stringify({
          id_vaga: vagaConfirmada.id_vaga,
          codigo_vaga: vagaConfirmada.codigo,
          id_estadia: estadia.id_estadia,
          veiculo: placaFormatada
        })
      );

      window.location.href = 'monitoramento.html';
    } catch (err) {
      alert('Erro inesperado: ' + err.message);
      setSalvandoEstadia(false);
    }
  };

  const tentarNovamente = () => {
    setMensagemErro('');
    setCodigoManual('');
    setEtapa('camera');
  };

  return (
    <div className="bg-[#f7f4ee] rounded-3xl shadow-2xl p-6 flex flex-col gap-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <a
          href="principal.html"
          onClick={pararCamera}
          className="w-10 h-10 rounded-full bg-white shadow flex items-center justify-center text-[#1565c0] font-bold hover:bg-blue-50"
        >
          ←
        </a>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Check-in</h1>
          <p className="text-xs text-gray-500">Registre seu veículo na vaga</p>
        </div>
      </div>

      {/* ETAPA 1: CÂMERA LEITORA DE QR CODE */}
      {etapa === 'camera' && (
        <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col items-center gap-4">
          <div className="text-center">
            <h2 className="font-bold text-gray-800 text-base">Check-in na Vaga</h2>
            <p className="text-xs text-gray-500 mt-1">Aponte a câmera para o QR Code da vaga</p>
          </div>

          <div className="relative w-64 h-64 bg-gray-950 rounded-2xl overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-600">
            <video ref={videoRef} className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute left-3 right-3 h-0.5 bg-blue-400 shadow-[0_0_8px_#60a5fa] animate-scan-line pointer-events-none" />
          </div>

          {erroCamera && (
            <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg text-center">
              {erroCamera}
            </p>
          )}

          {/* Campo alternativo caso teste no PC sem webcam */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              validarVagaNoBanco(codigoManual.trim().toUpperCase());
            }}
            className="w-full pt-2 border-t border-gray-100 flex gap-2"
          >
            <input
              type="text"
              value={codigoManual}
              onChange={(e) => setCodigoManual(e.target.value)}
              placeholder="Ou digite o código (ex: A-145)"
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-xs uppercase focus:outline-none focus:border-[#1565c0]"
            />
            <button
              type="submit"
              className="bg-[#1565c0] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-blue-800"
            >
              Validar
            </button>
          </form>
        </div>
      )}

      {/* ETAPA 2: VALIDANDO NO BANCO */}
      {etapa === 'validando' && (
        <div className="bg-white rounded-2xl p-8 shadow-sm flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 border-4 border-[#1565c0] border-t-transparent rounded-full animate-spin" />
          <p className="font-semibold text-gray-800">Verificando disponibilidade da vaga...</p>
        </div>
      )}

      {/* ETAPA 3: RECUSADO (VAGA OCUPADA / RESERVADA) */}
      {etapa === 'recusado' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm flex flex-col items-center gap-4 text-center border-2 border-red-200">
          <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl font-bold">
            ✕
          </div>
          <div>
            <h2 className="font-bold text-red-700 text-lg">Acesso Recusado</h2>
            <p className="text-sm text-gray-600 mt-1">{mensagemErro}</p>
          </div>
          <button
            onClick={tentarNovamente}
            className="w-full bg-[#1565c0] text-white font-semibold py-3 rounded-xl text-sm hover:bg-blue-800"
          >
            Ler Outro QR Code
          </button>
        </div>
      )}

      {/* ETAPA 4: ACEITO -> PEDIR PLACA/CHASSI */}
      {etapa === 'veiculo' && vagaConfirmada && (
        <form onSubmit={confirmarEstadia} className="bg-white rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
              ✓
            </div>
            <div>
              <p className="text-sm font-bold text-green-800">Check-in confirmado!</p>
              <p className="text-xs text-green-700">Vaga ocupada: <strong>{vagaConfirmada.codigo}</strong></p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">Tipo de Identificação</label>
            <select
              value={tipoIdentificacao}
              onChange={(e) => setTipoIdentificacao(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[#1565c0]"
            >
              <option value="PLACA">Placa do Veículo</option>
              <option value="CHASSI">Chassi</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">
              {tipoIdentificacao === 'PLACA' ? 'Digite a Placa' : 'Digite o Chassi'}
            </label>
            <input
              type="text"
              required
              value={identificadorVeiculo}
              onChange={(e) => setIdentificadorVeiculo(e.target.value)}
              placeholder={tipoIdentificacao === 'PLACA' ? 'Ex: ABC1D23' : 'Ex: 9BWZZZ377VT004251'}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm uppercase focus:outline-none focus:border-[#1565c0]"
            />
          </div>

          <button
            type="submit"
            disabled={salvandoEstadia}
            className="w-full bg-[#1565c0] text-white font-semibold py-3.5 rounded-xl text-sm shadow hover:bg-blue-800 disabled:opacity-50"
          >
            {salvandoEstadia ? 'Iniciando estadia...' : 'Confirmar e Ir para Monitoramento'}
          </button>
        </form>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<CheckinApp />);