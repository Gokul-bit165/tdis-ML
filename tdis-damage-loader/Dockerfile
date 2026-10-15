FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY damage_core.py ingest.py store.py db.py damage_job.py ./
COPY sql ./sql
ENV MIGRATION_FILE=/app/sql/043_create_damage_assessment_tables.sql PYTHONUNBUFFERED=1
# Runs once and exits: loads whatever is new in DAMAGE_URI. Schedule it as a Container Apps job.
CMD ["python", "damage_job.py", "poll"]
