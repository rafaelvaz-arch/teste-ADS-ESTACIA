import cv2
import numpy as np
from ultralytics import YOLO

class DetectorVagas:
    def __init__(self, model_path="yolov8n.pt"):
        """
        Inicializa o detector usando o modelo YOLOv8 leve (nano).
        Na primeira execução, o repositório descarrega automaticamente o peso oficial do YOLO.
        """
        self.model = YOLO(model_path)
        # Classes do COCO Dataset: 2=car, 3=motorcycle, 5=bus, 7=truck
        self.classes_veiculos = [2, 3, 5, 7]

    def processar_frame(self, frame_path_ou_array, rois_vagas=None):
        """
        Processa uma imagem ou frame de câmara IP.
        
        :param frame_path_ou_array: Caminho do ficheiro de imagem ou numpy array do frame.
        :param rois_vagas: Dicionário contendo as coordenadas de cada vaga {'VAGA_089': [x1, y1, x2, y2]}
        :return: Dicionário com o estado de cada vaga e as deteções.
        """
        # Executa inferência do YOLO
        results = self.model(frame_path_ou_array, verbose=False)[0]
        
        veiculos_detectados = []
        for box in results.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            
            # Filtra apenas veículos com confiança mínima de 40%
            if cls_id in self.classes_veiculos and conf >= 0.40:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                veiculos_detectados.append({
                    'bbox': [x1, y1, x2, y2],
                    'confianca': round(conf, 2)
                })

        # Se forem fornecidas ROIs (Regiões de Interesse) das vagas, calcula a ocupação
        status_vagas = {}
        if rois_vagas:
            for vaga_id, coords in rois_vagas.items():
                vx1, vy1, vx2, vy2 = coords
                ocupada = False
                
                for v in veiculos_detectados:
                    bx1, by1, bx2, by2 = v['bbox']
                    # Verifica sobreposição/interseção entre o veículo e a vaga
                    if not (bx2 < vx1 or bx1 > vx2 or by2 < vy1 or by1 > vy2):
                        ocupada = True
                        break
                
                status_vagas[vaga_id] = 'OCUPADA' if ocupada else 'LIVRE'

        return {
            'total_veiculos': len(veiculos_detectados),
            'veiculos': veiculos_detectados,
            'status_vagas': status_vagas
        }

if __name__ == "__main__":
    # Teste rápido local
    detector = DetectorVagas()
    print("Módulo de Visão Computacional YOLOv8 inicializado com sucesso!")