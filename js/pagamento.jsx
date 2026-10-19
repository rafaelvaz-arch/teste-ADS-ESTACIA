function PagamentoApp() {
  const [method, setMethod] = React.useState('pix'); // 'pix' ou 'cartao'
  const [screen, setScreen] = React.useState('payment'); // 'payment' ou 'success'
  const [timeLeft, setTimeLeft] = React.useState(20 * 60); // 20 minutos em segundos

// Captura os parâmetros enviados na URL
const urlParams = new URLSearchParams(window.location.search);
const idUrl = urlParams.get('id') || urlParams.get('id_estadia') || 7;
const valorUrl = urlParams.get('valor') || 1.98;
const tempoUrl = urlParams.get('tempo') || '0h 14m';

// Dados da estadia atual 
const [idEstadia] = React.useState(Number(idUrl));
const [valorTotal] = React.useState(Number(valorUrl));
const [tempoPermanencia] = React.useState(tempoUrl);

  // Estados do Pix
  const [qrCodeBase64, setQrCodeBase64] = React.useState('');
  const [pixCopiaECola, setPixCopiaECola] = React.useState('');
  const [loadingPix, setLoadingPix] = React.useState(false);
  const [erroPix, setErroPix] = React.useState('');

  // Estados do Cartão
  const [cartaoDados, setCartaoDados] = React.useState({
    numero: '',
    validade: '',
    cvv: '',
    nome: ''
  });
  const [loadingCartao, setLoadingCartao] = React.useState(false);
  const [erroCartao, setErroCartao] = React.useState('');

  // 1. Gerar o QR Code Pix assim que o componente carrega
  React.useEffect(() => {
    const gerarPixAutomatico = async () => {
      setLoadingPix(true);
      setErroPix('');
      try {
        const response = await fetch('http://localhost:3000/api/v1/pagamentos/pix/gerar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_estadia: idEstadia,
            valor: valorTotal,
            email: 'cliente@estacia.com',
            nome: 'Cliente',
            apelido: 'Estacia',
            cpf: '05748832151'
          })
        });

        const data = await response.json();

        if (response.ok) {
          setQrCodeBase64(data.qr_code_base64 || '');
          setPixCopiaECola(data.qr_code || '');
        } else {
          setErroPix(data.error || 'Erro ao gerar o Pix.');
        }
      } catch (err) {
        console.error('Erro na requisição Pix:', err);
        setErroPix('Não foi possível ligar ao servidor.');
      } finally {
        setLoadingPix(false);
      }
    };

    gerarPixAutomatico();
  }, [idEstadia, valorTotal]);

  // Cronômetro regressivo ativado ao entrar na tela de sucesso
  React.useEffect(() => {
    if (screen !== 'success') return;

    const interval = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [screen]);

  // Função para formatar segundos em MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Copiar código Pix para a área de transferência
  const handleCopyPix = () => {
    if (!pixCopiaECola) {
      alert("O código PIX ainda está a ser gerado...");
      return;
    }
    navigator.clipboard.writeText(pixCopiaECola);
    alert("Código PIX copiado com sucesso!");
  };

  // Confirmar Pix e atualizar o Supabase antes de ir para a tela de Sucesso
  const handleConfirmPix = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/v1/pagamentos/confirmar-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_estadia: idEstadia,
          metodo_pagamento: 'PIX'
        })
      });

      if (response.ok) {
        setScreen('success');
      } else {
        alert('Erro ao atualizar estado no banco de dados.');
      }
    } catch (err) {
      console.error('Erro ao confirmar Pix:', err);
      alert('Erro ao ligar ao servidor.');
    }
  };

  // Processar pagamento com Cartão de Crédito
  const handleProcessCartao = async (e) => {
    e.preventDefault();
    setLoadingCartao(true);
    setErroCartao('');

    try {
      const response = await fetch('http://localhost:3000/api/v1/pagamentos/cartao/processar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_estadia: idEstadia,
          valor: valorTotal
        })
      });

      const data = await response.json();

      if (response.ok && data.status === 'approved') {
        setScreen('success');
      } else {
        setErroCartao(data.error || 'Pagamento recusado.');
      }
    } catch (err) {
      console.error('Erro ao processar cartão:', err);
      setErroCartao('Erro ao ligar ao servidor de pagamentos.');
    } finally {
      setLoadingCartao(false);
    }
  };

  const handleFinish = () => {
    window.location.href = "principal.html";
  };

  return (
    <div className="card-container">
      {screen === 'payment' ? (
        <div className="payment-wrapper">
          {/* Header */}
          <div className="header-navigation">
            <a href="checkin.html" className="btn-back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </a>
            <div className="header-titles">
              <h1 className="hero-title">Pagamento</h1>
              <p className="hero-subtitle">Finalize seu estacionamento</p>
            </div>
          </div>

          <div className="form-section">
            {/* Resumo */}
            <div className="summary-card">
              <div className="summary-row">
                <span className="summary-label">Tempo de permanência</span>
                <span className="summary-time">{tempoPermanencia}</span>
              </div>
              <div className="summary-row total-row">
                <span className="total-label">Total a pagar</span>
                <span className="total-price">R$ {valorTotal.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

            {/* Alternador de Abas */}
            <div className="tab-switcher">
              <button
                type="button"
                className={`tab-btn ${method === 'pix' ? 'active' : ''}`}
                onClick={() => setMethod('pix')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="7" y="2" width="10" height="20" rx="2" ry="2"></rect>
                  <line x1="12" y1="18" x2="12.01" y2="18"></line>
                </svg>
                PIX
              </button>
              <button
                type="button"
                className={`tab-btn ${method === 'cartao' ? 'active' : ''}`}
                onClick={() => setMethod('cartao')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                  <line x1="2" y1="10" x2="22" y2="10"></line>
                </svg>
                Cartão
              </button>
            </div>

            {/* Conteúdo PIX */}
            {method === 'pix' && (
              <div className="method-content">
                <div className="pix-card">
                  <div className="qr-code-placeholder" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {loadingPix ? (
                      <span style={{ color: '#fff', fontSize: '14px' }}>A gerar QR Code...</span>
                    ) : qrCodeBase64 ? (
                      <img
                        src={`data:image/png;base64,${qrCodeBase64}`}
                        alt="QR Code Pix"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '12px' }}
                      />
                    ) : (
                      <span style={{ color: '#ff6b6b', fontSize: '13px' }}>{erroPix || 'QR CODE PIX'}</span>
                    )}
                  </div>
                  <p className="pix-instructions">Escaneie o QR Code com seu app de pagamento</p>
                </div>

                <div className="input-group">
                  <label className="input-label">Ou use o código PIX</label>
                  <div className="copy-input-wrapper">
                    <input
                      type="text"
                      className="input-field readonly-field"
                      value={pixCopiaECola || "A gerar código PIX..."}
                      readOnly
                    />
                    <button type="button" className="btn-copy" onClick={handleCopyPix}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-submit btn-green"
                  onClick={handleConfirmPix}
                >
                  Confirmar Pagamento PIX
                </button>
              </div>
            )}

            {/* Conteúdo Cartão */}
            {method === 'cartao' && (
              <form onSubmit={handleProcessCartao} className="method-content">
                {erroCartao && <p style={{ color: 'red', fontSize: '13px', marginBottom: '8px' }}>{erroCartao}</p>}
                
                <div className="input-group">
                  <label className="input-label">Número do Cartão</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="0000 0000 0000 0000"
                    value={cartaoDados.numero}
                    onChange={(e) => setCartaoDados({ ...cartaoDados, numero: e.target.value })}
                    required
                  />
                </div>

                <div className="input-grid">
                  <div className="input-group">
                    <label className="input-label">Validade</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="MM/AA"
                      value={cartaoDados.validade}
                      onChange={(e) => setCartaoDados({ ...cartaoDados, validade: e.target.value })}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">CVV</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="123"
                      value={cartaoDados.cvv}
                      onChange={(e) => setCartaoDados({ ...cartaoDados, cvv: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Nome no Cartão</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="NOME COMPLETO"
                    value={cartaoDados.nome}
                    onChange={(e) => setCartaoDados({ ...cartaoDados, nome: e.target.value })}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn-submit btn-blue"
                  disabled={loadingCartao}
                >
                  {loadingCartao ? 'A processar...' : `Pagar R$ ${valorTotal.toFixed(2).replace('.', ',')}`}
                </button>
              </form>
            )}
          </div>

          {/* Rodapé de Segurança */}
          <div className="security-footer">
            <p className="security-text">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              Pagamento seguro e criptografado
            </p>
            <p className="time-notice">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              Você terá 20 minutos para sair após o pagamento
            </p>
          </div>
        </div>
      ) : (
        /* Tela de Sucesso */
        <div className="success-wrapper">
          <div className="success-card">
            <div className="success-checkmark">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>

            <h1 className="success-title">Pagamento Confirmado!</h1>
            <p className="success-subtitle">Você tem 20 minutos para sair do estacionamento</p>

            <div className="vaga-info-box">
              <span className="vaga-label">Sua Vaga</span>
              <h2 className="vaga-code">A-145</h2>
              <span className="vaga-location">Setor A • Norte</span>
            </div>

            <div className="timer-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>Tempo restante: <strong>{formatTime(timeLeft)}</strong></span>
            </div>

            <button type="button" className="btn-submit btn-blue" onClick={handleFinish}>
              Finalizar Sessão
            </button>
          </div>

          <p className="thank-you-text">Obrigado por usar o EstaciA! Dirija com segurança 🚗</p>
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<PagamentoApp />);