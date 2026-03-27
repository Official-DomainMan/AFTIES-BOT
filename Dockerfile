# Dockerfile
FROM node:20-bookworm-slim

# Install system deps: ffmpeg for audio, python3.11 for yt-dlp, and build tools
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3.11 \
    python3-pip \
    ca-certificates \
    openssl \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Ensure python points to python3.11 for node-gyp & yt-dlp environments
RUN ln -sf /usr/bin/python3.11 /usr/bin/python3 && ln -sf /usr/bin/python3.11 /usr/bin/python

WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci || npm install

# Copy Prisma schema early (so generate works even if your app imports prisma at boot)
COPY prisma ./prisma

# Generate Prisma client inside the container
RUN npx prisma generate

# Now copy the rest of the app
COPY . .

# Railway provides PORT sometimes; bot doesn't need to expose it, but harmless
ENV NODE_ENV=production

# Start: run migrations, then start the bot
CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]