# Python Agent Dockerfile
FROM ghcr.io/astral-sh/uv:0.10.4-python3.11-trixie

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files first for better caching
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
# 激活虚拟环境 - 将虚拟环境的 bin 目录加入 PATH
ENV PATH="/app/.venv/bin:$PATH"

# Run the application - 使用虚拟环境中的 Python 直接运行
CMD ["python", "main.py"]
