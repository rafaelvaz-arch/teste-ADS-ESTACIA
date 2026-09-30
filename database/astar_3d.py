import heapq
import math

# ==============================================================================
# GEOMETRIA E NÓS DO SHOPPING CENTER CIDADE JARDIM
# ==============================================================================
NODES_CIDADE_JARDIM = {
    # TÉRREO (Z = 0)
    'TJ_ENTRADA_SUL':       {'x': 10,  'y': 100, 'z': 0,  'type': 'entrada'},
    'TJ_RAMPA_VALET_TOPO':  {'x': 20,  'y': 100, 'z': 0,  'type': 'rampa'},
    'TJ_RAMPA_1_TOPO':      {'x': 50,  'y': 20,  'z': 0,  'type': 'rampa'},
    'TJ_ELEVADOR_CENTRAL':  {'x': 100, 'y': 100, 'z': 0,  'type': 'elevador'},

    # SUBSOLO SS1 (Z = -1)
    'SS1_RAMPA_1_BASE':     {'x': 50,  'y': 20,  'z': -1, 'type': 'rampa'},
    'SS1_FOYER_CENTRAL':    {'x': 100, 'y': 100, 'z': -1, 'type': 'elevador'},
    'SS1_SETOR_A_VAGA_145': {'x': 120, 'y': 130, 'z': -1, 'type': 'vaga'},
    'SS1_SETOR_B_VAGA_089': {'x': 40,  'y': 50,  'z': -1, 'type': 'vaga'},
    'SS1_SETOR_EV_01':      {'x': 110, 'y': 140, 'z': -1, 'type': 'vaga_eletrica'},
}

# ==============================================================================
# ARESTAS E CONEXÕES DO GRAFO (DISTÂNCIAS EM METROS)
# ==============================================================================
EDGES_CIDADE_JARDIM = {
    # TÉRREO (Z = 0)
    'TJ_ENTRADA_SUL': [
        ('TJ_RAMPA_VALET_TOPO', 10.0),
        ('TJ_RAMPA_1_TOPO', 20.0),
        ('TJ_ELEVADOR_CENTRAL', 30.0)
    ],
    'TJ_RAMPA_VALET_TOPO': [
        ('TJ_ENTRADA_SUL', 10.0)
    ],
    'TJ_RAMPA_1_TOPO': [
        ('TJ_ENTRADA_SUL', 20.0),
        ('SS1_RAMPA_1_BASE', 15.0)
    ],
    'TJ_ELEVADOR_CENTRAL': [
        ('TJ_ENTRADA_SUL', 30.0),
        ('SS1_FOYER_CENTRAL', 5.0)
    ],

    # SUBSOLO SS1 (Z = -1)
    'SS1_RAMPA_1_BASE': [
        ('TJ_RAMPA_1_TOPO', 15.0),
        ('SS1_SETOR_B_VAGA_089', 45.0),
        ('SS1_FOYER_CENTRAL', 110.0)
    ],
    'SS1_FOYER_CENTRAL': [
        ('TJ_ELEVADOR_CENTRAL', 5.0),
        ('SS1_RAMPA_1_BASE', 110.0),
        ('SS1_SETOR_A_VAGA_145', 25.0),
        ('SS1_SETOR_B_VAGA_089', 35.0),
        ('SS1_SETOR_EV_01', 45.0)
    ],
    'SS1_SETOR_A_VAGA_145': [
        ('SS1_FOYER_CENTRAL', 25.0)
    ],
    'SS1_SETOR_B_VAGA_089': [
        ('SS1_FOYER_CENTRAL', 35.0),
        ('SS1_RAMPA_1_BASE', 45.0)
    ],
    'SS1_SETOR_EV_01': [
        ('SS1_FOYER_CENTRAL', 45.0)
    ],
}


# ==============================================================================
# MOTOR A* 3D
# ==============================================================================
class AStar3D:
    def __init__(self, nodes, edges):
        self.nodes = nodes
        self.edges = edges

    def heuristic(self, node_a, node_b):
        """Calcula a distância euclidiana 3D entre dois nós (heurística Admissível)."""
        a = self.nodes[node_a]
        b = self.nodes[node_b]

        # Penalidade por mudança de andar (Z) para simular escadas/elevadores
        penalidade_z = abs(a['z'] - b['z']) * 5.0

        dx = a['x'] - b['x']
        dy = a['y'] - b['y']

        return math.sqrt(dx**2 + dy**2) + penalidade_z

    def find_path(self, start, goal):
        """Executa o algoritmo A* para encontrar o menor caminho."""
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
            current = heapq.heappop(open_set)[1]

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

                    if not any(item[1] == neighbor for item in open_set):
                        heapq.heappush(open_set, (f_score[neighbor], neighbor))

        return None, float('inf')

    def get_route_payload(self, start, goal):
        """Retorna o JSON estruturado para consumo da API/Frontend."""
        path, distance = self.find_path(start, goal)

        if not path:
            return {
                'status': 'error',
                'message': f'Rota não encontrada entre "{start}" e "{goal}".'
            }

        waypoints = []
        for node in path:
            info = self.nodes[node]
            waypoints.append({
                'node': node,
                'x': info['x'],
                'y': info['y'],
                'z': info['z'],
                'type': info['type']
            })

        return {
            'status': 'success',
            'shopping': 'Shopping Center Cidade Jardim',
            'distance_meters': round(distance, 2),
            'total_nodes': len(waypoints),
            'waypoints': waypoints
        }