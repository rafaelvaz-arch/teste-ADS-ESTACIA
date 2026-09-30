# Requisitos

Este documento funciona como template genérico para registrar os requisitos de qualquer turma, independentemente da stack escolhida.

## Visão do produto

Descreva em um parágrafo o que será entregue, qual resultado de negócio ou acadêmico se espera e qual recorte do projeto está coberto neste repositório.

## Público-alvo

Liste quem usa, valida ou se beneficia da solução, incluindo usuários finais, professor, cliente externo ou equipe acadêmica, quando aplicável.

## Problema

Explique qual dor, lacuna de processo ou oportunidade justifica o projeto e como ela se manifesta hoje.

## Objetivos

- Defina objetivos claros e verificáveis.
- Diferencie o objetivo principal das metas de curto prazo por sprint ou `milestone`.

## Requisitos funcionais

Registre as capacidades esperadas da solução em itens claros, cada um com identificador, descrição e referência para a `issue` correspondente, quando criada.

## Requisitos não funcionais

Documente as expectativas de usabilidade, desempenho, segurança, acessibilidade, confiabilidade, conformidade e demais restrições relevantes ao contexto da turma.

## Critérios de aceitação

Cada requisito deve possuir critérios observáveis, testáveis e suficientes para orientar a `review`, a validação e o Definition of Done.

## Dependências

Liste as dependências de negócio, agenda, dados, aprovações, integrações, infraestrutura, pessoas ou serviços externos que possam impactar a entrega.

## Riscos e rastreabilidade para issues

Associe cada requisito relevante a uma ou mais `issues`, mantendo a relação entre objetivo, critério de aceitação, risco conhecido e evidência de entrega no backlog, no `pull request` e no relatório da sprint.


# DOCUMENTO DE ESPECIFICAÇÃO DE REQUISITOS DE SOFTWARE

**Projeto:** EstacIA - Gerenciador Inteligente de Garagem para Shopping Center  
**Versão:** V2 (1.5)  
**Data:** 23/09/2026  
**Instituição:** CEUB - Centro Universitário de Brasília  
**Curso:** Análise e Desenvolvimento de Sistemas / Projeto Integrador II

---

## Histórico de Revisões

| Data | Versão | Descrição | Autor | Revisor |
| :---: | :---: | :--- | :--- | :--- |
| 10/03/2026 | 1.0 | Criação inicial do documento de requisitos. | Rafael Machado | Equipe EstacIA |
| 11/03/2026 | 1.1 | Adição dos requisitos funcionais e não funcionais. | Rafael Machado | Equipe EstacIA |
| 12/03/2026 | 1.2 | Ajustes na problematização e objetivos SMART. | Rafael Machado | Equipe EstacIA |
| 05/06/2026 | 1.3 | Refinamento técnico e alinhamento com escopo inicial. | Rafael Machado | Equipe EstacIA |
| 22/09/2026 | 1.4 | Substituição de mapas externos pelo Motor de IA Indoor (YOLOv8 + A* + XGBoost) e foco no PWA. | Letícia Araújo | Equipe EstacIA |
| 23/09/2026 | V2 | Inclusão formal da restrição de infraestrutura de sensores IoT (prevenção de divergências) e padronização MoSCoW. | Letícia Araújo | Equipe EstacIA |

---

## 1. Introdução

### 1.1 Objetivo do Documento
Este documento especifica os Requisitos de Software para o sistema EstacIA. O objetivo é fornecer uma visão detalhada, formal e estruturada de todas as funcionalidades, restrições e atributos de qualidade exigidos para o sistema, servindo como contrato técnico e guia direto para os desenvolvedores, testadores e demais partes interessadas do projeto no CEUB.

### 1.2 Escopo do Sistema
O EstacIA é uma aplicação móvel interativa (Mobile-First / PWA) focada na resolução dos gargalos operacionais e de mobilidade nos estacionamentos cobertos de shopping centers. A solução automatiza a jornada do condutor desde a localização preditiva de vagas livres até o registro autônomo por QR Code, cálculo de rota indoor por inteligência artificial ("Encontre Meu Carro") e liquidação financeira do tempo de permanência.

### 1.3 Definições, Acrônimos e Abreviações
* **PWA (Progressive Web App):** Aplicação web progressiva executada em dispositivos móveis sem necessidade de download via loja de aplicações.
* **Algoritmo A* (A-Star):** Algoritmo de busca heurística responsável por traçar a menor rota entre dois pontos em grafos topológicos.
* **XGBoost:** Algoritmo de aprendizado de máquina supervisionado para recomendação personalizada da vaga ideal.
* **IoT (Internet of Things):** Sensores ultrassónicos instalados nas vagas para deteção física de ocupação.
* **QR Code:** Código visual bidimensional fixado na vaga para vínculo único entre motorista, veículo e espaço físico.

---

## 2. Descrição Geral do Sistema

