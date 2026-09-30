# Arquitetura do EstacIA

## Contexto Técnico

O EstacIA é uma solução desenvolvida para auxiliar motoristas durante a utilização de estacionamentos de shopping centers. O sistema tem como foco facilitar a identificação de vagas disponíveis, a recomendação de uma vaga adequada, a navegação dentro do estacionamento, o registro do estacionamento, o pagamento e a localização posterior do veículo.

A utilização ocorre principalmente por meio de dispositivos móveis, através de uma aplicação PWA, permitindo que o motorista utilize as funcionalidades sem a necessidade de instalação por loja de aplicativos. O funcionamento depende de conexão com a internet, da infraestrutura física do estacionamento e dos sensores instalados nas vagas.

A solução utiliza um mapa interno baseado em coordenadas para representar os espaços do estacionamento e possibilitar a navegação entre diferentes níveis. O sistema também utiliza sensores de presença para identificar a ocupação das vagas e disponibilizar essas informações para consulta e recomendação.

A arquitetura foi planejada considerando os períodos de maior fluxo dos shopping centers, nos quais o sistema deverá processar múltiplos acessos e atualizações de disponibilidade das vagas de forma simultânea.


## Componentes

A arquitetura do EstacIA é organizada em componentes responsáveis pela apresentação das informações ao motorista, processamento das regras de negócio, inteligência artificial, comunicação com os sensores e armazenamento dos dados.

### Camada de Apresentação

Responsável pelas interfaces utilizadas pelo motorista no PWA, incluindo as telas de consulta de vagas, mapa interno, leitura de QR Code, pagamento, histórico e localização do veículo.

### Camada de Controle e Negócio

Responsável pelo recebimento e tratamento das requisições, aplicação das regras de negócio, cálculo do tempo de permanência, controle da tolerância, processamento das informações de estacionamento e comunicação com os demais componentes.

### Serviços de Inteligência Artificial

Responsáveis pelo processamento das informações utilizadas na recomendação de vagas. O modelo XGBoost utiliza informações como disponibilidade das vagas, horários de pico e destino selecionado para auxiliar na escolha da vaga.

### Motor de Navegação

Responsável pelo cálculo das rotas no estacionamento utilizando o algoritmo A*. O mapa interno é representado por um grafo com coordenadas e diferentes níveis, permitindo a definição de caminhos entre os pontos do estacionamento.

### Sensores IoT

Responsáveis por detectar a ocupação das vagas físicas e fornecer os dados utilizados para atualização da disponibilidade no sistema.

### Persistência

Responsável pelo armazenamento e recuperação dos dados relacionados aos usuários, veículos, vagas, estadias, pagamentos e informações utilizadas pelo sistema.


## Integrações

O EstacIA possui integrações entre seus principais componentes internos e com serviços necessários ao funcionamento da solução.

### Sensores IoT

Os sensores instalados nas vagas enviam informações relacionadas à ocupação dos espaços. Esses dados são recebidos pelo sistema e utilizados para atualizar a disponibilidade das vagas exibida ao motorista e para auxiliar o processo de recomendação.

### Serviço de Pagamento

O sistema possui integração com serviços responsáveis pelo processamento dos pagamentos realizados pelo motorista por meio de Pix ou cartão de crédito. Essa integração é necessária para permitir a quitação digital da tarifa.

### Banco de Dados

O backend realiza comunicação com o banco de dados para armazenar e consultar informações utilizadas pelo sistema, incluindo dados de usuários, vagas, veículos, estadias e pagamentos.

### Serviços de Inteligência Artificial

Os serviços de IA recebem dados relacionados à ocupação das vagas e às características da solicitação do motorista para realizar a recomendação de uma vaga adequada.

As integrações representam pontos de dependência da arquitetura, principalmente em relação à disponibilidade dos sensores, conectividade e serviços externos de pagamento.


## Dados

O EstacIA trabalha com dados necessários para o funcionamento da jornada do motorista e para o monitoramento das vagas. Entre os principais dados estão informações de usuários, veículos, vagas, sensores, coordenadas, registros de estacionamento, pagamentos e histórico de estadias.

