
# Sprint 6 - Desenvolvimento e Treinamento da IA

## Contexto

Implementação dos algoritmos de visão computacional (YOLOv8 + OpenCV) para remoção de mapas a partir de plantas baixas e funcionalidade de check-in de vaga por QR Code.

## Papéis

* **Engenharia de IA / Visão Computacional:** Letícia

* **Desenvolvimento Frontend / Mobile & QR Code:** Larissa

## Cadência escolhida

Sprint focada em inteligência artificial, visão computacional e integração de recursos móbiles.

## Problema

Conversão de plantas baixas brutas em grafos para roteamento indoor e leitura de QR Code em ambiente móvel com permissões de câmera via HTTPS.

## Objetivo

Implementar o algoritmo de conversão de plantas em grafos via YOLOv8 + OpenCV e integrar a leitura de QR Code para check-in de vagas no PWA.

## Riscos

* Dificuldade no reconhecimento preciso de paredes/estruturas de plantas baixas para conversão em grafos.

* Bloqueio de câmera no navegador por falta de contexto seguro (HTTPS/SSL).

## Backlog inicial

* **Issue #18:** `[Sprint 6] Algoritmo de visão computacional (YOLOv8 + OpenCV) para conversão de plantas em grafos [ia] [computer-vision]` (Tag: `IA`)

* **Issue #19:** `[Sprint 6] Leitura de QR Code e Check-in da vaga no PWA (RF05) [pwa] [recurso]` (Tag: `recurso`)

## Acordos de trabalho

* O leitor de QR Code deve ser testado e validado em dispositivo móvel físico utilizando túnel seguro HTTPS (Ngrok).



* *Code freeze* e mesclagem de PRs finais para garantir a estabilidade do sistema na entrega oficial do projeto.
