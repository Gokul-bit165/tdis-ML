FROM python:3.11-slim
WORKDIR /app
# xgboost needs libgomp
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ignition_core.py ingest.py store.py db.py score_job.py main.py bootstrap_db.py ./
COPY sql ./sql
COPY model ./model
COPY data/texas.geojson data/texas_cells.parquet ./data/
ENV MODEL_DIR=/app/model PYTHONUNBUFFERED=1
# RUN_MODE=api serves the HTTP API, RUN_MODE=bootstrap prepares a new database (one-off), anything else runs the scoring job.
CMD ["sh", "-c", "if [ \"$RUN_MODE\" = api ]; then exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}; elif [ \"$RUN_MODE\" = bootstrap ]; then exec python bootstrap_db.py; else exec python score_job.py; fi"]
