# Testes

Este documento apresenta as etapas de verificação e validação do sistema EstacIA, utilizadas para avaliar o atendimento aos requisitos e o funcionamento das principais funcionalidades do sistema.


## Tabela de Validação

| **Cenário de Uso** | **Como será validado**|
| :---: | :---: |
| Cadastro e login| Usuário testa criar conta e acessar o sistema |
| Consulta e recomendação da vaga | Usuário consulta as vagas disponíveis e recebe uma recomendação de vaga |
| Navegação até a vaga | Usuário utiliza o mapa interno para chegar à vaga indicada |
| Uso do estacionamento | Usuário escaneia QR Code e registra vaga |
| Monitoramento das vagas | Sistema atualiza a disponibilidade das vagas conforme os sensores. |
| Localização do veículo | Usuário utiliza a função “Leve-me ao carro” |
| Pagamento | Usuário realiza pagamento pelo aplicativo |
| Histórico de estacionamento | Usuário consulta suas estadias, tempo de permanência, vaga e valor pago |
| Notificações | Usuário recebe alertas sobre o tempo de permanência e o valor acumulado |
| Uso geral do sistema | Avaliação da facilidade de uso (usabilidade) |
| Validação com cliente | Sistema será apresentado para aprovação |

---

## Tabela de Verificação

| **ID** | **Requisito** | **Tipo de Teste** | **Como será verificado** |
| :---: | :---: | :---: | :---: |
| RF01| Cadastro de usuário | Teste unitário | Verificar se o usuário consegue realizar o cadastro corretamente |
| RF02  Login | Teste unitário | Validar se o login funciona com dados corretos e incorretos |
| RF03 | Seleção de destino | Teste Funcional | Verificar se o usuário consegue selecionar corretamente o shopping de destino |
| RF04 | Navegação até a vaga | Teste Funcional | Verificar se o sistema calcula e exibe corretamente a rota até a vaga sugerida |
| RF05 | Registro de estacionamento (check-in) | Teste de integração | Verificar se a leitura do QR Code associa corretamente o veículo à vaga registrada |
| RF06 | Monitoramento de custos | Teste Funcional | Verificar se o valor da permanência é calculado corretamente conforme a tarifa do shopping |
| RF07 | Notificações ativas | Teste Funcional | Verificar se o usuário recebe alertas sobre o tempo de permanência e o valor acumulado |
| RF08 | “Leve-me ao carro” | Teste Funcional | Verificar se o sistema orienta corretamente o usuário até a vaga onde o veículo está estacionado |
| RF09 | Pagamento In-App | Teste de integração | Testar se o pagamento via Pix ou cartão é processado corretamente |
| RF10 | Histórico de estacionamento | Teste Funcional | Verificar se o usuário consegue consultar suas datas, tempo de permanência, vaga utilizada e valor pago |
| RF11 | Sensores | Teste de integração | Verificar se os sensores identificam corretamente a ocupação e disponibilidade das vagas |
| RF12 | Recomendação inteligente | Teste funcional | Verificar se a IA recomenda uma vaga disponível de acordo com os dados do sistema e o destino selecionado |
