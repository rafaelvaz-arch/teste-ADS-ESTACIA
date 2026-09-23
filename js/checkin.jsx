const { useState } = React;

function CheckinApp() {
  const [step, setStep] = useState("scan"); // "scan" | "form"
  const [idType, setIdType] = useState("placa"); // "placa" | "chassi"
  const [inputValue, setInputValue] = useState("ABC-1234");

  const handleFinishScan = () => {
    setStep("form");
  };

  const handleConfirmCheckin = () => {
    // Redireciona para a tela de monitoramento após confirmar
    window.location.href = "monitoramento.html";
  };

  const handleTypeChange = (type) => {
    setIdType(type);
    setInputValue(type === "placa" ? "ABC-1234" : "9BWZZZ377VT004251");
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
            <p className="text-xs text-slate-400 mt-1">Escaneie o QR Code da vaga e registre seu veículo</p>

            <div className="my-6 relative aspect-square w-full max-w-[220px] rounded-2xl bg-slate-950 overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
              <div className="absolute inset-4 border-2 border-dashed border-white/30 rounded-xl pointer-events-none" />
              <div className="absolute left-4 right-4 h-0.5 bg-blue-500 shadow-[0_0_12px_#3b82f6] animate-scan-line" />
              <svg className="w-20 h-20 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 3h6v6H3V3zm2 2v2h2V5H5zm8-2h6v6h-6V3zm2 2v2h2V5h-2zM3 13h6v6H3v-6zm2 2v2h2v-2H5zm13-2h1v2h-1v-2zm-3 0h2v1h-2v-1zm1 3h2v3h-2v-3zm2 1h1v2h-1v-2zm-3 1h1v1h-1v-1zm1 1h2v1h-2v-1zm-4-4h1v1h-1v-1zm0 2h1v2h-1v-2zm-2-2h1v1h-1v-1zm0 2h1v1h-1v-1z"/>
              </svg>
            </div>

            <button
              onClick={handleFinishScan}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-xs font-bold shadow-md transition-all"
            >
              Simular Leitura Concluída
            </button>
          </div>
        </div>
      ) : (

      /* ETAPA 2: REGISTRO DE PLACA / CHASSI */
        <div className="flex flex-col gap-4">
          
          {/* Card Superior com Confirmação da Vaga */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm text-center flex flex-col items-center">
            <h2 className="text-base font-extrabold text-slate-900">Check-in na Vaga</h2>
            <p className="text-xs text-slate-400 mt-1">Escaneie o QR Code da vaga e registre seu veículo</p>

            <div className="my-5 flex flex-col items-center">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Vaga escaneada</span>
              <span className="text-2xl font-black text-blue-600">A-145</span>
            </div>

            <button
              onClick={() => setStep("scan")}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-xs font-bold transition-all"
            >
              Escanear Novamente
            </button>
          </div>

          {/* Form de Identificação */}
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
                className="w-full bg-slate-100 border border-slate-200/80 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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