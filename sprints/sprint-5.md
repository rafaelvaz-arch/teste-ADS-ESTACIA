
# Sprint 5 - Definição da IA, Rota e Implementação

## Contexto
Estruturação do motor de IA indoor para processamento dos gráficos 3D e algoritmo A*, configuração de cadastro e autenticação via Supabase, ingestão de telemetria dos sensores IoT em tempo real e ajustes de rotas do backend.


## Papéis
* **Engenharia de IA & Algoritmos:** Letícia
* **Autenticação e PWA:** Larissa
* **Banco de Dados & IoT:** rafaelvaz
* **Manutenção Backend:** Kauan

## Cadência escolhida
Sprint com checkpoints contínuos para integração de serviços de IA, backend e Supabase Realtime.

## Problema
Necessidade de traçar rotas indoor inteligentes utilizando o algoritmo A* em ambientes 3D, além de integrar o controle de vagas em tempo real via IoT com autenticação segura.

## Objetivo
Implementar o motor de rotação e cálculo de rota A*, autenticação de motoristas no Supabase, habilitar o Supabase Realtime para sensores IoT e corrigir o fluxo de redefinição de senha.

## Riscos
* Alta latência na atualização do status das vagas via Supabase Realtime.
* Complexidade de cálculo do algoritmo A* para mapas 3D em dispositivos móveis.

## Backlog inicial
* **Issue #15:** `[Sprint 5] Implementar motor de rotação indoor 3D e algoritmo A* [backend] [ia]` (Tags: `backend`, `IA`)
* **Issue #16:** `[Sprint 5] Configurar cadastro e autenticação de motoristas no Supabase (RF01) [auth] [pwa]` (Tag: `aprimoramento`)
* **Issue #17:** `[Sprint 5] Habilitar ingestão de telemetria IoT e Supabase Realtime para vagas [iot] [database]` (Tag: `aprimoramento`)
* **Issue #33:** `correção: ajuste a rotação do link de redefinição de senha em recuperar.js` (Tag: `backend`)

## Acordos de trabalho
* Integrações com Supabase e IoT devem ser validadas em tempo real antes de fechar as issues no repositório.



