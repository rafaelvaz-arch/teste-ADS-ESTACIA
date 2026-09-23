##  Arquitetura do Banco de Dados (Supabase / PostgreSQL)

O projeto utiliza o Supabase como BaaS (Backend as a Service) rodando sobre um banco de dados relacional PostgreSQL.

###  Estrutura de Tabelas
- `perfis`: Dados cadastrais estendidos dos usuários (vinculado ao `auth.users`).
- `shoppings` & `plantas_shopping`: Mapeamento físico dos estabelecimentos e setores.
- `vagas` & `sensores_vaga`: Estado de ocupação das vagas e telemetria de sensores IoT.
- `veiculos`: Registro de placas e chassis associados aos condutores.
- `sessoes_estacionamento`: Registro do tempo de estadia, horário de entrada/saída e valores acumulados.
- `pagamentos`: Histórico financeiro e conciliação por PIX ou Cartão.

###  Views Contábeis
- `vw_contabilidade_faturamento_diario`: Faturamento consolidado por dia e meio de pagamento.
- `vw_contabilidade_fechamento_mensal`: DRE simplificado e métricas de sessões mensais.
- `vw_contabilidade_receita_por_setor`: Rentabilidade por setor do estacionamento.

###  Como Rodar o Banco de Dados
1. Crie um projeto no [Supabase](https://supabase.com).
2. Abra o **SQL Editor** no painel do Supabase.
3. Execute o script `database/schema_completo.sql` contido neste repositório.
4. Ative o **Supabase Realtime** para as tabelas `vagas` e `sensores_vaga`.