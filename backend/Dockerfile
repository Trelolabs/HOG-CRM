# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install ALL dependencies (including dev for build)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client and build TypeScript
RUN npm run build


# Stage 2: Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy package files and Prisma schema
COPY package*.json ./
COPY prisma ./prisma

# Install production deps and regenerate Prisma Client for this platform
# (Prisma native binaries are OS/arch-specific, must regenerate in final image)
RUN npm install --omit=dev && npx prisma generate

# Copy the compiled TypeScript output from builder
COPY --from=builder /app/dist ./dist

# Create uploads directory (used by multer)
RUN mkdir -p uploads

# Fly.io routes external HTTPS traffic to port 8080 inside the container
# and automatically injects PORT=8080 as an environment variable at runtime.
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