Os dados de ocupação das vagas são obtidos por meio dos sensores instalados fisicamente no estacionamento. Essas informações são utilizadas para atualizar a disponibilidade das vagas e auxiliar a inteligência artificial na recomendação.

As informações relacionadas ao mapa são representadas por coordenadas utilizadas para identificar a posição das vagas e dos pontos de navegação. O modelo de navegação considera diferentes níveis do estacionamento para permitir a criação de rotas entre os andares.

Os registros de estacionamento permitem relacionar o usuário, o veículo e a vaga utilizada, enquanto os dados de pagamento e permanência são utilizados para o histórico do motorista.

Os dados pessoais e informações relacionadas aos veículos devem receber tratamento adequado de segurança e privacidade, conforme os requisitos definidos para o sistema.


## Decisões Técnicas

As decisões técnicas do EstacIA foram definidas considerando as funcionalidades necessárias, as características do ambiente de estacionamento e o escopo do projeto.

### PWA

A utilização de uma aplicação PWA permite que o motorista acesse o sistema por meio do navegador do smartphone, sem depender da instalação por lojas de aplicativos. Essa escolha está alinhada à necessidade de acesso rápido às funcionalidades durante a utilização do estacionamento.

### Arquitetura MVC

O padrão MVC foi adotado para separar as responsabilidades da aplicação entre apresentação, controle e regras de negócio. Essa organização facilita a manutenção e a evolução dos componentes do sistema.

### Sensores de presença

Os sensores foram incorporados à solução para realizar o monitoramento automático da ocupação das vagas. Dessa forma, a disponibilidade apresentada pelo sistema pode ser baseada na situação física das vagas.

### Inteligência Artificial

O XGBoost foi definido para realizar a recomendação de vagas a partir dos dados disponíveis, considerando a ocupação das vagas e o destino selecionado pelo motorista.

### Algoritmo A*

O algoritmo A* foi definido para o cálculo das rotas no mapa interno. A representação do estacionamento utiliza coordenadas e níveis diferentes, permitindo que o algoritmo encontre caminhos entre os pontos disponíveis.

### Mapa interno

O projeto utiliza um mapa interno baseado em coordenadas em vez de depender de serviços externos de mapas. Essa abordagem permite representar especificamente a estrutura interna do estacionamento e suas vagas.


## Riscos

| Risco | Impacto | Estratégia de Mitigação |
| :--- | :--- | :--- |
| Falha ou indisponibilidade dos sensores | Informações incorretas sobre a ocupação das vagas | Realizar testes, calibração e monitoramento dos sensores |
| Perda de conectividade | Impossibilidade de atualizar ou consultar informações em tempo real | Prever tratamento de falhas de comunicação e atualização dos dados |
| Coordenadas incorretas | Geração de rotas ou localização do veículo incorretas | Validar as coordenadas e realizar testes do mapa interno |
| Falha na recomendação da IA | Sugestão de uma vaga inadequada | Realizar testes e refinamento do modelo |
| Falha no serviço de pagamento | Impossibilidade de concluir o pagamento | Utilizar integração segura e tratar erros de comunicação |
| Grande volume de acessos | Aumento do tempo de resposta do sistema | Otimizar consultas e infraestrutura do backend |
| Falha no banco de dados | Perda ou indisponibilidade das informações | Utilizar mecanismos de segurança, consistência e recuperação dos dados |

## Diagramas e Relação com ADRs

Os diagramas arquiteturais utilizados no projeto representam diferentes perspectivas do EstacIA e auxiliam na compreensão da estrutura e do funcionamento da solução.

Entre as representações utilizadas estão os diagramas relacionados aos componentes, pacotes, classes, implantação e fluxo da aplicação. A arquitetura também utiliza uma representação lógica para demonstrar a divisão entre apresentação, controle, regras de negócio, inteligência artificial e persistência.

Os diagramas relacionados ao mapa interno representam a estrutura de navegação do estacionamento, considerando coordenadas e diferentes níveis. A arquitetura também contempla a comunicação entre os sensores, o backend e o armazenamento das informações de ocupação.

As decisões arquiteturais consolidadas poderão ser registradas por meio de Architecture Decision Records (ADRs), permitindo documentar a decisão tomada, suas justificativas, alternativas consideradas e os componentes afetados.
