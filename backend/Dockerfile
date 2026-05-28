# Stage 1: Build the application
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies (including devDependencies needed for build)
RUN npm install

# Copy the rest of the application code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the TypeScript code
RUN npm run build


# Stage 2: Production image
FROM node:20-alpine AS runner

WORKDIR /app

# Set Node environment to production
ENV NODE_ENV=production

# Copy package.json and install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy the built application from the builder stage
COPY --from=builder /app/dist ./dist

# Copy the generated Prisma client from the builder stage
# (Prisma client needs the schema and engines)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create uploads directory (used by multer)
RUN mkdir uploads

# Expose the port the app runs on (assuming 3000, adjust if different)
EXPOSE 3000

# Start the application
# Use a script to run migrations before starting if needed, 
# for now we'll just start the node app.
CMD ["npm", "start"]
