# DECLARAÇÃO DO ESCOPO DO PROJETO - ESTACIA

**Versão:** 1.4  
**Data:** 23/09/2026  
**Projeto:** EstacIA - Gerenciador Inteligente de Estacionamento para Shopping  
**Módulo:** Aplicação Móvel (PWA) - Jornada do Motorista  

---

## Controle de Versões

| Versão | Data | Autor | Notas da Revisão |
| :---: | :---: | :--- | :--- |
| 1.0 | 12/03/2026 | Larissa Vargas e Kauan Rodrigues | Criação inicial do documento. |
| 1.1 | 01/06/2026 | Larissa Vargas | Refinamento e alinhamento do escopo. |
| 1.2 | 05/06/2026 | Larissa Vargas | Ajustes na problematização e objetivos SMART. |
| 1.3 | 22/09/2026 | Letícia Araújo | Remoção de mapas externos (Google Maps), eliminação do painel web administrativo (foco 100% em App Móvel/PWA), e detalhamento do Motor de IA Indoor (YOLOv8, A* e XGBoost) e Sensores IoT. |
| 1.4 | 23/09/2026 | Letícia Araújo | Inclusão formal da restrição de infraestrutura de sensores IoT (prevenção de divergências) e atualização integral do Escopo do Produto. |

---

## 1. Objetivos Deste Documento

Este documento tem como objetivo descrever de forma clara, rigorosa e objetiva o escopo do projeto EstacIA, definindo os limites de atuação, entregas, premissas, restrições e critérios de aceitação. O escopo foi alinhado com o protótipo móvel e com a Arquitetura de Software v1.3, assegurando a transparência das entregas para a equipe de desenvolvimento e os stakeholders do projeto.

---

## 2. Situação Atual e Justificativa do Projeto

Estacionamentos em centros comerciais de grande porte enfrentam problemas recorrentes de tráfego interno, incluindo:
* Dificuldade e perda de tempo dos motoristas para encontrar vagas disponíveis em horários de pico.
* Desorientação no momento de retornar ao veículo ("onde parei meu carro?"), agravada pela ausência de sinal GPS em subsolos e estruturas cobertas.
* Gargalos operacionais e filas nos totens de pagamento físico.

O EstacIA justifica-se por oferecer uma solução totalmente autônoma e digital. Através de um aplicativo móvel (PWA) e do uso de Inteligência Artificial nativa para mapeamento indoor, o sistema guia o motorista até a vaga ideal e otimiza o registro por QR Code e pagamento via Pix/Cartão.

---

## 3. Objetivos SMART do Projeto

* **Específico (Specific):** Desenvolver uma aplicação móvel (PWA/Mobile-First) para direcionamento inteligente de vagas, registro de estadias e navegação indoor em shopping centers.
* **Mensurável (Measurable):** Reduzir em até 40% o tempo médio que o motorista leva para encontrar uma vaga e localizar seu veículo na saída.
* **Atingível (Achievable):** Construir a solução utilizando arquitetura resiliente em Python/Django, algoritmo de busca heurística A* em grafos e processamento de imagens/sensores IoT.
* **Relevante (Relevant):** Melhorar a experiência do cliente do shopping e eliminar congestionamentos internos nas garagens.
* **Temporal (Time-bound):** Entregar a versão final funcional e testada até o término da Sprint 8.

---

## 4. Escopo do Produto

O produto final do projeto será uma aplicação móvel interativa (Mobile-First / PWA) chamada EstacIA, voltada exclusivamente para otimizar a jornada do motorista em pátios cobertos de shopping centers. O escopo da solução abrange as seguintes entregas funcionais e técnicas:

