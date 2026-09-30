# Documento de Requisitos

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
| 23/09/2026 | V2 | Inclusão formal da restrição de infraestrutura de sensores IoT e padronização MoSCoW. | Letícia Araújo | Equipe EstacIA |

---

# 1. Introdução

## 1.1 Objetivo do Documento

Este documento especifica os Requisitos de Software para o sistema EstacIA. O objetivo é fornecer uma visão detalhada, formal e estruturada de todas as funcionalidades, restrições e atributos de qualidade exigidos para o sistema, servindo como contrato técnico e guia direto para os desenvolvedores, testadores e demais partes interessadas do projeto no CEUB.

## 1.2 Escopo do Sistema

O EstacIA é uma aplicação móvel interativa (Mobile-First / PWA) focada na resolução dos gargalos operacionais e de mobilidade nos estacionamentos cobertos de shopping centers. A solução automatiza a jornada do condutor desde a localização preditiva de vagas livres até o registro autônomo por QR Code, cálculo de rota indoor por inteligência artificial ("Encontre Meu Carro") e liquidação financeira do tempo de permanência.

## 1.3 Definições, Acrônimos e Abreviações

* **PWA (Progressive Web App):** Aplicação web progressiva executada em dispositivos móveis sem necessidade de download via loja de aplicações.
* **Algoritmo A* (A-Star):** Algoritmo de busca heurística responsável por traçar a menor rota entre dois pontos em grafos topológicos.
* **XGBoost:** Algoritmo de aprendizado de máquina supervisionado para recomendação personalizada da vaga ideal.
* **IoT (Internet of Things):** Sensores ultrassónicos instalados nas vagas para deteção física de ocupação.
* **QR Code:** Código visual bidimensional fixado na vaga para vínculo único entre motorista, veículo e espaço físico.

---

# 2. Visão do Produto

O EstacIA é uma aplicação PWA voltada para auxiliar motoristas em estacionamentos de shopping centers, integrando sensores de ocupação, inteligência artificial e mapa interno para facilitar a localização e utilização das vagas. A solução busca tornar a experiência de estacionamento mais ágil, desde a escolha da vaga até o pagamento e a localização do veículo.

---

# 3. Público-alvo

O EstacIA é destinado principalmente a motoristas e visitantes de shopping centers que utilizam o estacionamento. A solução também pode beneficiar os responsáveis pela operação do estacionamento por meio do monitoramento da ocupação das vagas.

---

# 4. Problema

Motoristas de shopping centers podem enfrentar dificuldades para encontrar vagas disponíveis, localizar o veículo após a permanência e acompanhar o tempo e os custos do estacionamento. Além disso, a falta de monitoramento automatizado pode dificultar a identificação da ocupação das vagas.

---

# 5. Objetivos

## 5.1 Objetivo Principal

Desenvolver uma solução inteligente para facilitar a localização, utilização e gestão da vaga durante a permanência do motorista no estacionamento.

## 5.2 Objetivos Específicos

- Monitorar a disponibilidade das vagas por meio de sensores.
- Recomendar vagas utilizando inteligência artificial.
- Disponibilizar um mapa interno para auxiliar na navegação.
- Permitir o registro e localização do veículo.
- Facilitar o pagamento digital do estacionamento.
- Disponibilizar o histórico de estadias do usuário.

---

# 6. Descrição Geral do Sistema

## 6.1 Perspectiva do Produto

O EstacIA atua como uma plataforma móvel autónoma conectada a um servidor Backend em Python/Django e a um banco de dados relacional em nuvem. O sistema elimina a necessidade de intervenção humana ou guichês físicos, integrando hardware IoT de telemetria e inteligência artificial nativa para dispensar a dependência de serviços externos de navegação ou painéis manuais de gestão web.

## 6.2 Restrições do Produto ou do Projeto

* **Infraestrutura e Cobertura de Sensores IoT:** A precisão da contagem de vagas livres em tempo real e a eliminação de divergências dependem criticamente da presença, funcionamento contínuo e calibração dos sensores ultrassónicos nas vagas físicas, assegurando a deteção imediata de veículos cujos motoristas estacionam sem utilizar o PWA.
* **Conectividade Móvel do Utilizador:** Obrigatoriedade de acesso à internet (redes móveis 4G/5G ou Wi-Fi do centro comercial) no dispositivo do motorista.
* **Recursos do Dispositivo Móvel:** Necessidade de smartphone munido de câmara fotográfica funcional para leitura do QR Code.
* **Integração com Gateways Terceirizados:** Dependência da estabilidade das APIs financeiras (Pix e cartão de crédito) para o processamento de pagamentos e liberação da janela de tolerância de saída.

---

# 7. Requisitos do Sistema

Os critérios de priorização de requisitos adotados neste documento baseiam-se na adaptação da metodologia MoSCoW (DSDM Consortium), alinhada às diretrizes da IEEE Std 830/2009:

* **Essencial (Must Have):** Indispensáveis à execução do fluxo principal da jornada do motorista.
* **Importante (Should Have):** Agregam alto valor operacional, porém com dependência não impeditiva.
* **Desejável (Could Have):** Funcionalidades complementares para ganho de usabilidade.

## 7.1 Requisitos Funcionais

* **RF01 – Cadastrar e Autenticar Motorista:** O sistema deve permitir que o motorista crie uma conta e realize o login no PWA informando dados básicos (nome, e-mail e palavra-passe). **[Essencial]**

