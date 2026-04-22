# Multi-stage build for React + Vite
FROM node:20-alpine AS build

WORKDIR /app

# Copy package manifest and lockfile for deterministic installs
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build-time env vars (VITE_* are inlined by Vite at build time)
ARG VITE_N8N_CHAT_WEBHOOK_URL
ENV VITE_N8N_CHAT_WEBHOOK_URL=$VITE_N8N_CHAT_WEBHOOK_URL

# Build the application
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
