"""
astar_mapa.py — rota do SS1 calculada sobre o MAPA EXTRAÍDO POR VISÃO COMPUTACIONAL.

Substitui, para o SS1, o grafo manual de database/astar_3d.py (nós e distâncias
inventados). Usa o mesmo mapa de custo e a mesma função de custo do front-end
(js/navegacao.jsx), então backend e tela calculam o MESMO trajeto.

    python database/astar_mapa.py A-145
    >>> from database.astar_mapa import RotaSS1
    >>> RotaSS1().payload("A-145")      # JSON pronto para a API/Frontend
"""
import base64
import heapq
import json
import math
import os
import sys

MAPA_PADRAO = os.path.join(os.path.dirname(__file__), "..", "assets", "mapa_estacia.json")
MIN_CLEAR = 20  # folga mínima (valor da grade ≈ 1,7 célula ≈ 0,9 m)
D8 = [(1, 0, 1), (-1, 0, 1), (0, 1, 1), (0, -1, 1), (1, 1, 1.4142), (1, -1, 1.4142), (-1, 1, 1.4142), (-1, -1, 1.4142)]


class RotaSS1:
    def __init__(self, caminho_mapa=MAPA_PADRAO):
        with open(caminho_mapa, encoding="utf-8") as f:
            self.mapa = json.load(f)
        c = self.mapa["subsolo"]["custo"]
        self.gw, self.gh, self.cell = c["grade"][0], c["grade"][1], c["celula_px"]
        self.g = base64.b64decode(c["dados_b64"])
        self.mg = base64.b64decode(c["margem_b64"])
        self.A = c["afim_ss1_para_terreo"]
        w, h = self.mapa["meta"]["imagem_px"]
        self.W, self.H, self.s = w, h, self.mapa["meta"]["m_por_px"]
        a, b, tx = self.A[0]
        cc, d, ty = self.A[1]
        self._det = a * d - b * cc

    # --- conversões (SS1 px <-> metros do referencial do Térreo) ---------------------------------
    def ss_para_m(self, x, y):
        a, b, tx = self.A[0]
        c, d, ty = self.A[1]
        px, py = a * x + b * y + tx, c * x + d * y + ty
        return (px - self.W / 2) * self.s, (self.H / 2 - py) * self.s

    def m_para_ss(self, X, Y):
        a, b, tx = self.A[0]
        c, d, ty = self.A[1]
        px, py = X / self.s + self.W / 2 - tx, self.H / 2 - Y / self.s - ty
        return (d * px - b * py) / self._det, (-c * px + a * py) / self._det

    def _cel(self, X, Y):
        x, y = self.m_para_ss(X, Y)
        return int(x // self.cell), int(y // self.cell)

    def _centro(self, i, j):
        return self.ss_para_m((i + 0.5) * self.cell, (j + 0.5) * self.cell)

    def _livre_perto(self, i, j):
        for r in range(60):
            melhor, dmin = None, 1e9
            for jj in range(j - r, j + r + 1):
                for ii in range(i - r, i + r + 1):
                    if max(abs(ii - i), abs(jj - j)) != r or not (0 <= ii < self.gw and 0 <= jj < self.gh):
                        continue
                    if self.g[jj * self.gw + ii] >= MIN_CLEAR and (ii - i) ** 2 + (jj - j) ** 2 < dmin:
                        dmin, melhor = (ii - i) ** 2 + (jj - j) ** 2, (ii, jj)
            if melhor:
                return melhor
        return None

    # --- A* (mesma função de custo do JS) --------------------------------------------------------
    def _astar(self, s, t):
        gw, gh, g, mg = self.gw, self.gh, self.g, self.mg
        h = lambda i, j: max(abs(i - t[0]), abs(j - t[1])) + 0.4142 * min(abs(i - t[0]), abs(j - t[1]))
        gs, came = {s: 0.0}, {}
        abre = [(h(*s), s)]
        while abre:
            _, cur = heapq.heappop(abre)
            if cur == t:
                break
            ci, cj = cur
            for dx, dy, ln in D8:
                ni, nj = ci + dx, cj + dy
                if not (0 <= ni < gw and 0 <= nj < gh):
                    continue
                v = g[nj * gw + ni]
                if not v or (dx and dy and (not g[cj * gw + ni] or not g[nj * gw + ci])):
                    continue
                margem = min(1.0, max(0.0, 1 - mg[nj * gw + ni] / 60.0))
                ng = gs[cur] + ln * (1 + 6 / (1 + v / 12.0)) * (1 + 3 * margem)
                if ng < gs.get((ni, nj), 1e18):
                    gs[(ni, nj)], came[(ni, nj)] = ng, cur
                    heapq.heappush(abre, (ng + h(ni, nj), (ni, nj)))
        if t not in came and t != s:
            return None
        caminho = [t]
        while caminho[-1] in came:
            caminho.append(came[caminho[-1]])
        return caminho[::-1]

    def payload(self, codigo_vaga):
        vaga = next((v for v in self.mapa["subsolo"]["vagas"] if v["id"] == codigo_vaga), None)
        if not vaga:
            return {"status": "error", "message": f'Vaga "{codigo_vaga}" não existe no mapa.'}
        rampa = sorted(self.mapa["rampas"]["terreo"], key=lambda r: r["y0"])[0]  # rampa central/valet
        lane_x = rampa["x0"] + 0.25 * (rampa["x1"] - rampa["x0"])
        fy = 1 if vaga["frente"] == "N" else -1
        ini = self._livre_perto(*self._cel(lane_x, rampa["y0"] - 2.0))
        fim = self._livre_perto(*self._cel(vaga["x"], vaga["y"] + fy * (vaga["h"] / 2 + 2.2)))
        caminho = self._astar(ini, fim) if ini and fim else None
        if not caminho:
            return {"status": "error", "message": f"Sem caminho no SS1 até {codigo_vaga}."}
        pts = [self._centro(i, j) for i, j in caminho] + [(vaga["x"], vaga["y"])]
        dist = sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))
        return {
            "status": "success",
            "pavimento": "SS1",
            "vaga": codigo_vaga,
            "distance_meters": round(dist, 1),
            "total_nodes": len(pts),
            "waypoints": [{"x": round(x, 2), "y": round(y, 2), "z": -self.mapa["meta"]["gap_pisos_m"]} for x, y in pts],
        }


if __name__ == "__main__":
    r = RotaSS1().payload(sys.argv[1] if len(sys.argv) > 1 else "A-145")
    print(json.dumps({k: v for k, v in r.items() if k != "waypoints"}, ensure_ascii=False))
