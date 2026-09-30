from django.urls import path
from .views import calcular_rota_api, listar_vagas_disponiveis

urlpatterns = [
    path('api/v1/rota/', calcular_rota_api, name='calcular_rota_api'),
    path('api/v1/vagas/', listar_vagas_disponiveis, name='listar_vagas_disponiveis'),
]