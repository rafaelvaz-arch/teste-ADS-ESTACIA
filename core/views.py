from django.http import JsonResponse
from django.views.decorators.http import require_GET
from database.astar_3d import AStar3D, NODES_CIDADE_JARDIM, EDGES_CIDADE_JARDIM

@require_GET
def calcular_rota_api(request):
    origem = request.GET.get('origem')
    destino = request.GET.get('destino')

    if not origem or not destino:
        return JsonResponse({
            'status': 'error',
            'message': 'Informe os parâmetros "origem" e "destino".'
        }, status=400)

    planner = AStar3D(NODES_CIDADE_JARDIM, EDGES_CIDADE_JARDIM)
    resultado = planner.get_route_payload(origem, destino)

    return JsonResponse(resultado, safe=False)