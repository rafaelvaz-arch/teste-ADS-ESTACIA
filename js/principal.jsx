import React, { useState } from 'react';

export function TelaPrincipal() {
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [shoppingSelecionado, setShoppingSelecionado] = useState('Brasilia Shopping');

  const shoppings = [
    'Shopping Center - Bloco A',
    'Shopping Center - Bloco B',
    'Shopping Norte',
    'Shopping Sul',
    'Mega Center'
  ];

  return (
    <main className="container" data-model-id="60:771">
      
      {/* Botão Sair / Voltar */}
      <a href="index.html" className="button" aria-label="Sair e voltar para o login">
        <img src="https://c.animaapp.com/YpraINo5/img/button.svg" alt="Sair" />
      </a>

      {/* Saudação do Usuário */}
      <section className="div" aria-labelledby="saudacao-titulo">
        <header className="container-wrapper">
          <div className="div-2">
            <div className="heading">
              <h1 className="text-wrapper" id="saudacao-titulo">Olá, Letícia! 👋</h1>
            </div>
            <div className="paragraph">
              <p className="text-wrapper-2">silvaleticia0008@gmail.com</p>
            </div>
          </div>
        </header>

        {/* Dropdown de Seleção de Shopping */}
        <section className="div-3" aria-labelledby="shopping-atual-label">
          <div className="label">
            <p className="text-wrapper-3" id="shopping-atual-label">Shopping Atual</p>
          </div>
          
          <div className="dropdown-wrapper">
            <button 
              className="button-2" 
              type="button" 
              aria-label="Selecionar shopping atual"
              onClick={() => setDropdownAberto(!dropdownAberto)}
            >
              <div className="div-4">
                <img className="icon" src="https://c.animaapp.com/YpraINo5/img/icon.svg" alt="" />
                <div className="text">
                  <span className="text-wrapper-4">{shoppingSelecionado}</span>
                </div>
              </div>
              <img className="img" src="https://c.animaapp.com/YpraINo5/img/icon-1.svg" alt="" />
            </button>

            {/* Menu Suspenso (Renderiza dinamicamente no React) */}
            {dropdownAberto && (
              <div className="dropdown-content" style={{ display: 'block' }}>
                {shoppings.map((shopping, index) => (
                  <a 
                    key={index}
                    href="#" 
                    className={`dropdown-item ${shopping === shoppingSelecionado ? 'active' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setShoppingSelecionado(shopping);
                      setDropdownAberto(false);
                    }}
                  >
                    <img className="icon" src="https://c.animaapp.com/YpraINo5/img/icon.svg" alt="" />
                    {shopping}
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Cards de Resumo de Uso */}
        <section className="div-5" aria-label="Resumo de uso">
          <article className="div-6" aria-label="Usos">
            <img className="icon-2" src="https://c.animaapp.com/YpraINo5/img/icon-2.svg" alt="" />
            <div className="div-wrapper">
              <p className="text-wrapper-5">12</p>
            </div>
            <div className="paragraph-2">
              <p className="text-wrapper-6">Usos</p>
            </div>
          </article>

          <article className="div-7" aria-label="Tempo total">
            <img className="icon-3" src="https://c.animaapp.com/YpraINo5/img/icon-3.svg" alt="" />
            <div className="paragraph-3">
              <p className="text-wrapper-7">24h</p>
            </div>
            <div className="paragraph-4">
              <p className="text-wrapper-6">Total</p>
            </div>
          </article>

          <article className="div-8" aria-label="Gasto total">
            <img className="icon-4" src="https://c.animaapp.com/YpraINo5/img/icon-4.svg" alt="" />
            <div className="paragraph-5">
              <p className="text-wrapper-7">R$ 180</p>
            </div>
            <div className="paragraph-6">
              <p className="text-wrapper-6">Gasto</p>
            </div>
          </article>
        </section>

        {/* Botão Buscar Vaga */}
        <button className="button-3" type="button" aria-label="Buscar vaga disponível">
          <img className="icon-5" src="https://c.animaapp.com/YpraINo5/img/icon-5.svg" alt="" />
          <span className="text-wrapper-8">Buscar Vaga Disponível</span>
        </button>
      </section>

      {/* Seção de Estacionamentos Recentes */}
      <section className="div-10" aria-labelledby="recentes-titulo">
        <div className="heading-3">
          <h2 className="text-wrapper-13" id="recentes-titulo">Estacionamentos Recentes</h2>
        </div>

        <div className="div-11">
          <article className="div-12" aria-label="Estacionamento recente Setor A2 Vaga 145">
            <div className="div-13">
              <img className="img-2" src="https://c.animaapp.com/YpraINo5/img/icon.svg" alt="" />
              <div className="div-14">
                <div className="paragraph-8">
                  <p className="p">Setor A2 - Vaga 145</p>
                </div>
                <p className="text-wrapper-14">05/04/2026 • 3h 20min</p>
              </div>
            </div>
            <div className="paragraph-10">
              <p className="text-wrapper-15">R$ 18,00</p>
            </div>
          </article>

          <article className="div-12" aria-label="Estacionamento recente Setor B1 Vaga 089">
            <div className="div-15">
              <img className="img-2" src="https://c.animaapp.com/YpraINo5/img/icon.svg" alt="" />
              <div className="paragraph-wrapper">
                <div className="paragraph-11">
                  <p className="text-wrapper-16">Setor B1 - Vaga 089</p>
                </div>
                <p className="text-wrapper-17">02/04/2026 • 1h 45min</p>
              </div>
            </div>
            <p className="text-wrapper-18">R$ 12,00</p>
          </article>
        </div>
      </section>

    </main>
  );
}