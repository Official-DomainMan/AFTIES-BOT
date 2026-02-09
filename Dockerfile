# Use Debian Bookworm (Python 3.11 available) instead of Alpine / older images
FROM node:22-bookworm-slim

# Install system deps:
# - ffmpeg for audio
# - python3 (3.11 on bookworm) for yt-dlp
# - build tools (sometimes needed for native deps)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-venv \
    python3-pip \
    build-essential \
    openssl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Ensure python points to python3 (and python3 is 3.11 here)
RUN ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

# Install deps first for better caching
COPY package*.json ./
RUN npm ci || npm install

# Copy the rest of your code
COPY . .

# Prisma client MUST be generated inside the container
RUN npx prisma generate

# If you use migrations in Railway, you can do migrate deploy at runtime.
# If you already do this elsewhere, keep it anyway—safe to run.
CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
