#  Documentação do Banco de Dados — Projeto Estacia

Esta documentação descreve a modelagem relacional, funções automatizadas, views analíticas e diretrizes de infraestrutura do banco de dados do **Projeto Estacia**, construído sobre a plataforma **Supabase** utilizando **PostgreSQL**.

---

##  1. Utilização do Supabase na Arquitetura

O **Supabase** foi escolhido como plataforma de Backend-as-a-Service (BaaS) pela sua perfeita integração com o **PostgreSQL** e pelos seguintes recursos fundamentais para o projeto:

* **PostgreSQL Nativo**: Permite o uso de tipos de dados avançados (`TIMESTAMPTZ`, `NUMERIC`, `BIGSERIAL`), restrições (`CHECK`, `FOREIGN KEY`), índices e linguagem procedural (`PL/pgSQL`).
* **API RESTful Instantânea (PostgREST)**: O Supabase gera automaticamente endpoints REST seguros a partir das tabelas e views criadas no esquema `public`.
* **Capacidade de Realtime**: Suporte nativo ao envio de atualizações em tempo real via WebSockets, ideal para refletir a mudança de status de vagas na interface do usuário assim que um sensor IoT detecta um veículo.
* **Automações via Triggers**: Sincronização automática no nível do banco de dados entre a telemetria do hardware (sensores) e a disponibilidade das vagas no sistema.
* **Row Level Security (RLS)**: Controle granular de acesso aos dados, desabilitado temporariamente no ambiente de desenvolvimento para testes de frontend, mas pronto para produção.

---

##  2. Modelo de Dados Relacional (Esquema `public`)

###  2.1. `plantas_shopping`
Armazena a localização e os mapas visuais das plantas fisicas dos shoppings cadastrados.

| Coluna | Tipo | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id_planta` | `BIGSERIAL` | `PRIMARY KEY` | Identificador único da planta |
| `nome_shopping` | `VARCHAR(150)` | `NOT NULL` | Nome do estabelecimento |
| `nivel_piso` | `VARCHAR(50)` | `NOT NULL` | Nível/Andar (ex: P1, G2, Subsolo 1) |
| `cidade` | `VARCHAR(100)` | `NOT NULL`, `DEFAULT 'Brasília'` | Cidade da unidade |
| `uf` | `VARCHAR(2)` | `NOT NULL`, `DEFAULT 'DF'` | Sigla do Estado |
| `imagem_planta_url` | `TEXT` | — | URL da imagem do mapa vetorial/planta |
| `criado_em` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | Data de cadastro |

---

###  2.2. `setores`
Agrupa as vagas por zonas/setores dentro de cada piso do shopping.

| Coluna | Tipo | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id_setor` | `BIGSERIAL` | `PRIMARY KEY` | Identificador único do setor |
| `id_planta` | `BIGINT` | `NOT NULL`, `FK (plantas_shopping)` | Referência à planta pai (CASCADE) |
| `nome_setor` | `VARCHAR(50)` | `NOT NULL` | Nome do setor (ex: Setor A, Zona Azul) |
| `ponto_referencia` | `VARCHAR(150)` | — | Referência física (ex: 'Próximo à entrada da C&A') |
| `capacidade_total` | `INT` | `NOT NULL`, `CHECK (> 0)` | Capacidade máxima de veículos |
| `criado_em` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | Data de criação |

---

###  2.3. `vagas`
Mapeia cada vaga individual de estacionamento, seu estado atual e QR Code associado.

| Coluna | Tipo | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id_vaga` | `BIGSERIAL` | `PRIMARY KEY` | Identificador único da vaga |
| `id_setor` | `BIGINT` | `NOT NULL`, `FK (setores)` | Referência ao setor pai (CASCADE) |
| `codigo_vaga` | `VARCHAR(20)` | `NOT NULL`, `UNIQUE` | Código visível da vaga (ex: 'A-145') |
| `qr_code_hash` | `VARCHAR(255)` | `UNIQUE` | Hash contido no QR Code da vaga física |
| `status` | `VARCHAR(20)` | `NOT NULL`, `DEFAULT 'LIVRE'`, `CHECK` | Estado (`LIVRE`, `OCUPADA`, `RESERVADA`, `MANUTENCAO`) |
| `atualizado_em` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | Última modificação de status |

---

###  2.4. `sensores_vaga`
Tabela populada pela API de Hardware que integra os sensores IoT ao sistema.

| Coluna | Tipo | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id_sensor` | `BIGSERIAL` | `PRIMARY KEY` | Identificador interno do registro |
| `id_vaga` | `BIGINT` | `NOT NULL`, `UNIQUE`, `FK (vagas)` | Vaga física monitorada (1:1) |
| `codigo_hardware` | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` | MAC Address ou ID físico do dispositivo IoT |
| `status_deteccao` | `BOOLEAN` | `NOT NULL`, `DEFAULT FALSE` | Telemetria IoT (`TRUE` = Carro detectado) |
| `bateria_porcentagem` | `INT` | `CHECK (0 A 100)` | Nível atual da bateria do sensor |
| `ultima_leitura` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | Carimbo de data/hora do sinal do hardware |

---

###  2.5. `usuarios`
Cadastro dos clientes e condutores que utilizam a aplicação.

| Coluna | Tipo | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id_usuario` | `BIGSERIAL` | `PRIMARY KEY` | Identificador do usuário |
| `nome_completo` | `VARCHAR(150)` | `NOT NULL` | Nome completo do motorista |
| `email` | `VARCHAR(150)` | `NOT NULL`, `UNIQUE` | E-mail de login |
| `senha_hash` | `VARCHAR(255)` | `NOT NULL` | Hash da senha codificada |
| `criado_em` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | Data de registro |

