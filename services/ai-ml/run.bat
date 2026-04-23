@echo off
cd /d "%~dp0"
set POSTGRES_HOST=localhost
set POSTGRES_PORT=5432
set POSTGRES_USER=soar_user
set POSTGRES_PASSWORD=SecurePostgresPassword123!456
set POSTGRES_DB=soar_db
set REDIS_HOST=localhost
set REDIS_PORT=6379
set REDIS_PASSWORD=SecureRedisPassword345!678
set ELASTICSEARCH_HOST=localhost
set ELASTICSEARCH_PORT=9200
..\..\venv\Scripts\uvicorn main:app --host 0.0.0.0 --port 8003
