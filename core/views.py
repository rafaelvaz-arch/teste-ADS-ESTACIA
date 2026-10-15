import json
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.views.decorators.csrf import csrf_exempt
from database.astar_3d import AStar3D, NODES_CIDADE_JARDIM, EDGES_CIDADE_JARDIM
from ai.detector import DetectorVagas

# Instância global do detector para reaproveitar o modelo YOLOv8 em memória
detector_ia = DetectorVagas()

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
    """Calcula o menor caminho 3D (A*) entre a origem e o destino selecionados."""
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

@csrf_exempt
def auditar_vaga_imagem(request):
    """
    Endpoint para receber uma imagem/frame da câmara da vaga
    e auditar a ocupação via modelo YOLOv8.
    """
    if request.method == 'POST':
        try:
            # Regiões de Interesse (ROIs) padrão das vagas para cruzamento com o YOLO
            rois_cidade_jardim = {
                'SS1_SETOR_A_VAGA_145': [100, 150, 300, 400],
                'SS1_SETOR_B_VAGA_089': [320, 150, 520, 400],
            }

            if 'imagem' in request.FILES:
                import tempfile
                file_obj = request.FILES['imagem']
                with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp:
                    for chunk in file_obj.chunks():
                        tmp.write(chunk)
                    tmp_path = tmp.name

                resultado = detector_ia.processar_frame(tmp_path, rois_vagas=rois_cidade_jardim)
                return JsonResponse({'status': 'success', 'resultado': resultado})

            return JsonResponse({'status': 'error', 'message': 'Nenhuma imagem enviada.'}, status=400)

        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

    return JsonResponse({'status': 'error', 'message': 'Método não permitido.'}, status=405)