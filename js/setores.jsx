import React from 'react';
import './setores.css'; // Certifique-se de ter o arquivo CSS no mesmo diretório ou importar o módulo CSS

export default function Setores({ onBack, onSelectSetor }) {
  const setoresData = [
    { id: 'A', nome: 'Setor A - Norte', sub: 'Próx. Lojas Americanas', curto: 'Entrada Norte', vagas: '35/60', vagasNum: '35', ocupacao: '42%', status: 'green' },
    { id: 'B', nome: 'Setor B - Sul', sub: 'Próx. C&A e Riachuelo', curto: 'Entrada Sul', vagas: '08/60', vagasNum: '8', ocupacao: '87%', status: 'red' },
    { id: 'C', nome: 'Setor C - Leste', sub: 'Praça de Alimentação', curto: 'Praça Court', vagas: '22/60', vagasNum: '22', ocupacao: '63%', status: 'yellow' },
    { id: 'D', nome: 'Setor D - Oeste', sub: 'Área de Carga e Serviços', curto: 'Área Serviços', vagas: '05/60', vagasNum: '5', ocupacao: '92%', status: 'red' },
  ];

  const getBadgeClass = (status) => {
    switch (status) {
      case 'green': return 'badge-green';
      case 'yellow': return 'badge-yellow';
      case 'red': return 'badge-red';
      default: return 'badge-green';
    }
  };

  return (
    <main className="card-container">
      {/* Navegação e Cabeçalho */}
      <div className="header-nav">
        <button type="button" className="btn-back" title="Voltar" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div className="header-titles">
          <h1>Brasilia Shopping</h1>
          <p>Selecione um setor da planta</p>
        </div>
      </div>

      {/* Mapa Visual */}
      <div className="map-container">
        <div className="map-grid">
          {setoresData.map((setor) => (
            <button
              key={`map-${setor.id}`}
              type="button"
              className="map-card"
              onClick={() => onSelectSetor && onSelectSetor(setor.id)}
            >
              <span className="map-card-icon">🚗</span>
              <span className="map-card-title">Setor {setor.id}</span>
              <span className="map-card-sub">{setor.curto}</span>
              <span className={`badge ${getBadgeClass(setor.status)}`}>{setor.vagas} vagas</span>
            </button>
          ))}
        </div>

        {/* Legenda */}
        <div className="legend-box">
          <div className="legend-item"><span className="dot dot-green"></span> Alta (&gt;50%)</div>
          <div className="legend-item"><span className="dot dot-yellow"></span> Média (20-50%)</div>
          <div className="legend-item"><span className="dot dot-red"></span> Baixa (&lt;20%)</div>
        </div>
      </div>

      {/* Lista detalhada */}
      <p className="section-title">Todos os Setores (Térreo)</p>

      <div className="setores-list">
        {setoresData.map((setor) => (
          <button
            key={`list-${setor.id}`}
            type="button"
            className="setor-card"
            onClick={() => onSelectSetor && onSelectSetor(setor.id)}
          >
            <div className="setor-left">
              <div className="setor-avatar">{setor.id}</div>
              <div className="setor-info">
                <h4>{setor.nome}</h4>
                <p>{setor.sub}</p>
              </div>
            </div>
            <div className="setor-right">
              <span className={`badge ${getBadgeClass(setor.status)}`}>{setor.vagasNum} vagas</span>
              <span className="occupancy-text">{setor.ocupacao} ocupado</span>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}