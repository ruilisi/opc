FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN npm install -g bun && bun install --frozen-lockfile
COPY . .
ARG NEXT_PUBLIC_HOCUSPOCUS_URL
ENV NEXT_PUBLIC_HOCUSPOCUS_URL=$NEXT_PUBLIC_HOCUSPOCUS_URL
RUN bunx prisma generate
RUN bun run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server ./server
COPY --from=builder /app/src ./src
COPY --from=builder /app/start.js ./start.js
EXPOSE 3000 1234
CMD ["node", "start.js"]
