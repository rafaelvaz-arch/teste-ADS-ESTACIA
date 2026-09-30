# Diagrama de Casos de Uso --- Sistema EstaCTA

``` mermaid
flowchart LR
    M[Motorista / Condutor]
    I[Sensor IoT<br/>ultrassônico]
    S["Sistema EstaCTA (PWA & Backend)"]
    G[Gateway de Pagamento]

    UC1["UC01: Consultar<br/>Vagas em Tempo Real"]
    UC2["UC02: Receber Recomendação<br/>de Vaga (IA XGBoost)"]
    UC3["UC03: Navegar<br/>por Rota Indoor<br/>(Algoritmo A*)"]
    UC4["UC04: Realizar<br/>Check-in via QR Code"]
    UC6["UC06: Localizar Veículo<br/>(Encontre Meu Carro)"]
    UC7["UC07: Efetuar Pagamento<br/>Digital (Pix/Cartão)"]
    UC8["UC08: Gerir<br/>Tolerância de<br/>Saída (20 min)"]
    UC5["UC05: Registar<br/>Ocupação Física<br/>Automática"]
    UC9["UC09: Registar<br/>Desocupação de<br/>Vaga"]

    M --> UC1
    M --> UC2
    M --> UC3
    M --> UC4
    M --> UC6
    M --> UC7

    I --> UC5
    I --> UC9

    UC7 -. include .-> UC8
    UC7 --> G

    subgraph SISTEMA["Sistema EstaCTA (PWA & Backend)"]
        UC1
        UC2
        UC3
        UC4
        UC6
        UC7
        UC8
        UC5
        UC9
    end
```

## Atores

-   **Motorista / Condutor**
-   **Sensor IoT ultrassônico**
-   **Gateway de Pagamento**

## Casos de uso

  Código   Caso de uso
  -------- -------------------------------------------
  UC01     Consultar Vagas em Tempo Real
  UC02     Receber Recomendação de Vaga (IA XGBoost)
  UC03     Navegar por Rota Indoor (Algoritmo A\*)
  UC04     Realizar Check-in via QR Code
  UC05     Registar Ocupação Física Automática
  UC06     Localizar Veículo ("Encontre Meu Carro")
  UC07     Efetuar Pagamento Digital (Pix/Cartão)
  UC08     Gerir Tolerância de Saída (20 min)
  UC09     Registar Desocupação de Vaga

## Relacionamentos

-   O **Motorista / Condutor** interage com os casos de uso UC01, UC02,
    UC03, UC04, UC06 e UC07.
-   O **Sensor IoT ultrassônico** interage com os casos de uso UC05 e
    UC09.
-   O **Gateway de Pagamento** participa do UC07 --- Efetuar Pagamento
    Digital.
-   O **UC07** inclui o **UC08**, relacionado ao gerenciamento da
    tolerância de saída de 20 minutos.
