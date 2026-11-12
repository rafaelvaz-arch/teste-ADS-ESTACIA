#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extrair_mapa.py — ADS-ESTACIA
Extrai, por VISÃO COMPUTACIONAL (OpenCV), a geometria das plantas do Térreo e do
Subsolo SS1 e gera tudo que o front-end 3D precisa:

  assets/mapa_estacia.json (+ .js)   geometria em METROS (pilares, vagas, caixas, mapa
                                     de custo para o A*, rampas, prédio, âncoras)
  assets/planta_subsolo_alinhada.png SS1 registrado no mesmo referencial do Térreo
  debug/*.png                        sobreposições para conferir a detecção a olho

Uso:
  python scripts/extrair_mapa.py --terreo assets/planta_terreo.png \
                                 --subsolo assets/planta_subsolo.png \
                                 --saida assets --debug debug

Dependências: pip install -r scripts/requirements-cv.txt   (opencv-python-headless, numpy, scipy, scikit-image)

ETAPAS
  1. Rampas      : retângulos amarelos (clusters de cor + dilatação) nas duas plantas.
  2. Registro    : similaridade (escala+rotação+translação) SS1→Térreo pelos centros
                   das 2 rampas; reporta o resíduo nos cantos. Gera o SS1 alinhado.
  3. Escala      : passo da grade de pilares (módulo de 8,40 m) → metros por pixel.
  4. Pilares     : template matching (template extraído automaticamente da própria
                   planta: quadrado claro com miolo escuro).
  5. Vagas       : blocos de vagas (máscara azul/verde + morfologia) e subdivisão
                   regular pelo passo da grade (4 vagas por módulo). IDs por distância
                   de percurso a partir da rampa (A-001 = mais próxima; EV = E-001...).
  6. Caixas      : retângulos de borda ciano/verde (núcleos, foyer, reservatório...).
  7. Via livre   : asfalto − (vagas ∪ caixas ∪ rampas ∪ pilares) → mapa de custo.
  8. Térreo      : footprint do prédio (creme) e lojas âncora (cinza-esverdeado).
"""
import argparse
import base64
import json
import math
import os
import sys

import cv2
import numpy as np
from scipy import ndimage as ndi

MODULO_M = 8.40          # módulo estrutural informado no título da planta SS1
VAGAS_POR_MODULO = 4     # 4 vagas entre dois pilares (conferido na planta)
CELL_PX = 4              # resolução do mapa de custo (pixels da planta por célula)


# ----------------------------------------------------------------------------
# utilidades
# ----------------------------------------------------------------------------
def ler(path):
    im = cv2.imread(path)
    if im is None:
        sys.exit(f"Não consegui abrir {path}")
    return im


def salvar_debug(dbg_dir, nome, img):
    if dbg_dir:
        os.makedirs(dbg_dir, exist_ok=True)
        cv2.imwrite(os.path.join(dbg_dir, nome), img)


# ----------------------------------------------------------------------------
# 1. rampas (retângulos amarelos)
# ----------------------------------------------------------------------------
def detectar_rampas(im):
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    m = cv2.inRange(hsv, (15, 110, 150), (38, 255, 255))
    d = cv2.dilate(m, np.ones((5, 5), np.uint8))
    n, _, st, _ = cv2.connectedComponentsWithStats(d, 8)
    rampas = []
    for i in range(1, n):
        x, y, w, h, _ = st[i]
        if 40 <= w <= 400 and 40 <= h <= 200:  # ignora setas, tracejado da moldura, textos
            x, y, w, h = x + 2, y + 2, w - 4, h - 4  # desfaz a dilatação
            rampas.append({"x": int(x), "y": int(y), "w": int(w), "h": int(h),
                           "cx": x + w / 2, "cy": y + h / 2})
    rampas.sort(key=lambda r: r["cy"])
    return rampas


# ----------------------------------------------------------------------------
# 2. registro SS1 -> Térreo (similaridade por 2 pontos, em números complexos)
# ----------------------------------------------------------------------------
def registrar(r_ss1, r_ter):
    if len(r_ss1) != 2 or len(r_ter) != 2:
        sys.exit(f"Esperava 2 rampas em cada planta; achei SS1={len(r_ss1)} Térreo={len(r_ter)}")
    zs = [complex(r["cx"], r["cy"]) for r in r_ss1]
    zt = [complex(r["cx"], r["cy"]) for r in r_ter]
    a = (zt[1] - zt[0]) / (zs[1] - zs[0])
    b = zt[0] - a * zs[0]
    M = np.array([[a.real, -a.imag, b.real], [a.imag, a.real, b.imag]], dtype=np.float64)
    # resíduo nos 8 cantos das rampas
    res = []
    for rs, rt in zip(r_ss1, r_ter):
        for (dx, dy) in [(0, 0), (1, 0), (1, 1), (0, 1)]:
            ps = complex(rs["x"] + dx * rs["w"], rs["y"] + dy * rs["h"])
            pt = complex(rt["x"] + dx * rt["w"], rt["y"] + dy * rt["h"])
            res.append(abs(a * ps + b - pt))
    info = {"escala": abs(a), "rotacao_graus": math.degrees(math.atan2(a.imag, a.real)),
            "residuo_cantos_px_rms": float(np.sqrt(np.mean(np.square(res)))),
            "residuo_cantos_px_max": float(np.max(res))}
    return M, info


def aplicar(M, pts):
    p = np.asarray(pts, dtype=np.float64).reshape(-1, 2)
    return p @ M[:, :2].T + M[:, 2]


# ----------------------------------------------------------------------------
# 4. pilares (template extraído da própria imagem)
# ----------------------------------------------------------------------------
def template_pilar(im):
    """Procura quadrados claros (~14 px) com miolo escuro: média deles vira o template."""
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    claro = (g > 100).astype(np.uint8) * 255
    cnts, hier = cv2.findContours(claro, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    cand = []
    for i, c in enumerate(cnts):
        if hier[0][i][3] != -1:  # só contornos externos
            continue
        x, y, w, h = cv2.boundingRect(c)
        if 12 <= w <= 18 and 12 <= h <= 18 and abs(w - h) <= 1 and hier[0][i][2] != -1:
            miolo = g[y + 4:y + h - 4, x + 4:x + w - 4]
            if miolo.size and miolo.mean() < 60:
                cand.append((x, y, w, h))
    if not cand:
        sys.exit("Não achei nenhum pilar isolado para criar o template.")
    s = 20
    acc = np.zeros((s, s), np.float32)
    for x, y, w, h in cand:
        x0, y0 = x + w // 2 - s // 2, y + h // 2 - s // 2
        if x0 >= 0 and y0 >= 0 and x0 + s <= g.shape[1] and y0 + s <= g.shape[0]:
            acc += g[y0:y0 + s, x0:x0 + s]
    return (acc / len(cand)).astype(np.uint8), len(cand)


def detectar_pilares(im, limiar=0.62):
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    tpl, n = template_pilar(im)
    r = cv2.matchTemplate(g, tpl, cv2.TM_CCOEFF_NORMED)
    ys, xs = np.where(r > limiar)
    pts = sorted(zip(r[ys, xs], xs, ys), reverse=True)
    keep = []
    for sc, x, y in pts:  # supressão de não-máximos
        if all(abs(x - a) > 9 or abs(y - b) > 9 for a, b, _ in keep):
            keep.append((int(x), int(y), float(sc)))
    h, w = tpl.shape
    return [{"x": x + w / 2, "y": y + h / 2, "score": sc} for x, y, sc in keep], n


def passo_da_grade(pilares):
    """Passo (px) entre pilares vizinhos na mesma linha = módulo de 8,40 m."""
    ys = np.array([p["y"] for p in pilares])
    xs = np.array([p["x"] for p in pilares])
    difs = []
    for y in np.unique(np.round(ys / 6)):
        linha = np.sort(xs[np.round(ys / 6) == y])
        d = np.diff(linha)
        difs += [v for v in d if 45 <= v <= 80]
    if not difs:
        sys.exit("Não consegui medir o passo da grade de pilares.")
    return float(np.median(difs)), len(difs)


# ----------------------------------------------------------------------------
# 5/6. vagas e caixas
# ----------------------------------------------------------------------------
def _blocos(mask):
    m = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 7)))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (9, 15)))
    n, _, st, _ = cv2.connectedComponentsWithStats(m, 8)
    return [tuple(int(v) for v in st[i][:4]) for i in range(1, n) if st[i][4] > 1200]


def detectar_caixas(im):
    """Caixas de borda ciano/verde/amarela (núcleos, foyer, reservatório, rampas...)."""
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    cy = cv2.inRange(hsv, (95, 150, 120), (110, 255, 255))
    gr = cv2.inRange(hsv, (60, 120, 100), (85, 255, 255))
    out = []
    for nome, m in (("ciano", cy), ("verde", gr)):
        m = cv2.dilate(m, np.ones((3, 3), np.uint8))
        cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in cnts:
            x, y, w, h = cv2.boundingRect(c)
            if 40 < w < 400 and 40 < h < 140 and cv2.contourArea(c) > 80:
                out.append({"x": x, "y": y, "w": w, "h": h, "cor": nome})
    # EV (fill verde) x bicicletário (borda verde, miolo escuro): fração de verde dentro da caixa
    verde_fill = cv2.inRange(hsv, (70, 120, 90), (95, 255, 220))
    for c in out:
        if c["cor"] == "verde":
            sub = verde_fill[c["y"]:c["y"] + c["h"], c["x"]:c["x"] + c["w"]]
            c["cor"] = "ev" if sub.mean() / 255 > 0.35 else "verde"
    # caixas escuras (legenda "Quadro de vagas") e blobs claros (rosa dos ventos)
    g = im.max(axis=2)
    esc = (g < 28).astype(np.uint8) * 255
    n, _, st, _ = cv2.connectedComponentsWithStats(esc, 8)
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if w > 100 and h > 40 and a > 3000:
            out.append({"x": int(x), "y": int(y), "w": int(w), "h": int(h), "cor": "escura"})
    bri = (im.min(axis=2) > 235).astype(np.uint8) * 255
    bri = cv2.morphologyEx(bri, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, _, st, _ = cv2.connectedComponentsWithStats(bri, 8)
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if 28 <= w <= 70 and 28 <= h <= 70 and a > 500 and 60 < y < im.shape[0] - 40 and 80 < x < im.shape[1] - 40:
            out.append({"x": int(x), "y": int(y), "w": int(w), "h": int(h), "cor": "marca"})
    return out


def _iou_contido(a, b):
    ax0, ay0, ax1, ay1 = a[0], a[1], a[0] + a[2], a[1] + a[3]
    bx0, by0, bx1, by1 = b[0], b[1], b[0] + b[2], b[1] + b[3]
    iw, ih = max(0, min(ax1, bx1) - max(ax0, bx0)), max(0, min(ay1, by1) - max(ay0, by0))
    return iw * ih / max(1, a[2] * a[3])


def detectar_blocos_de_vagas(im, caixas):
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    tapar = np.zeros(im.shape[:2], np.uint8)
    for c in caixas:
        if c["cor"] in ("ciano", "verde", "escura", "marca"):
            cv2.rectangle(tapar, (c["x"] - 2, c["y"] - 2), (c["x"] + c["w"] + 2, c["y"] + c["h"] + 2), 255, -1)
    sem = cv2.bitwise_not(tapar)
    azul = _blocos(cv2.bitwise_and(cv2.inRange(hsv, (98, 60, 60), (118, 180, 150)), sem))
    verde = _blocos(cv2.bitwise_and(cv2.inRange(hsv, (70, 120, 90), (95, 255, 220)), sem))
    blocos = []
    for tipo, lista in (("conv", azul), ("ev", verde)):
        for b in lista:
            if any(_iou_contido(b, (c["x"], c["y"], c["w"], c["h"])) > 0.5
                   for c in caixas if c["cor"] in ("ciano", "verde", "escura")):
                continue  # é uma caixa (foyer/núcleo), não um bloco de vagas
            if b[3] > 95 or b[2] < 40:
                continue
            blocos.append({"x": b[0], "y": b[1], "w": b[2], "h": b[3], "tipo": tipo})
    # funde fragmentos que estão contidos em outro bloco
    final = []
    for b in sorted(blocos, key=lambda r: -r["w"] * r["h"]):
        if not any(_iou_contido((b["x"], b["y"], b["w"], b["h"]),
                                (f["x"] - 4, f["y"] - 4, f["w"] + 8, f["h"] + 8)) > 0.7 for f in final):
            final.append(b)
    final.sort(key=lambda r: (round(r["y"] / 40), r["x"]))
    return final


def subdividir_em_vagas(blocos, passo_vaga, prof_vaga=31.0):
    """Divide cada bloco em fileiras (1 ou 2) e colunas regulares. Retorna vagas em px.
    Blocos com h >= 60 px têm 2 fileiras costas-com-costas (a de cima abre ao norte, a de
    baixo ao sul). Fileira única: encosta no lado do corredor e usa a profundidade padrão."""
    vagas = []
    seq = 1
    for bi, b in enumerate(blocos):
        fileiras = 2 if b["h"] >= 60 else 1
        ncol = max(1, int(round(b["w"] / passo_vaga)))
        larg = b["w"] / ncol
        if fileiras == 2:
            gap = max(0.0, b["h"] - 2 * prof_vaga)
            linhas = [(b["y"], prof_vaga, "N"), (b["y"] + prof_vaga + gap, prof_vaga, "S")]
        else:
            prof = min(b["h"], prof_vaga)
            if b["y"] < 160:   # fileira junto ao topo: o corredor fica ao sul
                linhas = [(b["y"] + b["h"] - prof, prof, "S")]
            else:              # demais: o corredor fica ao norte
                linhas = [(b["y"], prof, "N")]
        for (y0, alt, frente) in linhas:
            for c in range(ncol):
                vagas.append({"id": f"A-{seq:03d}", "bloco": bi, "tipo": b["tipo"], "frente": frente,
                              "x": b["x"] + c * larg, "y": y0, "w": larg, "h": alt})
                seq += 1
    return vagas


# ----------------------------------------------------------------------------
# 7. via livre -> mapa de custo
# ----------------------------------------------------------------------------
def mascara_laje(im):
    """Laje inteira (maior região não-branca, preenchida). Fora dela o fundo é papel branco."""
    h, w = im.shape[:2]
    nb = (cv2.cvtColor(im, cv2.COLOR_BGR2GRAY) < 235).astype(np.uint8) * 255
    nb = cv2.morphologyEx(nb, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    cnts, _ = cv2.findContours(nb, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    laje = np.zeros((h, w), np.uint8)
    cv2.drawContours(laje, [max(cnts, key=cv2.contourArea)], -1, 255, -1)
    return laje


def com_alpha(im, laje):
    """BGRA: o que está fora da laje fica transparente (sem 'papel branco' no 3D)."""
    return np.dstack([im, laje])


def via_livre(im, blocos, caixas, rampas, pilares):
    h, w = im.shape[:2]
    laje = mascara_laje(im)
    asf = cv2.erode(laje, np.ones((33, 33), np.uint8))  # sai da parede/tracejado
    obst = np.zeros((h, w), np.uint8)
    for b in blocos:
        cv2.rectangle(obst, (b["x"] - 4, b["y"] - 4), (b["x"] + b["w"] + 4, b["y"] + b["h"] + 4), 255, -1)
    for c in caixas:
        if c["cor"] != "ev":  # EV já está em "blocos"
            cv2.rectangle(obst, (c["x"] - 3, c["y"] - 3), (c["x"] + c["w"] + 3, c["y"] + c["h"] + 3), 255, -1)
    for r in rampas:
        cv2.rectangle(obst, (r["x"] - 2, r["y"] - 2), (r["x"] + r["w"] + 2, r["y"] + r["h"] + 2), 255, -1)
    for p in pilares:
        cv2.rectangle(obst, (int(p["x"]) - 12, int(p["y"]) - 12), (int(p["x"]) + 12, int(p["y"]) + 12), 255, -1)
    livre = cv2.bitwise_and(asf, cv2.bitwise_not(obst))
    livre = cv2.morphologyEx(livre, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(livre, 8)
    grandes = [i for i in range(1, n) if st[i][4] > 1500]
    return np.isin(lab, grandes).astype(np.uint8) * 255


def mapa_de_margem(laje, cell, m_por_px):
    """Distância (decímetros, 0..255) de cada célula até a parede da laje. O A* usa isso para
    NÃO escolher a faixa estreita colada na parede quando existe corredor de verdade."""
    dist = ndi.distance_transform_edt(laje > 0) * m_por_px * 10.0
    gh, gw = laje.shape[0] // cell, laje.shape[1] // cell
    out = np.zeros((gh, gw), np.uint8)
    for j in range(gh):
        for i in range(gw):
            out[j, i] = int(np.clip(dist[j * cell + cell // 2, i * cell + cell // 2], 0, 255))
    return out


def mapa_de_custo(livre, cell):
    h, w = livre.shape
    dist = ndi.distance_transform_edt(livre > 0)  # px até o obstáculo mais próximo
    gh, gw = h // cell, w // cell
    grade = np.zeros((gh, gw), np.uint8)
    for j in range(gh):
        for i in range(gw):
            bloco = livre[j * cell:(j + 1) * cell, i * cell:(i + 1) * cell]
            if bloco.mean() > 127:  # célula livre se >50% livre
                d = dist[j * cell + cell // 2, i * cell + cell // 2] / cell  # folga em células
                grade[j, i] = int(np.clip(d * 12, 1, 255))  # 0 = bloqueado; 1..255 = folga
    return grade


def numerar_por_percurso(vagas, grade, margem, rampa_ss1, m_por_px, cell):
    """Numera as vagas pela DISTÂNCIA DE PERCURSO a partir da rampa (Dijkstra sobre o mesmo
    mapa de custo usado pelo A* do front-end): A-001 é a vaga mais "próxima" da rampa pelas
    vias, como em mapas reais de garagem. Vagas EV recebem prefixo E-."""
    from skimage.graph import MCP_Geometric
    v = grade.astype(np.float64)
    mg = np.clip(1 - margem.astype(np.float64) / 60.0, 0, 1)
    custo = np.where(v > 0, (1 + 6 / (1 + v / 12.0)) * (1 + 3 * mg), np.inf)
    livre = grade > 0
    _, (ii, jj) = None, (None, None)
    idx = ndi.distance_transform_edt(~livre, return_distances=False, return_indices=True)  # célula livre mais próxima

    def livre_perto(px, py):
        ci = int(np.clip(px // cell, 0, grade.shape[1] - 1)); cj = int(np.clip(py // cell, 0, grade.shape[0] - 1))
        return int(idx[0][cj, ci]), int(idx[1][cj, ci])  # (linha, coluna)

    px_lane = rampa_ss1["x"] + 0.25 * rampa_ss1["w"]
    py_exit = rampa_ss1["y"] + rampa_ss1["h"] + 2.0 / m_por_px
    s0 = livre_perto(px_lane, py_exit)
    mcp = MCP_Geometric(custo)
    cum, _ = mcp.find_costs([s0])
    folga = 2.2 / m_por_px
    for v_ in vagas:
        ax = v_["x"] + v_["w"] / 2
        ay = (v_["y"] - folga) if v_["frente"] == "N" else (v_["y"] + v_["h"] + folga)
        r, c = livre_perto(ax, ay)
        v_["_custo"] = float(cum[r, c]) if np.isfinite(cum[r, c]) else 1e9
    conv = sorted([v_ for v_ in vagas if v_["tipo"] != "ev"], key=lambda t: (t["_custo"], t["x"]))
    evs = sorted([v_ for v_ in vagas if v_["tipo"] == "ev"], key=lambda t: (t["_custo"], t["x"]))
    for i, v_ in enumerate(conv, 1):
        v_["id"] = f"A-{i:03d}"
    for i, v_ in enumerate(evs, 1):
        v_["id"] = f"E-{i:03d}"
    return vagas


# ----------------------------------------------------------------------------
# 8. Térreo: prédio e âncoras
# ----------------------------------------------------------------------------
def retangulos_por_cor(im, lo, hi, area_min, w_min=60):
    m = cv2.inRange(im, lo, hi)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out = []
    for c in cnts:
        x, y, w, h = cv2.boundingRect(c)
        if cv2.contourArea(c) >= area_min and w >= w_min:
            out.append({"x": x, "y": y, "w": w, "h": h})
    return out


# ----------------------------------------------------------------------------
# principal
# ----------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--terreo", required=True)
    ap.add_argument("--subsolo", required=True)
    ap.add_argument("--saida", default="assets")
    ap.add_argument("--debug", default="debug")
    ap.add_argument("--gap-pisos-m", type=float, default=4.2, help="pé-direito entre lajes (m)")
    a = ap.parse_args()

    ter, ss1 = ler(a.terreo), ler(a.subsolo)
    H, W = ter.shape[:2]
    rel = {}

    # 1-2) rampas e registro
    r_t, r_s = detectar_rampas(ter), detectar_rampas(ss1)
    M, reg = registrar(r_s, r_t)
    rel["registro"] = reg
    alinhado = cv2.warpAffine(com_alpha(ss1, mascara_laje(ss1)), M, (W, H), flags=cv2.INTER_CUBIC,
                              borderMode=cv2.BORDER_CONSTANT, borderValue=(255, 255, 255, 0))
    os.makedirs(a.saida, exist_ok=True)
    cv2.imwrite(os.path.join(a.saida, "planta_subsolo_alinhada.png"), alinhado)
    cv2.imwrite(os.path.join(a.saida, "planta_terreo_recortada.png"), com_alpha(ter, mascara_laje(ter)))

    # 3-4) pilares e escala (no SS1 original)
    pil, n_tpl = detectar_pilares(ss1)
    passo_px, n_meds = passo_da_grade(pil)
    m_por_px_ss1 = MODULO_M / passo_px
    m_por_px = m_por_px_ss1 / reg["escala"]  # metros por pixel no referencial do Térreo
    rel["escala"] = {"pilares": len(pil), "template_de": n_tpl, "medidas_de_passo": n_meds,
                     "passo_px_ss1": passo_px, "m_por_px_ss1": m_por_px_ss1, "m_por_px_terreo": m_por_px}

    # 6) caixas  5) vagas
    caixas = detectar_caixas(ss1)
    blocos = detectar_blocos_de_vagas(ss1, caixas)
    vagas = subdividir_em_vagas(blocos, passo_px / VAGAS_POR_MODULO)
    cobertas = [(c["x"], c["y"], c["w"], c["h"]) for c in caixas if c["cor"] in ("ciano", "verde", "escura")] + \
               [(r["x"], r["y"], r["w"], r["h"]) for r in r_s]
    vagas = [v for v in vagas if not any(
        x0 - 2 <= v["x"] + v["w"] / 2 <= x0 + w0 + 2 and y0 - 2 <= v["y"] + v["h"] / 2 <= y0 + h0 + 2
        for x0, y0, w0, h0 in cobertas)]
    # (a numeração final é feita depois, por distância de percurso — ver numerar_por_percurso)
    rel["vagas"] = {"blocos": len(blocos), "vagas": len(vagas),
                    "ev": sum(1 for v in vagas if v["tipo"] == "ev"),
                    "declaradas_na_planta": 850}

    # 7) via livre + custo
    livre = via_livre(ss1, blocos, caixas, r_s, pil)
    grade = mapa_de_custo(livre, CELL_PX)
    margem = mapa_de_margem(mascara_laje(ss1), CELL_PX, m_por_px_ss1)
    vagas = numerar_por_percurso(vagas, grade, margem, r_s[1], m_por_px_ss1, CELL_PX)
    rel["via"] = {"celulas_livres": int((grade > 0).sum()), "grade": [int(grade.shape[1]), int(grade.shape[0])]}

    # 8) Térreo
    predio = retangulos_por_cor(ter, (215, 225, 232), (235, 245, 250), 40000, 400)  # creme (BGR)
    ancoras = retangulos_por_cor(ter, (190, 200, 195), (215, 222, 214), 15000, 120)
    rel["terreo"] = {"predio": predio[:1], "ancoras": len(ancoras)}

    # ---- converte tudo para metros (referencial do Térreo; x leste, y norte) ----
    def para_m(p_ss1=None, p_ter=None):
        if p_ss1 is not None:
            p_ter = aplicar(M, p_ss1)
        p = np.asarray(p_ter, dtype=np.float64).reshape(-1, 2)
        return np.stack([(p[:, 0] - W / 2) * m_por_px, (H / 2 - p[:, 1]) * m_por_px], axis=1)

    def ret_m(r, ss1=True):
        pts = [(r["x"], r["y"]), (r["x"] + r["w"], r["y"] + r["h"])]
        q = para_m(p_ss1=pts) if ss1 else para_m(p_ter=pts)
        return {"x0": round(float(min(q[:, 0])), 2), "x1": round(float(max(q[:, 0])), 2),
                "y0": round(float(min(q[:, 1])), 2), "y1": round(float(max(q[:, 1])), 2)}

    pil_m = para_m(p_ss1=[(p["x"], p["y"]) for p in pil])
    vagas_json = []
    for v in vagas:
        q = para_m(p_ss1=[(v["x"] + v["w"] / 2, v["y"] + v["h"] / 2)])[0]
        vagas_json.append({"id": v["id"], "tipo": v["tipo"], "frente": v["frente"],
                           "x": round(float(q[0]), 2), "y": round(float(q[1]), 2),
                           "w": round(v["w"] * m_por_px_ss1, 2), "h": round(v["h"] * m_por_px_ss1, 2)})

    # mapa de custo: origem/células no referencial do SS1 ORIGINAL, com a transformação p/ metros
    grade_b64 = base64.b64encode(grade.tobytes()).decode("ascii")

    saida = {
        "meta": {"unidade": "m", "eixos": "x leste, y norte, z para cima",
                 "imagem_px": [W, H], "m_por_px": round(m_por_px, 5),
                 "largura_m": round(W * m_por_px, 2), "altura_m": round(H * m_por_px, 2),
                 "gap_pisos_m": a.gap_pisos_m,
                 "texturas": {"terreo": "assets/planta_terreo_recortada.png", "subsolo": "assets/planta_subsolo_alinhada.png"},
                 "registro": reg, "gerado_por": "scripts/extrair_mapa.py"},
        "rampas": {
            "terreo": [ret_m(r, ss1=False) for r in r_t],
            "subsolo": [ret_m(r, ss1=True) for r in r_s],
        },
        "subsolo": {
            "laje": ret_m({"x": int(cv2.boundingRect(mascara_laje(ss1))[0]), "y": int(cv2.boundingRect(mascara_laje(ss1))[1]),
                           "w": int(cv2.boundingRect(mascara_laje(ss1))[2]), "h": int(cv2.boundingRect(mascara_laje(ss1))[3])}, ss1=True),
            "pilares": [[round(float(x), 2), round(float(y), 2)] for x, y in pil_m],
            "caixas": [dict(ret_m(c, ss1=True), cor=c["cor"]) for c in caixas],
            "blocos": [dict(ret_m(b, ss1=True), tipo=b["tipo"]) for b in blocos],
            "vagas": vagas_json,
            "custo": {"celula_px": CELL_PX, "grade": [int(grade.shape[1]), int(grade.shape[0])],
                      "m_por_px_ss1": round(m_por_px_ss1, 5),
                      "afim_ss1_para_terreo": [[round(float(v), 6) for v in row] for row in M],
                      "dados_b64": grade_b64,
                      "margem_b64": base64.b64encode(margem.tobytes()).decode("ascii")},
        },
        "terreo": {"predio": [ret_m(r, ss1=False) for r in predio[:1]],
                   "ancoras": [ret_m(r, ss1=False) for r in ancoras]},
    }
    texto = json.dumps(saida, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(a.saida, "mapa_estacia.json"), "w", encoding="utf-8") as f:
        f.write(texto)
    # mesma coisa como script: <script src="assets/mapa_estacia.js"> funciona até em file://
    with open(os.path.join(a.saida, "mapa_estacia.js"), "w", encoding="utf-8") as f:
        f.write("window.MAPA_ESTACIA=" + texto + ";\n")

    # ---- depuração visual ----
    d1 = ss1.copy()
    for p in pil:
        cv2.rectangle(d1, (int(p["x"]) - 8, int(p["y"]) - 8), (int(p["x"]) + 8, int(p["y"]) + 8), (0, 0, 255), 1)
    for v in vagas:
        cv2.rectangle(d1, (int(v["x"]), int(v["y"])), (int(v["x"] + v["w"]), int(v["y"] + v["h"])),
                      (0, 255, 0) if v["tipo"] == "ev" else (0, 255, 255), 1)
    for c in caixas:
        cv2.rectangle(d1, (c["x"], c["y"]), (c["x"] + c["w"], c["y"] + c["h"]), (255, 128, 0), 2)
    for r in r_s:
        cv2.rectangle(d1, (r["x"], r["y"]), (r["x"] + r["w"], r["y"] + r["h"]), (255, 0, 255), 2)
    salvar_debug(a.debug, "ss1_deteccoes.png", d1)
    d2 = ss1.copy()
    d2[livre > 0] = (d2[livre > 0] * 0.4 + np.array([0, 150, 0]) * 0.6).astype(np.uint8)
    salvar_debug(a.debug, "ss1_via_livre.png", d2)
    d3 = cv2.addWeighted(ter, 0.5, alinhado[:, :, :3], 0.5, 0)
    for r in r_t:
        cv2.rectangle(d3, (r["x"], r["y"]), (r["x"] + r["w"], r["y"] + r["h"]), (0, 0, 255), 2)
    salvar_debug(a.debug, "registro_sobreposto.png", d3)

    print(json.dumps(rel, indent=2, ensure_ascii=False, default=float))


if __name__ == "__main__":
    main()
