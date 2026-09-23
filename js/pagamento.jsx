function PagamentoApp() {
  const [method, setMethod] = React.useState('pix'); // 'pix' ou 'cartao'
  const [screen, setScreen] = React.useState('payment'); // 'payment' ou 'success'
  const [timeLeft, setTimeLeft] = React.useState(20 * 60); // 20 minutos em segundos (1200)

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

  const handleCopyPix = () => {
    const code = "PIX0000000000000000000000000000";
    navigator.clipboard.writeText(code);
    alert("Código PIX copiado com sucesso!");
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
                <span className="summary-time">0h 14m</span>
              </div>
              <div className="summary-row total-row">
                <span className="total-label">Total a pagar</span>
                <span className="total-price">R$ 1,98</span>
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
                  <div className="qr-code-placeholder">
                    <span>QR CODE PIX</span>
                  </div>
                  <p className="pix-instructions">Escaneie o QR Code com seu app de pagamento</p>
                </div>

                <div className="input-group">
                  <label className="input-label">Ou use o código PIX</label>
                  <div className="copy-input-wrapper">
                    <input
                      type="text"
                      className="input-field readonly-field"
                      value="PIX0000000000000000000000000000"
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
                  onClick={() => setScreen('success')}
                >
                  Confirmar Pagamento PIX
                </button>
              </div>
            )}

            {/* Conteúdo Cartão */}
            {method === 'cartao' && (
              <div className="method-content">
                <div className="input-group">
                  <label className="input-label">Número do Cartão</label>
                  <input type="text" className="input-field" placeholder="0000 0000 0000 0000" />
                </div>

                <div className="input-grid">
                  <div className="input-group">
                    <label className="input-label">Validade</label>
                    <input type="text" className="input-field" placeholder="MM/AA" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">CVV</label>
                    <input type="text" className="input-field" placeholder="123" />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Nome no Cartão</label>
                  <input type="text" className="input-field" placeholder="NOME COMPLETO" />
                </div>

                <button
                  type="button"
                  className="btn-submit btn-blue"
                  onClick={() => setScreen('success')}
                >
                  Pagar R$ 1,98
                </button>
              </div>
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