# Use a stable Node LTS instead of 24 (better support for native deps)
FROM node:20-bullseye

# Create app directory
WORKDIR /app

# -------- System dependencies --------
# ffmpeg: for music playback
# python3 + make + g++: needed for node-gyp to build @discordjs/opus
RUN apt-get update && \
    apt-get install -y ffmpeg python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# -------- Install Node dependencies --------
# Copy only package files first so Docker can cache this layer
COPY package*.json ./

# Copy Prisma schema so generate works
COPY prisma ./prisma

# Install dependencies (including dev deps so Prisma CLI is available)
RUN npm ci || npm install

# Generate Prisma client inside the container
RUN npx prisma generate

# -------- Copy the rest of your bot code --------
COPY . .

# -------- Runtime env --------
ENV NODE_ENV=production

# -------- Start command --------
# 1) Run pending DB migrations
# 2) Start the bot
CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
