# Development/Production Dockerfile for Next.js
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start Next.js in standalone mode
RUN cp -r .next/static .next/standalone/.next/static \
    && (cp -r public .next/standalone/public || true)

CMD ["node", ".next/standalone/server.js"]
