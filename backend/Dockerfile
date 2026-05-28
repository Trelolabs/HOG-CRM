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

# Railway injects PORT at runtime as an environment variable.
# Do NOT hardcode EXPOSE - Railway reads the PORT env var directly.
# The app reads process.env.PORT, Railway sets this automatically to 8080 or similar.

# Start the application
CMD ["npm", "start"]
