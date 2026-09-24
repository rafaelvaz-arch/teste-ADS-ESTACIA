# DOCUMENTO DE ARQUITETURA DE SOFTWARE - ESTACIA

**Projeto:** EstacIA - Gerenciador Inteligente de Garagem para Shopping Center  
**Versão:** 1.3  
**Data:** 22/09/2026  
**Instituição:** CEUB - Centro Universitário de Brasília  
**Autores:** Larissa Vargas Moreira, Letícia Araújo da Silva Amparo, Rafael Machado Alves Vaz e Kauan Rodrigues  

---

## Histórico de Revisões

| Data | Versão | Descrição | Autor |
| :---: | :---: | :--- | :--- |
| 14/05/2026 | 1.0 | Elaboração inicial do documento de arquitetura. | Larissa Vargas Moreira |
| 03/06/2026 | 1.1 | Acréscimo do diagrama de pacotes e metodologia Scrumban. | Larissa Vargas Moreira |
| 17/09/2026 | 1.2 | Mudança na arquitetura de rotas (substituição da API do Google Maps pelo IPS) e definição dos modelos de IA. | Letícia Araújo da Silva Amparo |
| 22/09/2026 | 1.3 | Atualização dos entregáveis das Sprints e refinamento do diagrama de casos de uso. | Letícia Araújo da Silva Amparo |

---

## 1. Visão Geral da Arquitetura

O **EstacIA** adota o padrão arquitetural **MVC (Model-View-Controller)** integrado ao modelo Cliente-Servidor[cite: 1]. Esta estrutura garante a separação de responsabilidades e facilita a portabilidade da aplicação móvel PWA[cite: 1]:

* 📱 **Camada de Apresentação (View):** Interface móvel interativa (PWA / Mobile-First) renderizada em SVG/Canvas para navegação do condutor e leitura de QR Code.
* ⚙️ **Camada de Controle e Lógica de Negócio (Controller / Model):** Servidor Backend em Python/Django que centraliza regras de negócio, cálculo do tempo de tolerância de 20 minutos, tarifas, o motor de rotas indoor $A^*$ e o sistema preditivo.
* 🤖 **Camada de Inteligência Artificial e Ingestão IoT:** Módulo de processamento de telemetria dos sensores ultrassónicos e conversão de plantas baixas via visão computacional.
* 🗄️ **Camada de Dados (Persistence / Persistence Model):** Banco de dados relacional (PostgreSQL / Supabase) responsável pela persistência da malha topológica em grafos 3D e estados de ocupação.

---

## 2. Motor de Inteligência Artificial e Navegação Indoor (IPS)

Em substituição integral a APIs de mapas de terceiros (como Google Maps), o EstacIA utiliza um **Motor de IA Interno** baseado em 3 pilares:

1. 👁️ **Processamento de Planta Baixa (YOLOv8 + OpenCV):** Conversão automatizada de plantas arquitetónicas em grafos topológicos $G=(V,E)$, identificando corredores, vagas, escadas e elevadores.
2. 🗺️ **Algoritmo de Busca Heurística $A^*$ (A-Star):** Cálculo da menor rota indoor em grafos tridimensionais $(X, Y, Z)$, gerando transições multinível através de nós do tipo `ELEVADOR`, `ESCADA_ROLANTE` ou `RAMPA`.
3. 🎯 **Engine Preditiva de Vagas (XGBoost):** Análise da telemetria IoT e horários de pico para recomendar a vaga ideal mais próxima do destino do motorista no shopping.

---

## 3. Principais Metas e Restrições Arquiteturais

* ⚡ **Desempenho:** Processamento do QR Code e atualização de status no banco de dados em tempo inferior a 2 segundos.
* 🏬 **Navegação Indoor Autônoma:** Processamento interno de rotas via algoritmo $A^*$ em ambientes cobertos/subsolos sem GPS.
* 🔒 **Segurança e Privacidade:** Comunicação encriptada via HTTPS/TLS e conformidade com a LGPD.
* 📡 **Conectividade:** Dependência obrigatória de ligação à internet (4G/5G ou Wi-Fi) no dispositivo móvel do condutor.

---

## 4. Anexos e Documento Original

* 📄 Para consultar a especificação arquitetural completa em formato PDF, aceda a: [`DOCUMENTO_DE_ARQUITETURA.pdf`](./DOCUMENTO_DE_ARQUITETURA.pdf)
