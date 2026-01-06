FROM node:25.2-alpine
WORKDIR /app

RUN npm install -g pnpm

COPY package*.json pnpm-lock.yaml ./
RUN pnpm install

# Copie le schéma Prisma avant la génération
COPY prisma ./prisma

RUN pnpm prisma generate

COPY . .
RUN pnpm run build

EXPOSE 3001 

CMD ["pnpm", "start"]