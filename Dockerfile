# Use a small Node image
FROM node:22-alpine

# Install ffmpeg so DisTube can play audio
RUN apk add --no-cache ffmpeg

# Set working directory inside the container
WORKDIR /app

# Copy package files and install dependencies (prod only)
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of your bot code
COPY . .

# Environment
ENV NODE_ENV=production

# Start the bot
CMD ["node", "index.js"]
