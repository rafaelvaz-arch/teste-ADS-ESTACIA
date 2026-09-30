from django.urls import path
from .views import calcular_rota_api

urlpatterns = [
    path('api/v1/rota/', calcular_rota_api, name='calcular_rota_api'),
]