### 2.1 Perspectiva do Produto
O EstacIA atua como uma plataforma móvel autónoma conectada a um servidor Backend em Python/Django e a um banco de dados relacional em nuvem. O sistema elimina a necessidade de intervenção humana ou guichês físicos, integrando hardware IoT de telemetria e inteligência artificial nativa para dispensar a dependência de serviços externos de navegação ou painéis manuais de gestão web.

### 2.2 Restrições do Produto ou do Projeto
* **Infraestrutura e Cobertura de Sensores IoT:** A precisão da contagem de vagas livres em tempo real e a eliminação de divergências dependem criticamente da presença, funcionamento contínuo e calibração dos sensores ultrassónicos nas vagas físicas, assegurando a deteção imediata de veículos cujos motoristas estacionam sem utilizar o PWA.
* **Conectividade Móvel do Utilizador:** Obrigatoriedade de acesso à internet (redes móveis 4G/5G ou Wi-Fi do centro comercial) no dispositivo do motorista.
* **Recursos do Dispositivo Móvel:** Necessidade de smartphone munido de câmara fotográfica funcional para leitura do QR Code.
* **Integração com Gateways Terceirizados:** Dependência da estabilidade das APIs financeiras (Pix e cartão de crédito) para o processamento de pagamentos e liberação da janela de tolerância de saída.

---

## 3. Requisitos do Sistema

Os critérios de priorização de requisitos adotados neste documento baseiam-se na adaptação da metodologia MoSCoW (DSDM Consortium), alinhada às diretrizes da IEEE Std 830/2009:
* **Essencial (Must Have):** Indispensáveis à execução do fluxo principal da jornada do motorista.
* **Importante (Should Have):** Agregam alto valor operacional, porém com dependência não impeditiva.
* **Desejável (Could Have):** Funcionalidades complementares para ganho de usabilidade.

### 3.1 Requisitos Funcionais (RF)

* **RF01 – Cadastrar e Autenticar Motorista:** O sistema deve permitir que o motorista crie uma conta e realize o login no PWA informando dados básicos (nome, e-mail e palavra-passe). **[Essencial]**
* **RF02 – Consultar Vagas em Tempo Real:** O sistema deve exibir no PWA o número e o percentual de vagas livres por andar e setor em tempo real. **[Essencial]**
* **RF03 – Recomendar Vaga Preditiva via IA:** O sistema deve utilizar a IA (XGBoost) para sugerir a vaga livre mais conveniente ao motorista com base no destino selecionado. **[Essencial]**
* **RF04 – Navegar por Rota Indoor (Algoritmo A*):** O sistema deve exibir a rota vetorial no mapa indoor até a vaga escolhida, suportando alteração multinível entre andares. **[Essencial]**
* **RF05 – Ler QR Code e Registrar Vaga:** O sistema deve permitir que o motorista escaneie o QR Code na vaga com a câmara para vincular o veículo e registrar a entrada. **[Essencial]**
* **RF06 – Localizar Veículo ("Encontre Meu Carro"):** O sistema deve traçar a rota a pé do ponto atual do motorista até a vaga onde o veículo está cadastrado. **[Importante]**
* **RF07 – Pagar Estacionamento:** O sistema deve permitir a quitação digital da tarifa do estacionamento no PWA por Pix e Cartão de Crédito. **[Essencial]**
* **RF08 – Gerenciar Tempo de Tolerância de Saída:** O sistema deve exibir o cronómetro de permanência no PWA e, após o pagamento, liberar o tempo de tolerância de 20 minutos para evacuação. **[Essencial]**
* **RF09 – Consultar Histórico de Estadias:** O sistema deve permitir que o motorista consulte suas estadias anteriores e visualize comprovantes de pagamento. **[Desejável]**

### 3.2 Requisitos Não Funcionais (RNF)

* **RNF01 – Tempo de Resposta e Leitura:** O sistema deve processar a leitura do QR Code e gerar a rota no mapa em tempo inferior a 3 segundos. **[Essencial]**
* **RNF02 – Atualização em Tempo Real:** As informações de ocupação de vagas e pagamentos devem ser refletidas no PWA do motorista em tempo real. **[Essencial]**
* **RNF03 – Arquitetura Mobile-First (PWA):** A aplicação deve funcionar como Progressive Web App (PWA) em navegadores Android e iOS sem necessidade de instalação via loja. **[Essencial]**
* **RNF04 – Interface Intuitiva:** O aplicativo deve possuir interface simples com fluxo fluido para utilização do motorista dentro do veículo. **[Essencial]**
* **RNF05 – Proteção de Dados (LGPD):** O sistema deve criptografar dados pessoais e placas cadastradas, em conformidade com a LGPD (Lei nº 13.709/2018). **[Essencial]**
* **RNF06 – Transações Financeiras Seguras:** O módulo de pagamento integrado deve utilizar conexão criptografada (HTTPS/TLS) seguindo padrões de segurança bancária. **[Essencial]**
* **RNF07 – Disponibilidade do Serviço:** A aplicação móvel deve manter disponibilidade contínua de 99,5% durante o horário de funcionamento do centro comercial. **[Importante]**

