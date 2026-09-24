# Template de entrega

## Identificação | Projeto - EstacIA

**Instituição:** CEUB - Centro Universitário de Brasília  
**Curso:** Análise e Desenvolvimento de Sistemas / Projeto Integrador II  
**Projeto:** EstacIA - Gerenciador Inteligente de Estacionamento para Shopping  
**Módulo:** Aplicação Móvel (PWA) - Jornada do Motorista  
**Data de Emissão:** 23/09/2026

---

## 👥 Integrantes da Equipe

| Nome do Aluno | Função / Papel no Projeto | GitHub / Contato |
| :--- | :--- | :--- |
| Letícia Araújo | Scrum Master & Gerente de Projeto | [@leticia](https://github.com/leticia8154) |
| Rafael Machado | Engenheiro de Requisitos & Modelagem | [@rafael](https://github.com/RafaelMachado101202) |
| Larissa Vargas | Desenvolvedora & Documentação | [@larissa](https://github.com/LarissaVargasm) |
| Kauan Rodrigues | Desenvolvedor & Validação de Negócio | [@kauan](https://github.com/kauanSKZ) |

---

## Resumo da Entrega (Sprint Atual)

Nesta entrega, o escopo da solução foi totalmente consolidado para focar **exclusivamente na Jornada do Motorista** via Progressive Web App (PWA). Foram eliminadas as dependências de mapas externos (Google Maps) em favor de um Motor de IA Indoor ($A^*$, YOLOv8 e XGBoost) e incluída a infraestrutura de sensores IoT ultrassônicos para prevenção de divergências no inventário de vagas.

### Principais Artefatos Atualizados:
1. **Declaração do Escopo do Projeto:** Detalhamento das entregas funcionais, premissas, restrições de IoT e exclusão do painel administrativo do shopping.
2. **Documento de Especificação de Requisitos:** Requisitos Funcionais e Não Funcionais priorizados via matriz MoSCoW e alinhados às regras da LGPD.
3. **Documento de Arquitetura de Software:** Detalhamento do padrão MVC, motor de IA indoor em grafos 3D, modelo relacional PostgreSQL/Supabase e diagrama de casos de uso.
4. **Relatório Projeto Integrador II:** Relatório do produto.

## Links principais

* **Repositório do Código-Fonte:** [GitHub - CAMPUSCEUB/ADS-ESTACIA](https://github.com/CAMPUSCEUB/ADS-ESTACIA)
* **Milestone da Sprint:** [Milestone - Requisitos e Arquitetura v2](https://github.com/CAMPUSCEUB/ADS-ESTACIA/milestones)
* **Issues Relacionadas:** [Quadro de Issues no GitHub](https://github.com/CAMPUSCEUB/ADS-ESTACIA/issues)
* **Pull Requests:** [PRs de Entrega Documental e Código](https://github.com/CAMPUSCEUB/ADS-ESTACIA/pulls)
* **Documentos Centrais da Entrega:**
  * 📄 [Declaração do Escopo do Projeto (v1.4)](./DECLARACAO_DE_ESCOPO.md)
  * 📋 [Documento de Especificação de Requisitos (v2.0)](./DOCUMENTO_DE_REQUISITOS.md)
  * 🏗️ [Documento de Arquitetura de Software (v1.3)](./DOCUMENTO_DE_ARQUITETURA.md)

## Critérios atendidos

* **Foco Exclusivo na Jornada do Motorista:** Demonstrado pela remoção total de dashboards administrativos e concentração do PWA na autonomia do condutor (check-in, rota e pagamento).
* **Navegação Indoor Sem GPS Externo:** Demonstrado pela implementação do Motor de IA com algoritmo de busca heurística A* em grafos 3D e renderização vetorial no PWA.
* **Garantia de Sincronismo de Vagas:** Demonstrado pela modelagem de ingestão IoT para capturar presenças de veículos cujos motoristas não utilizam o app.
* **Regras de Negócio e Faturamento:** Demonstrado pelo módulo de pagamento digital integrado com disparador de cronómetro de 20 minutos de tolerância para evacuação.

## Validação

* **Validação de Requisitos (IEEE 830/2009):** Realizada por Rafael Machado e aprovada pela equipa, garantindo priorização alinhada à matriz MoSCoW.
* **Validação Arquitetural (MVC / Grafos 3D):** Desenvolvida por Letícia Araújo, garantindo tempos de resposta inferiores a 2 segundos para o cálculo de rotas e leitura de QR Code.
* **Testes de Integração Backend / Ingestão IoT:** Simulado o envio de pacotes via protocolos padrão (MQTT/Webhooks) para alteração em tempo real do estado das vagas na base PostgreSQL/Supabase.
  
## Limitações

* **Dependência de Conectividade do Utilizador:** O PWA exige acesso ativo à internet (4G/5G ou Wi-Fi do shopping) para consultar a matriz de vagas e desenhar rotas.
* **Sensorização Física Obrigatória:** A prevenção de divergências no total de vagas requer que todos os nichos físicos possuam sensores ultrassónicos operacionais.
* **Hardware do Dispositivo:** A leitura de check-in depende do funcionamento adequado da câmara fotográfica do smartphone do condutor.
  
## Pendências conhecidas

* Ajustes finos nos limites de precisão da visão computacional (YOLOv8) para leitura de plantas baixas com layouts não convencionais.
* Integração final com ambiente de sandbox do gateway de pagamento para simulação de webhooks de retorno Pix em tempo real
  
## Próximos passos

1. Finalizar a integração completa entre os endpoints do backend Python/Django e os cartões visuais do PWA.
2. Executar os testes de carga e concorrência na API para simular acessos simultâneos em horários de pico.
3. Concluir a bateria de testes de usabilidade e responsividade no protótipo PWA publicado no GitHub Pages.
