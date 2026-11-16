# Pipeline de visão computacional das plantas

`scripts/extrair_mapa.py` lê as plantas 2D (`assets/planta_terreo.png`, `assets/planta_subsolo.png`) com
OpenCV e gera a geometria que a navegação 3D usa. Rodar **uma vez** (ou quando a planta mudar); o navegador não
precisa de OpenCV.

```bash
pip install -r scripts/requirements-cv.txt
python scripts/extrair_mapa.py --terreo assets/planta_terreo.png --subsolo assets/planta_subsolo.png \
       --saida assets --debug debug
```

## Saídas

| Arquivo | Conteúdo |
| --- | --- |
| `assets/mapa_estacia.json` / `.js` | Geometria em **metros** (x leste, y norte): rampas, pilares, vagas, caixas (núcleos, foyer…), prédio, laje e o mapa de custo da via livre. O `.js` define `window.MAPA_ESTACIA` e funciona até em `file://`. |
| `assets/planta_subsolo_alinhada.png` | SS1 registrado sobre o Térreo, com transparência fora da laje. |
| `assets/planta_terreo_recortada.png` | Térreo com transparência fora da laje. |
| `debug/*.png` | Sobreposições para conferir a detecção (exemplos em `docs/pipeline_cv/`). |

## Etapas

1. **Rampas** — clusters de cor amarela (HSV) + dilatação; filtra por tamanho (descarta setas e o tracejado da moldura).
2. **Registro SS1 → Térreo** — similaridade (escala, rotação, translação) pelos centros das 2 rampas, em números
   complexos. O resíduo nos cantos (RMS ≈ 7,9 px ≈ 1,1 m) é impresso: as duas plantas não são perfeitamente
   consistentes entre si.
3. **Escala** — passo da grade de pilares (módulo de **8,40 m**, escrito no título da planta) → 0,138 m/px no SS1.
4. **Pilares** — *template matching*; o template é montado a partir de quadrados claros com miolo escuro encontrados
   na própria planta (111 pilares).
5. **Vagas** — blocos por máscara azul/verde + morfologia, subdivididos pelo passo da grade (4 vagas por módulo).
   Conferência: as **40 vagas EV** detectadas batem com o quadro de vagas da planta. A planta declara 850 vagas, mas
   desenha menos (408 detectadas).
   **Numeração:** por distância de percurso a partir da rampa (Dijkstra sobre o mesmo mapa de custo):
   `A-001` é a mais próxima; EV recebem prefixo `E-`.
6. **Caixas** — retângulos de borda ciano/verde, caixas escuras (legenda) e a rosa dos ventos.
7. **Via livre** — interior da laje − (vagas ∪ caixas ∪ rampas ∪ pilares), em células de 4 px. A grade guarda a folga
   até o obstáculo; um segundo canal guarda a distância até a parede (para o A* evitar a faixa colada na parede).
8. **Térreo** — prédio e lojas âncora (cor).

## Como o front-end usa

`js/navegacao.jsx` calcula a rota **no navegador**: Térreo (trecho autoral) → rampa → A* no SS1 até o acesso da vaga.
Custo do passo = `comprimento · (1 + 6/(1 + d)) · (1 + 3·m)`, com `d` = folga em células e `m` = proximidade da
parede (0–1, para < 6 m). Depois: atalhos por linha livre, Douglas-Peucker (0,7 m), fusão de nós a < 4 m e curvas de
raio até 3,5 m. As manobras do turn-by-turn saem da geometria (produto vetorial), agrupando curvas a < 18 m.
`database/astar_mapa.py` repete o mesmo A* no backend (`RotaSS1().payload("A-145")`).

A vaga vem de `?vaga=A-145`, de `sessionStorage.estacia_vaga_destino` ou do `localStorage.active_checkin`; sem nada,
usa `A-145`. Códigos que o mapa não tem (ex.: `B-201` do `teste.sql`) usam a N-ésima vaga convencional e mantêm o
código pedido na tela.

## Rota a pé (`encontremeucarro.jsx`)

Usa o mesmo mapa e o mesmo A* (via `js/estacia3d.js`). Partida (9 pontos do Térreo, em `ORIGENS`) → torre de elevadores
E1/E2 do Térreo → foyer central do SS1 (escada rolante: segmento inclinado; modo acessível: elevador vertical) → A* a
partir das 4 bordas do foyer (fica com o menor caminho) → frente da vaga. O passo a passo vem da geometria (curvas a
< 12 m viram um passo só). A planta do Térreo não tem Cinemas, então esse ponto de partida não existe.

## Limitações conhecidas

- Só a torre **oeste** (E1/E2) do Térreo é usada: a torre leste (E3/E4) fica a ~30 m do núcleo leste do SS1 na planta,
  o que daria uma escada rolante irreal. Os pares E1/E2 (torre oeste ↔ foyer) coincidem a ~8 m.

- A planta do Térreo **não desenha as vias**; o trecho do Térreo até a rampa é definido em `TERREO_*` no JSX.
- As plantas trazem setas de sentido incompatíveis na rampa central (Térreo desce para o sul; SS1 "chegada" aponta
  para o norte). O 3D usa rampa reta para o sul e saída pela faixa inferior do SS1.
- Pisos a 3,6 m e rampa de ~26° (o retângulo desenhado tem só ~13 m); uma rampa de 12–15% exigiria ~25–30 m.
- Mão de direção (faixa à direita) não é aplicada; o carro segue o eixo do corredor.
- Para outra planta: ajuste as constantes de cor/limiar no início das funções de detecção e confira os PNGs de debug.
