# ml-service/Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Install uvicorn explicitly
RUN pip install uvicorn

# Create directories for models and data
RUN mkdir -p /app/models /app/data

# Expose port
EXPOSE 5001

# Start the service
CMD ["uvicorn", "src.api.app:app", "--host", "0.0.0.0", "--port", "5001"]