* **Telemetria IoT e Monitoramento de Vagas:** Captura de dados físicos em tempo real através de rede de sensores ultrassônicos instalados nas vagas, assegurando a exatidão da contagem de vagas livres mesmo para motoristas que não utilizam a aplicação.
* **Recomendação Preditiva via IA:** Sugestão automatizada da vaga ideal e mais próxima do destino desejado pelo cliente (cinema, praça de alimentação), processada pelo modelo de Machine Learning XGBoost.
* **Navegação Indoor Vetorial (Algoritmo A*):** Cálculo e renderização de rota otimizada em mapas interativos 2D/3D no PWA, tratando a alteração de andares e transições multinível em ambientes sem GPS.
* **Check-in por QR Code:** Leitor de QR Code integrado para que o motorista escaneie o código na coluna/piso da vaga e vincule instantaneamente seu veículo no banco de dados.
* **Módulo "Encontre Meu Carro":** Traçado de rota pedonal no mapa do aplicativo a partir da localização atual do usuário até a vaga onde o veículo foi registrado.
* **Pagamento Digital Integrado:** Liquidação de tarifas de permanência diretamente pelo aplicativo móvel via Pix e Cartão de Crédito.
* **Gestão de Tolerância e Notificações:** Cronômetro de tempo de permanência no PWA com acionamento automático da janela gratuita de 20 minutos de tolerância pós-pagamento para evacuação do estacionamento.
* **Histórico de Estadias:** Consulta de permanências anteriores e emissão de comprovantes digitais na conta do usuário.

---

## 5. Exclusões do Projeto / Fora do Escopo

Ficam expressamente fora do escopo do projeto EstacIA as seguintes funcionalidades e componentes:
* ❌ **Painel Web ou Interface de Gestão Administrativa:** Não haverá dashboard ou painel de controle manual para os administradores do shopping; toda a contabilidade de vagas é gerida autonomamente pelo backend via sensores.
* ❌ **Integração com a API do Google Maps / Apple Maps:** Toda a navegação interna é processada pelo motor de IA e mapas vetoriais do próprio EstacIA, eliminando APIs de mapas de terceiros.
* ❌ **Fabricação ou Instalação Física de Hardware:** O projeto não contempla a montagem física dos sensores IoT ou fabricação de placas/adesivos com QR Code.
* ❌ **Controle de Cancela Física de Entrada/Saída:** O sistema foca no gerenciamento da vaga e navegação; a integração com automação de cancelas físicas não faz parte do escopo.

---

## 6. Restrições

* **Infraestrutura e Cobertura de Sensores IoT:** A precisão da contagem de vagas livres em tempo real e a eliminação de divergências dependem criticamente da presença, funcionamento contínuo e calibração dos sensores ultrassônicos nas vagas físicas, assegurando a detecção imediata de veículos cujos motoristas estacionam sem utilizar o PWA.
* **Conectividade Móvel do Usuário:** Obrigatoriedade de acesso à internet (redes móveis 4G/5G ou rede Wi-Fi do centro comercial) no dispositivo do motorista para sincronização em tempo real com o PWA.
* **Recursos do Dispositivo Móvel:** Necessidade de smartphone munido de câmera fotográfica funcional para realização do escaneamento do QR Code da vaga.
* **Integração com Gateways Terceirizados:** Dependência da disponibilidade e estabilidade das APIs financeiras (Pix e cartão de crédito) para o processamento de pagamentos e consequente liberação da janela de tolerância de saída.

---

## 7. Premissas

* O shopping disponibilizará as plantas arquitetônicas dos estacionamentos em formato digital (PDF/PNG).
* O motorista possui smartphone com câmera funcional para realizar a leitura do QR Code na coluna da vaga.
* Os sensores IoT das vagas transmitirão dados de presença via protocolos padrão (MQTT/HTTP Webhooks).

---

## 8. Entregas e Critérios de Aceitação

### Principais Entregas:
1. Aplicativo móvel EstacIA funcional publicado e acessível aos usuários (PWA/Mobile).
2. Motor de IA Backend com Algoritmo A* e recomendador de vagas operacional.
3. Banco de dados relacional (PostgreSQL) configurado com suporte à malha de grafos e telemetria de vagas.
4. Documentação técnica completa (Arquitetura, Requisitos e Declaração de Escopo).

### Critérios de Aceitação:
* O motorista consegue consultar vagas livres e receber sugestão de vaga ideal no aplicativo.
* O escaneamento do QR Code vincula corretamente o veículo à vaga no banco de dados.
* O motor de IA calcula e exibe a rota indoor para o veículo ("Encontre Meu Carro") no mapa em tempo inferior a 2 segundos.
* O aplicativo alerta sobre o fim do tempo de tolerância de 20 minutos e processa pagamentos via Pix e Cartão de forma simulada/segura.