---

###  2.6. `estadias`
Histórico de check-in, permanência do veículo e faturamento associado.

| Coluna | Tipo | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id_estadia` | `BIGSERIAL` | `PRIMARY KEY` | Identificador do ticket/estadia |
| `id_usuario` | `BIGINT` | `NOT NULL`, `FK (usuarios)` | Motorista associado |
| `id_vaga` | `BIGINT` | `NOT NULL`, `FK (vagas)` | Vaga ocupada durante o período |
| `tipo_identificacao` | `VARCHAR(10)` | `NOT NULL`, `CHECK` | Tipo de documento (`PLACA` ou `CHASSI`) |
| `identificador_veiculo` | `VARCHAR(20)` | `NOT NULL` | Valor da Placa ou Chassi do veículo |
| `data_hora_entrada` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Início do check-in |
| `data_hora_saida` | `TIMESTAMPTZ` | — | Término da estadia (checkout) |
| `taxa_por_hora` | `NUMERIC(10,2)` | `NOT NULL`, `DEFAULT 8.50` | Valor cobrado por hora de uso (R$) |
| `valor_total` | `NUMERIC(10,2)` | `DEFAULT 0.00` | Valor total consolidado |
| `status_pagamento` | `VARCHAR(20)` | `NOT NULL`, `DEFAULT 'PENDENTE'`, `CHECK` | Status financeiro (`PENDENTE`, `PAGO`, `CANCELADO`) |
| `criado_em` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | Registro do log |

---

##  3. Índices de Desempenho

Para otimizar consultas frequentes em cenários de alto tráfego e buscas em tempo real, foram definidos os seguintes índices:

* `idx_vagas_codigo`: Acelera a consulta de vagas pelo seu código impresso (ex: buscas no terminal de navegação ou via QR Code).
* `idx_vagas_status`: Agiliza a filtragem por status (`LIVRE`, `OCUPADA`), essencial para atualizar os mapas de navegação em tempo real.
* `idx_estadias_usuario`: Garante rápido carregamento do histórico de estadias no painel do usuário.

---

##  4. Automação via Triggers e Funções Procedurais

###  Função `fn_sincronizar_status_vaga_sensor()` e Trigger `trg_sincroniza_sensor_vaga`
Garante a sincronização em tempo real entre o sinal do hardware do sensor IoT (`sensores_vaga`) e a disponibilidade da vaga (`vagas`).

**Regra de Negócio:**
1. Quando `status_deteccao` do sensor muda para `TRUE`, a vaga correspondente é marcada como `'OCUPADA'`.
2. Quando `status_deteccao` muda para `FALSE`, a vaga é restaurada para `'LIVRE'` (apenas se seu status atual for `'OCUPADA'`, protegendo vagas em `'RESERVADA'` ou `'MANUTENCAO'`).

```sql
CREATE OR REPLACE FUNCTION fn_sincronizar_status_vaga_sensor()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status_deteccao = TRUE THEN
        UPDATE public.vagas 
        SET status = 'OCUPADA', atualizado_em = CURRENT_TIMESTAMP
        WHERE id_vaga = NEW.id_vaga;
    ELSE
        UPDATE public.vagas 
        SET status = 'LIVRE', atualizado_em = CURRENT_TIMESTAMP
        WHERE id_vaga = NEW.id_vaga AND status = 'OCUPADA';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_sincroniza_sensor_vaga
AFTER INSERT OR UPDATE OF status_deteccao ON public.sensores_vaga
FOR EACH ROW EXECUTE FUNCTION fn_sincronizar_status_vaga_sensor();