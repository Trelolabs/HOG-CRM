# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Install ALL deps (including dev - needed for prisma CLI + tsc)
COPY package*.json ./
RUN npm ci

# Copy source and build (runs prisma generate + tsc via build script)
COPY . .
RUN npm run build


# Stage 2: Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma

# Install only production runtime deps (no prisma CLI - avoids npx pulling Prisma 7)
RUN npm ci --omit=dev

# Copy compiled app from builder
COPY --from=builder /app/dist ./dist

# Copy the already-generated Prisma client from builder (Prisma 6, correct version)
# This avoids running npx prisma generate again which would pull the latest (v7) CLI
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create uploads directory (used by multer)
RUN mkdir -p uploads

# Fly.io routes external HTTPS traffic to port 8080
EXPOSE 8080

CMD ["npm", "start"]
