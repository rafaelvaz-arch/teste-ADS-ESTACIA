# Sprint 7 - Backend e Integrações PWA

## Contexto

Integração do módulo 'Encontre Meu Carro', implementação do gateway de pagamento digital in-app (Pix/Cartão) e regra de negócio da janela de tolerância de 20 minutos.


## Papéis

* **Módulo de Navegação PWA:** Letícia 

* **Integração de Pagamentos:** Kauan

* **Regras de Negócio e Backend:** Rafael e Kauan

## Cadência escolhida

Sprint com foco na finalização das principais integrações de backend e regras de negócio do PWA.

## Problema

Conectar o módulo de localização do veículo e implementar a lógica de cobrança in-app com controle estrito do tempo de tolerância pós-pagamento.

## Objetivo

Entregar a navegação do 'Encontre Meu Carro', pagamentos via Pix e Cartão (RF07) e a regra de saída dentro do limite de 20 minutos (RF08).

## Riscos

* Erros no cálculo do tempo de tolerância pós-pagamento gerando inconsistências no momento da saída do veículo.

## Backlog inicial

* **Issue #20:** `[Sprint 7] Módulo de navegação 'Encontre Meu Carro' no PWA (RF06) [pwa] [feature]` (Tag: `recurso`)

* **Issue #21:** `[Sprint 7] Integração de Pagamento Digital In-App via Pix e Cartão (RF07) [backend] [pagamentos]` (Tag: `backend`)

* **Issue #22:** `[Sprint 7] Lógica da janela de saída de 20 minutos pós-pagamento (RF08) [backend] [business-rules]` (Tags: `recurso`, `backend`)

* **Issue #36:** `[Sprint 7]: Lógica da janela de saída de 20 minutos pós-pagamento (RF08) [backend]` (Tags: `recurso`, `backend`)

## Acordos de trabalho

* Validação completa dos fluxos de pagamento e expiração da tolerância de 20 minutos antes de liberar a versão final no PWA.


## Acordos de trabalho
