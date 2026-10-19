# EstacIA

Sistema interativo de gestão de vagas em estacionamento e navegação indoor 3D desenvolvido para o **Shopping Cidade Jardim (Parque das Palmeiras)**. A aplicação conta com simulação de trajeto em tempo real via GPS 3D, suporte a múltiplos pavimentos com transição por rampa, acompanhamento de ocupação de setores e painel de monitoramento.

Repositório institucional de Projeto Integrador criado a partir do template do CEUB.

> **Professor(a):** Leia as AS DIRETRIZES INSTITUCIONAIS constantes no repositório [DIRETRIZES](https://github.com/CAMPUSCEUB/DIRETRIZES), em especial o [Guia dos Professores](https://github.com/CAMPUSCEUB/DIRETRIZES/guias/github-enterprise-campus-ceub.md) e o [checklist do GitHub Enterprise](https://github.com/CAMPUSCEUB/DIRETRIZES/guias/github-enterprise-campus-ceub.md).
>
> **Estudante:** Leia o [guia dos alunos](docs/guia-alunos.md).


## Identificação do repositório 

| Campo | Informação |
| --- | --- |
| Instituição | CEUB |
| Organização no GitHub | CampusCEUB |
| Professor(a) responsável pela criação: | Prof. Valdemir dos Santos Silva
| Equipe | Grupo 03
| IDProjeto | 03

## Problema

A busca por vagas em estacionamentos de shopping centers costuma gerar congestionamentos, perda de tempo e gargalos no momento do pagamento, resultando em uma experiência frustrante para os clientes em horários de pico. Existe a oportunidade de transformar esse cenário ao digitalizar o fluxo de veículos, atendendo à necessidade de otimizar a rotatividade do espaço e oferecer uma mobilidade interna mais ágil, simples e sem atritos.

## Solução proposta

O EstacIA é uma aplicação web e mobile responsiva e intuitiva que oferece navegação integrada para localização rápida de vagas livres, além de permitir check-in e pagamento simplificados direto pelo navegador. Voltado para motoristas frequentadores de shoppings e administradores de estacionamentos, o sistema entrega valor ao reduzir drasticamente o tempo gasto procurando vagas, eliminar filas físicas nos guichês e elevar o nível de satisfação e conveniência da jornada do consumidor.

## Estrutura deste repositório

| Item | Link |
| --- | --- |
| Protótipo | [Front-end](https://leticia8154.github.io/Front-end/) |
| Backlog | Vincular o GitHub Project |
| Sprints | [sprints/README.md](sprints/README.md) |
| Entregas | [entregas/README.md](entregas/README.md) |
| Requisitos | [docs/requisitos.md](entregas/DOCUMENTO_DE_REQUISITOS.md) |
| Arquitetura | [docs/arquitetura.md](entregas/DOCUMENTO_DE_ARQUITETURA.md) |

```text
ADS-ESTACIA/
├── .github/              # Templates de Issues, PRs e workflows do GitHub
│   └── ISSUE_TEMPLATE/   # Modelos padronizados para tarefas e bugs
├── assets/               # Imagens e plantas baixas 2D (Térreo e Subsolo SS1)
├── core/                 # Lógica base e utilitários do sistema
├── css/                  # Estilos globais e específicos (globals.css, navegacao.css)
├── database/             # Scripts de banco de dados e integrações (Supabase)
├── docs/                 # Documentação técnica e arquitetura do projeto
├── entregas/             # Relatórios de entregas acadêmicas do CEUB
├── js/                   # Componentes React/JSX (navegacao.jsx, setores.jsx, etc.)
├── routes/               # Gerenciamento de rotas e navegação da aplicação
├── sprints/              # Registros e retrospectivas de cada Sprint
├── index.html            # Tela inicial e seleção de opções
├── navegacao.html        # Interface de navegação indoor 3D com GPS simulado
├── setores.html          # Visualização de vagas e disponibilidade por setor
├── monitoramento.html    # Painel de controle e checkout de ticket
└── README.md             # Documentação principal do repositório

## Tecnologias Utilizadas

### Frontend & Renderização 3D
* **React 18 (UMD):** Biblioteca principal para construção da interface declarativa e reativa.
* **Three.js (r128):** Motor gráfico 3D para renderização de malhas, iluminação, mapas e animação do veículo.
* **OrbitControls:** Controles de câmera e navegação orbital na cena 3D.
* **Tailwind CSS:** Framework utilitário para estilização responsiva e moderna da UI.
* **Babel Standalone:** Transpilação em tempo de execução de JSX/JavaScript moderno direto no navegador.

### Backend & Infraestrutura
* **Supabase (PostgreSQL):** Gerenciamento de banco de dados relacional e controle de estados de ocupação de vagas.
* **HTML5 / JavaScript (ES6+):** Estrutura base da aplicação Web SPA.