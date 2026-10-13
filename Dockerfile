FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/dist dist
COPY server server
COPY package.json .
ENV PORT=3000 BREADBOARD_DB=/data/breadboard.db
VOLUME /data
EXPOSE 3000
CMD ["node", "server/index.ts"]
