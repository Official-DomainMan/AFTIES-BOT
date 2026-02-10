# Use a Debian base that has modern Python available (Bookworm = Python 3.11)
FROM node:20-bookworm-slim

# Install system deps:
# - ffmpeg: audio playback
# - python3.11: required by yt-dlp
# - build tools: for native modules if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3.11 \
    python3.11-distutils \
    ca-certificates \
    openssl \
    git \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

# Ensure "python3" points to python3.11 (yt-dlp looks for python3)
RUN ln -sf /usr/bin/python3.11 /usr/bin/python3 && ln -sf /usr/bin/python3.11 /usr/bin/python

# If anything uses PYTHON env (node-gyp), set it explicitly
ENV PYTHON=/usr/bin/python3.11
ENV NODE_ENV=production

WORKDIR /app

# Install deps first for better caching
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy the rest of the app
COPY . .

# Prisma client generation (important for Railway)
# If prisma is in devDependencies only, this will fail — in that case,
# move prisma + @prisma/client to dependencies.
RUN npx prisma generate

# Optional but recommended: ensure DB migrations are applied on start
# If you do not use migrations, you can remove "prisma migrate deploy".
CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
