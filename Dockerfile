FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Set permissions for Hugging Face Spaces to allow writing to the SQLite DB
RUN mkdir -p /data && chown -R 1000:1000 /data && chown -R 1000:1000 /app

ENV DATA_DIR=/data
ENV PORT=7860

EXPOSE 7860

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "7860"]
