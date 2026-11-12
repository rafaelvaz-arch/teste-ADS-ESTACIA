# Histórico de mudanças

Registre aqui as mudanças relevantes por sprint ou marco avaliativo.

## Sprint 00 - Planejamento

- Criação do repositório.
- Definição do problema, da equipe, dos papéis e do backlog inicial.

## Navegação 3D v3 — mapa por visão computacional

- `scripts/extrair_mapa.py`: extrai das plantas (OpenCV) rampas, pilares, vagas, caixas, via livre e prédio; registra o SS1 sobre o Térreo; escala pela grade de 8,40 m.
- `assets/mapa_estacia.json|js`, `assets/planta_subsolo_alinhada.png`, `assets/planta_terreo_recortada.png`: saídas do pipeline.
- `js/navegacao.jsx`: cena em metros (pisos a 3,6 m, rampa de ~26°), cenário extrudado, rota calculada por A* até a vaga, GPS 3D com câmera de perseguição, HUD compacto e chegada animada.
- `database/astar_mapa.py`: o backend calcula a mesma rota do front-end sobre o mesmo mapa.
- `js/estacia3d.js`: núcleo 3D/roteamento compartilhado entre as duas telas (A*, pisos, rampa, cenário, carro).
- `js/encontremeucarro.jsx` v2: rota a pé (Térreo → torre de elevadores → foyer central do SS1 → vaga) sobre o mesmo mapa; passo a passo gerado da geometria; modo acessível (elevador).
- Fluxo: "Finalizar Rota" grava `estacia_vaga_destino` e abre `checkin.html`, que repassa `?vaga=` ao monitoramento.
