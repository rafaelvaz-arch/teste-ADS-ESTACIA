# Imagem base Python leve e otimizada
FROM python:3.11-slim

# Evita geração de ficheiros .pyc e garante logs em tempo real
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Instala dependências do sistema operacional necessárias para o OpenCV e compilações
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Define o diretório de trabalho no container
WORKDIR /app

# Copia e instala as dependências do Python
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copia todo o código-fonte do projeto para o container
COPY . /app/

# Expõe a porta padrão do Django
EXPOSE 8000

# Comando para iniciar o servidor backend
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]