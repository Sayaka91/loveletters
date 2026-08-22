# --- Build stage: install all deps and build the React frontend ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# --- Runtime stage: only prod deps + built assets + server code ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server

EXPOSE 3000
CMD ["node", "server/index.js"]