* **RF02 – Consultar Vagas em Tempo Real:** O sistema deve exibir no PWA o número e o percentual de vagas livres por andar e setor em tempo real. **[Essencial]**

* **RF03 – Recomendar Vaga Preditiva via IA:** O sistema deve utilizar a IA (XGBoost) para sugerir a vaga livre mais conveniente ao motorista com base no destino selecionado. **[Essencial]**

* **RF04 – Navegar por Rota Indoor (Algoritmo A*):** O sistema deve exibir a rota vetorial no mapa indoor até a vaga escolhida, suportando alteração multinível entre andares. **[Essencial]**

* **RF05 – Ler QR Code e Registrar Vaga:** O sistema deve permitir que o motorista escaneie o QR Code na vaga com a câmara para vincular o veículo e registrar a entrada. **[Essencial]**

* **RF06 – Localizar Veículo ("Encontre Meu Carro"):** O sistema deve traçar a rota a pé do ponto atual do motorista até a vaga onde o veículo está cadastrado. **[Importante]**

* **RF07 – Pagar Estacionamento:** O sistema deve permitir a quitação digital da tarifa do estacionamento no PWA por Pix e Cartão de Crédito. **[Essencial]**

* **RF08 – Gerenciar Tempo de Tolerância de Saída:** O sistema deve exibir o cronómetro de permanência no PWA e, após o pagamento, liberar o tempo de tolerância de 20 minutos para evacuação. **[Essencial]**

* **RF09 – Consultar Histórico de Estadias:** O sistema deve permitir que o motorista consulte suas estadias anteriores e visualize comprovantes de pagamento. **[Desejável]**

## 7.2 Requisitos Não Funcionais

* **RNF01 – Tempo de Resposta e Leitura:** O sistema deve processar a leitura do QR Code e gerar a rota no mapa em tempo inferior a 3 segundos. **[Essencial]**

* **RNF02 – Atualização em Tempo Real:** As informações de ocupação de vagas e pagamentos devem ser refletidas no PWA do motorista em tempo real. **[Essencial]**

* **RNF03 – Arquitetura Mobile-First (PWA):** A aplicação deve funcionar como Progressive Web App (PWA) em navegadores Android e iOS sem necessidade de instalação via loja. **[Essencial]**

* **RNF04 – Interface Intuitiva:** O aplicativo deve possuir interface simples com fluxo fluido para utilização do motorista dentro do veículo. **[Essencial]**

* **RNF05 – Proteção de Dados (LGPD):** O sistema deve criptografar dados pessoais e placas cadastradas, em conformidade com a LGPD (Lei nº 13.709/2018). **[Essencial]**

* **RNF06 – Transações Financeiras Seguras:** O módulo de pagamento integrado deve utilizar conexão criptografada (HTTPS/TLS) seguindo padrões de segurança bancária. **[Essencial]**

* **RNF07 – Disponibilidade do Serviço:** A aplicação móvel deve manter disponibilidade contínua de 99,5% durante o horário de funcionamento do centro comercial. **[Importante]**

---

# 8. Critérios de Aceitação

Os critérios de aceitação definem as condições que devem ser atendidas para que cada requisito seja considerado implementado e validado. A verificação e a validação dos requisitos são apresentadas no documento de testes do projeto.

Cada requisito deve ser avaliado de acordo com critérios observáveis e testáveis, permitindo verificar se a funcionalidade foi implementada conforme especificado e se atende às necessidades do usuário.

---

# 9. Dependências

O funcionamento do EstacIA depende da disponibilidade e do funcionamento dos sensores instalados nas vagas, da conexão com a internet utilizada pelo motorista, da infraestrutura do estacionamento e dos serviços de pagamento utilizados para processar as transações.

As principais dependências incluem:

- Sensores IoT instalados e calibrados nas vagas.
- Conectividade de internet no dispositivo do usuário.
- Infraestrutura física do estacionamento.
- Serviços de pagamento para processamento de Pix e cartão.
- Funcionamento do servidor e banco de dados.
- Disponibilidade dos serviços necessários para o funcionamento do PWA.

---

# 10. Riscos e Rastreabilidade para Issues

Os requisitos serão relacionados às respectivas issues no repositório, permitindo acompanhar sua implementação, revisão e entrega.

Entre os principais riscos estão a indisponibilidade ou falha dos sensores, problemas de conectividade, inconsistências na identificação das vagas, falhas nos serviços de pagamento e problemas relacionados ao funcionamento da inteligência artificial e da navegação indoor.

A rastreabilidade será mantida por meio da associação entre requisitos, issues, backlog, pull requests e evidências de entrega.

| Requisito | Issue | Risco relacionado | Evidência |
| :---: | :---: | :--- | :--- |
| RF01 | A definir | Falha no cadastro ou autenticação | Pull Request |
| RF02 | A definir | Dados incorretos de ocupação das vagas | Pull Request |
| RF03 | A definir | Recomendação inadequada de vaga | Pull Request |
| RF04 | A definir | Falha no cálculo da rota indoor | Pull Request |
| RF05 | A definir | Falha na leitura do QR Code | Pull Request |
| RF06 | A definir | Localização incorreta do veículo | Pull Request |
| RF07 | A definir | Falha no processamento do pagamento | Pull Request |
| RF08 | A definir | Falha no controle do tempo de tolerância | Pull Request |
| RF09 | A definir | Dados incompletos no histórico | Pull Request |
