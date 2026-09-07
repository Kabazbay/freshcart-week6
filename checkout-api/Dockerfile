# ==========================
# Stage 1 - Build Stage
# ==========================

FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build


# ==========================
# Stage 2 - Production Stage
# ==========================

FROM node:20-alpine

RUN apk update && apk upgrade

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

USER appuser

EXPOSE 3000

CMD ["node","dist/index.js"]