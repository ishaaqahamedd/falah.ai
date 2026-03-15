# Stage 1: Install dependencies
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Runtime
FROM python:3.12-slim
WORKDIR /app

COPY --from=builder /install /usr/local
COPY . .

# Remove .env from image — use runtime env vars only
RUN rm -f .env

# Make entrypoint executable
RUN chmod +x start.sh

EXPOSE 8080

CMD ["bash", "start.sh"]
