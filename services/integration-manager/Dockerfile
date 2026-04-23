FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

EXPOSE 8013
EXPOSE 1514/udp
EXPOSE 1514/tcp

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8013", "--workers", "1"]
