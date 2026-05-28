# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps first (cached layer — only re-runs if package.json changes)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build


# Stage 2: Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy package files and Prisma schema
COPY package*.json ./
COPY prisma ./prisma

# Use npm ci for faster, reproducible installs
# Regenerate Prisma Client for the correct Linux/Alpine platform
RUN npm ci --omit=dev && npx prisma generate

# Copy the compiled TypeScript output from builder
COPY --from=builder /app/dist ./dist

# Create uploads directory (used by multer)
RUN mkdir -p uploads

# Fly.io routes external HTTPS traffic to port 8080
EXPOSE 8080

CMD ["npm", "start"]
