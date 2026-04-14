FROM node:20-alpine AS build

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm ci

# Copiamos la carpeta prisma primero
COPY prisma.config.ts ./
COPY prisma ./prisma/

# Generamos el cliente de Prisma (no necesita DB_URL)
# Esto crea los tipos necesarios para que el build no falle
RUN npx prisma generate

# Copiamos el resto del código y buildeamos
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Limpiamos dependencias de desarrollo
RUN npm prune --omit=dev


FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Copiamos solo lo esencial
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

# Exponemos el puerto
EXPOSE 3000

# Seguridad ante todo
USER node

# Arrancamos la app
CMD ["node", "dist/index.js"]