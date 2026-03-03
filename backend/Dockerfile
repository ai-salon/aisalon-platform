FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN pip install poetry && poetry config virtualenvs.create false

COPY pyproject.toml poetry.lock* ./
RUN poetry install --only main --no-interaction
RUN pip install git+https://github.com/ai-salon/SocraticAI.git

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
