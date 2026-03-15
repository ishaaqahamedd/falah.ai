# Stage 1: Build
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./

# --- MODIFICATION STARTS HERE ---
# The error suggests explicitly removing node_modules and package-lock.json
# before a clean install to avoid an npm bug with optional dependencies.
RUN rm -rf node_modules package-lock.json && npm ci
# --- MODIFICATION ENDS HERE ---

RUN npm rebuild
COPY . .

# Vite inlines these at build time
ARG VITE_API_URL=/api/v1
ARG VITE_LIVEKIT_URL
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]