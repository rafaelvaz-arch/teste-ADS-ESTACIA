# Diagrama de Casos de Uso --- EstacIA

## Diagrama principal --- Motorista / Condutor

``` mermaid
flowchart LR
    M[Motorista / Condutor]

    UC01["UC01: Consultar<br/>Vagas em Tempo Real"]
    UC02["UC02: Receber Recomendação<br/>de Vaga (IA XGBoost)"]
    UC03["UC03: Navegar<br/>por Rota Indoor<br/>(Algoritmo A*)"]
    UC04["UC04: Realizar<br/>Check-in via QR Code"]
    UC05["UC05: Registar<br/>Ocupação Física Automática"]
    UC06["UC06: Localizar Veículo<br/>(Encontre Meu Carro)"]
    UC07["UC07: Efetuar Pagamento<br/>Digital (Pix/Cartão)"]
    UC08["UC08: Gerir<br/>Tolerância de Saída (20 min)"]

    G[Gateway de Pagamento]

    M --> UC01
    M --> UC02
    M --> UC03
    M --> UC04
    M --> UC06
    M --> UC07

    UC07 -. include .-> UC08
    UC07 --> G

    %% Organização visual dos casos de uso
    UC01 ~~~ UC02
    UC02 ~~~ UC03
    UC03 ~~~ UC04
    UC04 ~~~ UC05
    UC05 ~~~ UC06
    UC06 ~~~ UC07
    UC07 ~~~ UC08
```

### Ligações do Motorista / Condutor

-   **UC01** --- Consultar Vagas em Tempo Real
-   **UC02** --- Receber Recomendação de Vaga (IA XGBoost)
-   **UC03** --- Navegar por Rota Indoor (Algoritmo A\*)
-   **UC04** --- Realizar Check-in via QR Code
-   **UC06** --- Localizar Veículo ("Encontre Meu Carro")
-   **UC07** --- Efetuar Pagamento Digital (Pix/Cartão)

### Relação entre UC07 e UC08

-   **UC07 → UC08:** o UC07 **inclui** o UC08.
-   **UC08:** Gerir Tolerância de Saída (20 min).

### Ligação com o Gateway

-   **UC07 → Gateway de Pagamento:** o pagamento digital é realizado por
    meio do Gateway de Pagamento.



## Diagrama Sensor IoT ultrassônico

Este diagrama mostra Sensor IoT ultrassônico e os casos de
uso diretamente relacionados a ele.

``` mermaid
flowchart LR
    S[Sensor IoT<br/>ultrassônico]

    UC05["UC05: Registar<br/>Ocupação Física Automática"]
    UC09["UC09: Registar<br/>Desocupação de Vaga"]

    S --> UC05
    S --> UC09

    %% Organização visual
    UC05 ~~~ UC09
```

### Ligações do Sensor IoT ultrassônico

-   **Sensor IoT → UC05:** registra a ocupação física automática da
    vaga.
-   **Sensor IoT → UC09:** registra a desocupação da vaga.



## Lista dos casos de uso

  Código                  Caso de uso                 Ator relacionado
  ---------------      -----------------------     -----------------------
  **UC01**                Consultar Vagas em        Motorista / Condutor
                          Tempo Real              

  **UC02**                Receber Recomendação de   Motorista / Condutor
                          Vaga (IA XGBoost)       

  **UC03**                Navegar por Rota Indoor   Motorista / Condutor
                          (Algoritmo A\*)         

  **UC04**                Realizar Check-in via     Motorista / Condutor
                          QR Code                 

  **UC05**                Registar Ocupação         Sensor IoT ultrassônico
                          Física Automática       

  **UC06**                Localizar Veículo         Motorista / Condutor
                          ("Encontre Meu Carro")  

  **UC07**                Efetuar Pagamento         Motorista / Condutor +
                          Digital (Pix/Cartão)       Gateway de Pagamento

  **UC08**                Gerir Tolerância de       Incluído pelo UC07
                          Saída (20 min)          

  **UC09**                Registar Desocupação de   Sensor IoT ultrassônico
                          Vaga                    
  -----------------------------------------------------------------------
