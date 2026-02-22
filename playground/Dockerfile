FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Install pnpm
RUN npm install -g pnpm

# Copy frontend source and install dependencies
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install

COPY frontend/ ./
RUN pnpm run build

# Stage 2: Backend
FROM python:3.13-slim AS backend
COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /uvx /bin/

WORKDIR /app/backend

# Copy backend dependencies
COPY backend/pyproject.toml backend/uv.lock ./

# Install dependencies
RUN uv sync --frozen --no-dev

# Copy backend code
COPY backend/ ./

# Copy built frontend from Stage 1 into the backend's static directory
COPY --from=frontend-builder /app/frontend/dist ./static

EXPOSE 8000

ENV HOST=0.0.0.0
ENV PORT=8000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
