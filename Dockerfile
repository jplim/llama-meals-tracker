# Step 1: Build the React frontend and compile the TypeScript server
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Step 2: Create the minimal production runner
FROM node:20-slim
WORKDIR /app
# Install sqlite3 compilation dependencies if needed (slim image might need python/make/g++, but npm prebuild binaries usually cover standard Node platforms)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
# Copy db.ts and server.ts since they are compiled into dist/server.cjs, wait! 
# In our scripts: "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs"
# So esbuild bundles the database code and server code into dist/server.cjs.
# This means we only need dist/ folder to run the app in production!
# Wait! Since we use --packages=external, esbuild leaves all node_modules external, which is why we run npm ci --only=production.
# This is fully correct!
EXPOSE 3000
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/meals.db
CMD ["npm", "start"]
