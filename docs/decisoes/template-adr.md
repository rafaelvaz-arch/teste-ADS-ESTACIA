# ADR 001: Adoção de Navegação Indoor Própria (IPS via Algoritmo A*)

## Título

Substituição de APIs de Mapas Externos por Sistema de Posicionamento Indoor (IPS) Próprio e Remoção do Painel Administrativo Web.

## Status

Aprovado.

## Data

2026-09-22

## Contexto

Durante o desenvolvimento do EstacIA, identificou-se que o uso de APIs externas como o Google Maps não atende à navegação em subsolos e garagens cobertas de shopping centers devido ao bloqueio de sinal GPS. Além disso, a manutenção de um painel web administrativo gerava dispersão de escopo, sendo que a prioridade do negócio é a autonomia total do condutor na sua jornada.

## Decisão

Decidiu-se:
1. Implementar um **Motor de IA Indoor próprio** baseado em grafos 3D (X, Y, Z) e algoritmo de busca heurística **A*** para calcular rotas multinível.
2. Processar plantas baixas em PDF/imagem utilizando visão computacional (**YOLOv8 + OpenCV**) para extração automática do grafo de navegação.
3. Focar a entrega do produto **100% no Progressive Web App (PWA)** voltado para a Jornada do Motorista (consulta de vagas, check-in por QR Code, localização do veículo "Encontre Meu Carro" e pagamento digital).
   
## Alternativas consideradas

* **Uso da API do Google Maps / Apple Maps:** Descartada por falta de precisão em ambientes cobertos/subsolos e custos de escala.
* **Manutenção do Painel Web para Gestores:** Descartada para evitar expansão indevida de escopo (*scope creep*) e garantir que os recursos fossem direcionados para a experiência mobile do usuário final.
* **Sistemas de Beacons Bluetooth:** Descartados devido ao alto custo de instalação física e manutenção de hardware dedicado em todo o pátio de estacionamento.
  
## Consequências

* **Positivas:**
  * Autonomia total da navegação dentro de garagens sem dependência de sinal de GPS externo.
  * Eliminação de custos recorrentes com licenças de APIs de terceiros.
  * Foco e maior qualidade na interface do cliente final via PWA.
* **Trade-offs / Riscos:**
  * Necessidade de sensorização IoT ultrassônica nas vagas para evitar divergências na contagem quando os motoristas não utilizarem o aplicativo.
  * Maior complexidade técnica no backend para processamento e treino do algoritmo A* em grafos 3D.
    
## Links relacionados

* **Documento de Arquitetura de Software (v1.3):** [`DOCUMENTO_DE_ARQUITETURA.md`](./DOCUMENTO_DE_ARQUITETURA.md)
* **Especificação de Requisitos (v2.0):** [`DOCUMENTO_DE_REQUISITOS.md`](./DOCUMENTO_DE_REQUISITOS.md)
* **Declaração do Escopo (v1.4):** [`DECLARACAO_DE_ESCOPO.md`](./DECLARACAO_DE_ESCOPO.md)
