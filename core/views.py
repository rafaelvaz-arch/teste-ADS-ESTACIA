from django.http import JsonResponse
from django.views.decorators.http import require_GET
from database.astar_3d import AStar3D, NODES_CIDADE_JARDIM, EDGES_CIDADE_JARDIM

@require_GET
def listar_vagas_disponiveis(request):
    """Retorna as vagas livres (preparado para integração com Supabase)."""
    try:
        from core.supabase_client import supabase
        response = supabase.table('vagas').select('id, setor, numero, status, piso').eq('status', 'LIVRE').execute()
        if response.data:
            return JsonResponse({'status': 'success', 'vagas': response.data}, safe=False)
    except Exception as e:
        print("Aviso: Consulta direta ao Supabase falhou, utilizando fallback local:", e)

    # Retorno de fallback garantido para a interface
    return JsonResponse({
        'status': 'success',
        'vagas': [
            {'id': 'SS1_SETOR_A_VAGA_145', 'setor': 'Setor A', 'numero': '145', 'piso': -1},
            {'id': 'SS1_SETOR_B_VAGA_089', 'setor': 'Setor B', 'numero': '089', 'piso': -1},
            {'id': 'SS1_SETOR_EV_01', 'setor': 'Elétricos', 'numero': 'EV-01', 'piso': -1},
        ]
    })

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