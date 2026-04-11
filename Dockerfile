FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copy full project
COPY . .

EXPOSE 7860

# FastAPI will serve both backend API + frontend static files
CMD ["uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "7860"]