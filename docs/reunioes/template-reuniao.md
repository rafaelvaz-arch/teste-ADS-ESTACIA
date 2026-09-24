# Template de reunião

## Data

2026-09-23

## Participantes

* **Letícia Araújo:** Scrum Master & Gerente de Projeto
* **Rafael Machado:** Engenheiro de Requisitos & Modelagem
* **Larissa Vargas:** Desenvolvedora & Documentação
* **Kauan Rodrigues:** Desenvolvedor & Validação de Negócio
  
## Pauta

1. Alinhamento final da especificação do projeto para o repositório do CEUB.
2. Consolidação do escopo centrado a 100% na Jornada do Motorista (PWA).
3. Remoção definitiva de componentes legados (painel administrativo web do shopping e integração com Google Maps).
4. Formalização da restrição técnica de infraestrutura dos sensores IoT ultrassónicos para prevenção de divergências de inventário.
5. Validação da metodologia de priorização de requisitos (MoSCoW / IEEE Std 830).
   
## Decisões

* **Escopo Exclusivo PWA:** Confirmada a eliminação de qualquer dashboard ou painel web para gestores do shopping; o foco da entrega é inteiramente a experiência do condutor no PWA.
* **Rede de Sensores IoT:** Aprovada a inclusão da dependência de sensores ultrassónicos como restrição técnica crítica para garantir o saldo correto de vagas em tempo real (mesmo para quem não utiliza a aplicação).
* **Motores de IA:** Mantida a arquitetura baseada em XGBoost (recomendação preditiva de vagas), YOLOv8 (conversão de plantas em grafos) e Algoritmo A* (rotas indoor multinível).
* **Gestão de Tolerância:** Fixado o cronómetro de 20 minutos de tolerância gratuita pós-pagamento digital (Pix/Cartão).
* **Estandardização do Repositório:** Adoção da estrutura de pastas `entregas/` com `template-entrega.md` no GitHub do CEUB.
  
## Encaminhamentos

* **Rafael Machado:** Atualizar o ficheiro `DOCUMENTO_DE_REQUISITOS.md` com a Seção 2.4 (Restrição de IoT) e priorização MoSCoW.
* **Larissa Vargas:** Ajustar a `DECLARACAO_DE_ESCOPO.md` e validar o diagrama de casos de uso na Arquitetura v1.3.
* **Letícia Araújo:** Formatar o ficheiro `template-entrega.md` da Sprint no repositório GitHub com os links relativos e resumos de validação.
* **Kauan Rodrigues:** Revisar a coerência do fluxo visual do protótipo no Figma com a rota indoor A* e ecrã de tolerância.
  
## Impedimentos

* Necessidade de calibração precisa da visão computacional (YOLOv8) para leitura automatizada de plantas baixas com layouts arquitetónicos não convencionais.
* Dependência de ambiente de testes (sandbox) do gateway de pagamento para simulação completa dos webhooks de retorno de Pix e Cartão de Crédito.
  
## Links

* **Repositório do Projeto:** [GitHub - CAMPUSCEUB/ADS-ESTACIA](https://github.com/CAMPUSCEUB/ADS-ESTACIA)
* **Declaração de Escopo:** [`DECLARACAO_DE_ESCOPO.md`](./DECLARACAO_DE_ESCOPO.md)
* **Documento de Requisitos:** [`DOCUMENTO_DE_REQUISITOS.md`](./DOCUMENTO_DE_REQUISITOS.md)
* **Documento de Arquitetura:** [`DOCUMENTO_DE_ARQUITETURA.pdf`](./DOCUMENTO_DE_ARQUITETURA.pdf)
