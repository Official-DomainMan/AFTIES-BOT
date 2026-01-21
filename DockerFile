# Dockerfile for AFTIES BOT with Prisma + ffmpeg

# Use a recent Node image
FROM node:24-alpine

# Install ffmpeg for DisTube audio
RUN apk add --no-cache ffmpeg

# Create app directory
WORKDIR /app

# Copy package metadata first (better Docker cache)
COPY package*.json ./

# Copy Prisma schema so we can generate the client
COPY prisma ./prisma

# Install dependencies (including devDeps so Prisma CLI is available)
RUN npm ci || npm install

# Generate Prisma client inside the container
RUN npx prisma generate

# Now copy the rest of the source code
COPY . .

# Set env for runtime
ENV NODE_ENV=production

# Start the bot
CMD ["node", "index.js"]
