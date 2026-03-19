# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

# Stage 2: export built files (used by nginx container via volume)
FROM alpine:3
COPY --from=builder /app/dist /dist
CMD ["sh", "-c", "cp -r /dist/. /output/"]
