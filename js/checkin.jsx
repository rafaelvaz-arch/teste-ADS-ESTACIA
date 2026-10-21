const { useState, useEffect, useRef } = React;

// Helper para normalizar a placa (remove hífens, espaços e deixa maiúsculo)
const normalizarPlaca = (str) => str ? str.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';

function CheckinApp() {
  const [step, setStep] = useState("scan"); // "scan" | "form"
  const [idType, setIdType] = useState("placa"); // "placa" | "chassi"
  const [inputValue, setInputValue] = useState("ABC1234");
  const [vagaLida, setVagaLida] = useState("Setor A - Vaga 145");
  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement("canvas"));

  // Inicia a câmera nativa com suporte robusto para navegadores móveis
  useEffect(() => {
    let streamInstance = null;
    let animationFrameId = null;

    if (step === "scan") {
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      navigator.mediaDevices?.getUserMedia(constraints)
        .then((stream) => {
          streamInstance = stream;
          const video = videoRef.current;
          if (video) {
            video.srcObject = stream;
            video.setAttribute("playsinline", true); // Garante suporte total no Chrome/Safari mobile
            
            video.play().then(() => {
              // Inicia a leitura do QR Code apenas após o vídeo começar a rodar
              const scanQRCode = () => {
                if (video && video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
                  const canvas = canvasRef.current;
                  canvas.width = video.videoWidth;
                  canvas.height = video.videoHeight;
                  const ctx = canvas.getContext("2d");
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                  if (window.jsQR) {
                    const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
                      inversionAttempts: "dontInvert",
                    });

                    if (code && code.data) {
                      console.log("QR Code detectado:", code.data);
                      setVagaLida(code.data);
                      setStep("form");
                      return; // Interrompe o loop ao ler
                    }
                  }
                }
                animationFrameId = requestAnimationFrame(scanQRCode);
              };

              animationFrameId = requestAnimationFrame(scanQRCode);
            }).catch(err => console.warn("Erro ao iniciar reprodução do vídeo:", err));
          }
        })
        .catch((err) => {
          console.warn("Acesso à câmera indisponível:", err);
        });
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (streamInstance) {
        streamInstance.getTracks().forEach(track => track.stop());
      }
    };
  }, [step]);

  const handleFinishScan = () => {
    setStep("form");
  };

  const handleConfirmCheckin = async () => {
    const valorLimpo = idType === "placa" ? normalizarPlaca(inputValue) : inputValue.trim().toUpperCase();

    if (!valorLimpo) {
      alert("Por favor, informe um valor válido.");
      return;
    }

    const dadosCheckin = {
      plate: valorLimpo,
      vaga: vagaLida || "Setor A - Vaga 145",
      checkin_time: new Date().toISOString(),
      status: "Ativo"
    };

    localStorage.setItem('active_checkin', JSON.stringify(dadosCheckin));
    window.location.href = 'monitoramento.html';
  };

  const handleTypeChange = (type) => {
    setIdType(type);
    setInputValue(type === "placa" ? "ABC1234" : "9BWZZZ377VT004251");
  };

  return (
    <div className="w-full max-w-md sm:max-w-lg bg-[#e8f1fd] rounded-[32px] border border-slate-200/80 shadow-2xl p-4 sm:p-6 flex flex-col gap-4 text-slate-800 font-sans mx-auto">
      
      {/* Header */}
      <header className="flex items-center gap-3">
        <button
          onClick={() => (window.location.href = "navegacao.html")}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-700 shadow-sm border border-slate-200/60 hover:bg-slate-50 transition-colors"
        >
          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-slate-900 truncate">Check-in</h1>
          <p className="text-xs text-slate-500 truncate">Registre seu veículo</p>
        </div>
      </header>

      {/* ETAPA 1: ESCANEAR QR CODE */}
      {step === "scan" ? (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm text-center flex flex-col items-center">
            <h2 className="text-base font-extrabold text-slate-900">Check-in na Vaga</h2>
            <p className="text-xs text-slate-400 mt-1">Aponte a câmera para o QR Code da vaga</p>

            <div className="my-6 relative aspect-square w-full max-w-[220px] rounded-2xl bg-slate-950 overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-4 border-2 border-dashed border-white/40 rounded-xl pointer-events-none z-10" />
              {/* Linha animada do scanner */}
              <div className="absolute left-4 right-4 h-0.5 bg-blue-500 shadow-[0_0_12px_#3b82f6] animate-scan-line z-10" />
            </div>

            <button
              onClick={handleFinishScan}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-xs font-bold shadow-md transition-all"
            >
              Simular Leitura Concluída (Vaga 145)
            </button>
          </div>
        </div>
      ) : (

      /* ETAPA 2: REGISTRO DE PLACA / CHASSI */
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm text-center flex flex-col items-center">
            <h2 className="text-base font-extrabold text-slate-900">Check-in na Vaga</h2>
            <p className="text-xs text-slate-400 mt-1">QR Code lido com sucesso!</p>

            <div className="my-5 flex flex-col items-center">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Vaga identificada</span>
              <span className="text-xl font-black text-blue-600">{vagaLida}</span>
            </div>

            <button
              onClick={() => setStep("scan")}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-xs font-bold transition-all"
            >
              Escanear Novamente
            </button>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-slate-900 block mb-2">Tipo de Identificação</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => handleTypeChange("placa")}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    idType === "placa"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Placa
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange("chassi")}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    idType === "chassi"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Chassi
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-900 block mb-1">
                {idType === "placa" ? "Placa do Veículo" : "Número do Chassi"}
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={idType === "placa" ? "Ex: ABC1234" : "Informe o Chassi"}
                className="w-full bg-slate-100 border border-slate-200/80 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
            </div>

            <button
              onClick={handleConfirmCheckin}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-3 text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              Confirmar Check-in
            </button>
          </div>

        </div>
      )}

    </div>
  );
}

const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(rootElement);
root.render(<CheckinApp />);