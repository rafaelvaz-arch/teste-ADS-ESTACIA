import heapq
import math
import json

class AStar3D:
    def __init__(self, nodes, edges):
        self.nodes = nodes
        self.edges = edges

    def heuristic(self, node_a, node_b):
        """Calcula a distância euclidiana 3D com penalização por transição de andar (Z)."""
        x1, y1, z1 = self.nodes[node_a]["x"], self.nodes[node_a]["y"], self.nodes[node_a]["z"]
        x2, y2, z2 = self.nodes[node_b]["x"], self.nodes[node_b]["y"], self.nodes[node_b]["z"]
        
        z_penalty = abs(z2 - z1) * 5.0 
        return math.sqrt((x2 - x1)**2 + (y2 - y1)**2 + (z2 - z1)**2) + z_penalty

    def find_path(self, start, goal):
        if start not in self.nodes or goal not in self.nodes:
            return None, float('inf')

        open_set = []
        heapq.heappush(open_set, (0, start))
        came_from = {}
        
        g_score = {node: float('inf') for node in self.nodes}
        g_score[start] = 0

        f_score = {node: float('inf') for node in self.nodes}
        f_score[start] = self.heuristic(start, goal)

        while open_set:
            _, current = heapq.heappop(open_set)

            if current == goal:
                path = []
                while current in came_from:
                    path.append(current)
                    current = came_from[current]
                path.append(start)
                path.reverse()
                return path, g_score[goal]

            for neighbor, weight in self.edges.get(current, []):
                tentative_g_score = g_score[current] + weight

                if tentative_g_score < g_score[neighbor]:
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g_score
                    f_score[neighbor] = tentative_g_score + self.heuristic(neighbor, goal)
                    heapq.heappush(open_set, (f_score[neighbor], neighbor))

        return None, float('inf')

    def get_route_payload(self, start, goal):
        path, total_cost = self.find_path(start, goal)
        if not path:
            return {"status": "error", "message": "Rota não encontrada"}

        waypoints = []
        for node_id in path:
            node_data = self.nodes[node_id]
            waypoints.append({
                "node": node_id,
                "x": node_data["x"],
                "y": node_data["y"],
                "z": node_data["z"],
                "type": node_data.get("type", "ponto")
            })

        return {
            "status": "success",
            "shopping": "Shopping Center Cidade Jardim",
            "distance_meters": round(total_cost, 2),
            "total_nodes": len(waypoints),
            "waypoints": waypoints
        }


# --- GRAFO DO SHOPPING CENTER CIDADE JARDIM ---
NODES_CIDADE_JARDIM = {
    # PAVIMENTO TÉRREO (Z = 0)
    'TJ_ENTRADA_SUL':       {"x": 100, "y": 10,  "z": 0, "type": "acesso"},
    'TJ_RAMPA_1_TOPO':      {"x": 30,  "y": 180, "z": 0, "type": "rampa_topo"},
    'TJ_RAMPA_VALET_TOPO':  {"x": 100, "y": 20,  "z": 0, "type": "rampa_topo"},
    'TJ_ELEVADOR_CENTRAL':  {"x": 100, "y": 100, "z": 0, "type": "elevador"},

    # SUBSOLO SS1 (Z = -1)
    'SS1_RAMPA_1_BASE':     {"x": 30,  "y": 180, "z": -1, "type": "rampa_base"},
    'SS1_FOYER_CENTRAL':    {"x": 100, "y": 100, "z": -1, "type": "elevador"},
    'SS1_SETOR_A_VAGA_145': {"x": 120, "y": 130, "z": -1, "type": "vaga"},
    'SS1_SETOR_B_VAGA_089': {"x": 60,  "y": 70,  "z": -1, "type": "vaga"},
    'SS1_SETOR_EV_01':      {"x": 130, "y": 140, "z": -1, "type": "vaga_ev"},
}

EDGES_CIDADE_JARDIM = {
    'TJ_ENTRADA_SUL':       [('TJ_RAMPA_VALET_TOPO', 10.0)],
    'TJ_RAMPA_1_TOPO':      [('SS1_RAMPA_1_BASE', 15.0)],
    'SS1_RAMPA_1_BASE':     [('TJ_RAMPA_1_TOPO', 15.0), ('SS1_SETOR_B_VAGA_089', 45.0), ('SS1_FOYER_CENTRAL', 110.0)],
    'TJ_ELEVADOR_CENTRAL':  [('SS1_FOYER_CENTRAL', 5.0)],
    'SS1_FOYER_CENTRAL':    [('TJ_ELEVADOR_CENTRAL', 5.0), ('SS1_SETOR_A_VAGA_145', 25.0), ('SS1_SETOR_EV_01', 45.0)],
}