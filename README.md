# Backend - A Tale of Recognition

Backend del proyecto multijugador: API REST, tiempo real con WebSockets, persistencia en PostgreSQL (Prisma) y estado efimero en Redis.

## Stack Tecnologico

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase Storage](https://img.shields.io/badge/Supabase%20Storage-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/docs/guides/storage)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-EA2845?style=for-the-badge&logoColor=white)](https://docs.bullmq.io/)
[![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![Swagger](https://img.shields.io/badge/Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)](https://swagger.io/)
[![AsyncAPI](https://img.shields.io/badge/AsyncAPI-2A2F45?style=for-the-badge&logo=asyncapi&logoColor=white)](https://www.asyncapi.com/)
[![Jest](https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white)](https://jestjs.io/)
[![Docker](https://img.shields.io/badge/Docker%20Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docs.docker.com/compose/)

## Caracteristicas

- API modular por dominios: auth, users, friends, lobbies, shop, collections.
- Soporte de partidas en tiempo real mediante Socket.IO.
- Gestion de estado transitorio en Redis y datos persistentes en PostgreSQL.
- Integracion recomendada con Supabase Storage para assets multimedia (cartas/tableros).
- Worker de juego para tareas asincronas y control de tiempos.
- Documentacion de endpoints via Swagger en /api-docs.

## Estructura Del Proyecto

```text
src/
   app.ts                      # Configuracion de Express y middlewares
   index.ts                    # Bootstrap HTTP + Socket.IO + workers
   api/
      config/swagger.ts         # OpenAPI/Swagger
      controllers/              # Capa HTTP
      middlewares/              # Auth, ownership, validaciones
      routes/                   # Definicion de endpoints
   core/
      engines/                  # Motores de juego
      strategy/                 # Estrategias de reglas/modos
   infrastructure/
      prisma.ts                 # Cliente Prisma
      redis.ts                  # Conexion Redis
      redis/                    # Esquemas Redis OM
      bullmq/                   # Scheduler/colas
   repositories/               # Acceso a datos
   services/                   # Logica de negocio
   sockets/                    # Eventos, handlers y middleware de sockets
   workers/                    # Workers asincronos
   shared/                     # Tipos, constantes y utilidades
   scripts/                    # Sincronizacion/seed de datos de juego

prisma/
   schema.prisma
   seed.ts
   migrations/
```

## Arquitectura (Mermaid)

```mermaid
flowchart LR
   C[Cliente Web] -->|HTTP REST| E[Express API]
   C -->|WebSocket| S[Socket.IO]

   E --> CTRL[Controllers]
   CTRL --> SV[Services]
   SV --> REP[Repositories]
   REP --> PR[Prisma]
   PR --> PG[(PostgreSQL)]

   S --> SH[Socket Handlers]
   SH --> SV
   SH --> RD[(Redis)]

   W[Game Worker] --> Q[BullMQ]
   Q --> RD
   W --> SV
```

## Sistema De Cache (Redis)

```mermaid
flowchart LR
      APP[API REST + Socket Handlers + Worker] --> REDIS[(Redis)]
      APP --> DB[(PostgreSQL)]

      subgraph CACHE_ASIDE[Cache-Aside sobre datos persistentes]
         DB <--> C1[cache:user:profile/economy/cards/boards/decks]
         DB <--> C2[cache:deck:d_id]
         DB <--> C3[cache:friends:confirmed/pending]
         DB <--> C4[cache:collections:all]
         DB <--> C5[cache:collection:id/cards]
         DB <--> C6[shop:userId daily-shop]
      end

      subgraph SOLO_REDIS[Estado solo en Redis]
         R1[lobby]
         R2[game_state]
         R5[user_session]
         R3[user_activity:userId TTL 10m]
         R4[BullMQ game-timeouts]
      end

      REDIS --- C1
      REDIS --- C2
      REDIS --- C3
      REDIS --- C4
      REDIS --- C5
      REDIS --- C6
      REDIS --- R1
      REDIS --- R2
      REDIS --- R5
      REDIS --- R3
      REDIS --- R4

      C1:::om
      C2:::om
      C3:::om
      C4:::om
      C5:::om
      C6:::om
      R1:::om
      R2:::om
      R5:::om
      R3:::native
      R4:::native
      classDef om fill:#d7f0ff,stroke:#2f6fab,stroke-width:1px;
      classDef native fill:#ffeccf,stroke:#b26b00,stroke-width:1px;
```

Resumen de uso de cache:

- Redis funciona en dos modos: cache-aside de consultas a PostgreSQL y almacenamiento primario de estado en tiempo real.
- Cache-aside implementado en servicios de usuario, social y colecciones con claves cache:\* e invalidacion tras mutaciones.
- Claves cache-aside principales:
- cache:user:profile/economy/cards/boards/decks:{u_id}
- cache:deck:{d_id}
- cache:friends:confirmed/pending:{u_id}
- cache:collections:all y cache:collection:id/cards:{col_id}
- TTL estandar por defecto de 3600s en getCachedData.
- TTL estatico de 86400s para catalogo de colecciones/cartas.
- shop:userId usa daily-shop en Redis OM con TTL dinamico hasta medianoche UTC.
- TTL explicito en user_activity:userId de 10 minutos (control de inactividad/AFK).
- Lobbies y partidas se eliminan de forma explicita al cerrar sala/finalizar partida.
- Sesion de usuario se limpia al salir de la partida.
- lobby, game_state y user_session viven solo en Redis para estado realtime y reconexion.
- BullMQ reutiliza el mismo Redis para la cola de timeouts del juego.

## Reconexion De Sesion (Mermaid)

```mermaid
sequenceDiagram
   participant FE as Frontend
   participant API as API /api/auth/refresh-session
   participant AUTH as AuthService
   participant RS as Redis user_session
   participant WS as Socket.IO

   FE->>API: POST /api/auth/refresh-session (Bearer token)
   API->>AUTH: getUserActiveLobby(userId)
   AUTH->>RS: fetch(userId)
   RS-->>AUTH: lobbyCode | null
   AUTH-->>API: lobbyCode
   API->>AUTH: generateLobbyToken(userId, username, lobbyCode)
   AUTH-->>API: wsToken (JWT corto)
   API-->>FE: { wsToken, lobbyCode, activeSession }

   FE->>WS: connect(auth.token = wsToken)
   WS->>WS: validate JWT y extraer lobbyCode
   alt habia sesion activa
      WS->>WS: auto-join room lobbyCode
      WS-->>FE: SESSION_RECOVERED o LOBBY_RECOVERED
   else no habia sesion
      WS-->>FE: conexion sin sala activa
   end
```

## Flujo Basico De Una Request HTTP

```mermaid
sequenceDiagram
   participant U as Usuario
   participant A as Express (app.ts)
   participant R as Router
   participant C as Controller
   participant S as Service
   participant DB as Prisma/PostgreSQL

   U->>A: Request HTTP
   A->>A: helmet + cors + morgan + json
   A->>R: /api/*
   R->>C: Endpoint
   C->>S: Logica de negocio
   S->>DB: Lectura/Escritura
   DB-->>S: Resultado
   S-->>C: DTO/resultado
   C-->>U: Response JSON
```

## Dominio De Datos (Resumen)

```mermaid
erDiagram
   USER ||--o{ USERCARD : owns
   USER ||--o{ USERBOARD : owns
   USER ||--o{ DECK : creates
   DECK ||--o{ DECKCARD : contains
   USERCARD ||--o{ DECKCARD : used_in

   COLLECTION ||--o{ CARDS : has
   CARDS ||--o{ USERCARD : assigned_to

   USER ||--o{ PURCHASEHISTORY : makes
   PURCHASEHISTORY ||--o{ PURCHASEHISTORYCARD : includes
   CARDS ||--o{ PURCHASEHISTORYCARD : purchased

   USER ||--o{ USERGAMESTATS : plays
   GAMES_LOG ||--o{ USERGAMESTATS : records
```

## Requisitos Previos

- Node.js 20+
- Docker y Docker Compose

## Configuracion Del Entorno

Crea un archivo .env en la raiz del proyecto. Variables recomendadas:

```env
# App
PORT=3000
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development

# JWT
JWT_SECRET=change_me
JWT_WS_EXPIRES_IN=3m

# PostgreSQL (docker-compose)
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=game_db
DB_PORT=5432

# Prisma
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/game_db

# Redis
REDIS_URL=redis://localhost:6379

# Opcionales para scripts de sincronizacion y Supabase Storage
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SYNC_BASE_DIR=
```

## Inicio Rapido

1. Instalar dependencias:

```bash
npm install
```

2. Levantar servicios locales:

```bash
docker compose up -d postgres redis
```

3. Aplicar migraciones y generar cliente Prisma:

```bash
npx prisma migrate dev
```

4. (Opcional) Seed de base de datos:

```bash
npx prisma db seed
```

5. Arrancar backend en desarrollo:

```bash
npm run dev
```

Servidor disponible en http://localhost:3000

## Documentacion

- Wiki del repositorio (recomendada): https://github.com/Unizar-30226-2026-11/Backend/wiki
- Swagger UI: http://localhost:3000/api-docs
- AsyncAPI: src/sockets/asyncapi.yaml

## Scripts Disponibles

| Script                  | Descripcion                                   |
| ----------------------- | --------------------------------------------- |
| npm run dev             | Levanta el backend en desarrollo con recarga. |
| npm run build           | Compila TypeScript a dist/.                   |
| npm run test            | Ejecuta tests con Jest.                       |
| npm run lint            | Lint de src/\*_/_.ts.                         |
| npm run lint:fix        | Lint + autocorreccion.                        |
| npm run format          | Formatea src/\*_/_.ts con Prettier.           |
| npm run sync            | Script general de sincronizacion (dev).       |
| npm run sync:prod       | Sincronizacion en build de produccion.        |
| npm run sync:cards      | Sincroniza cartas.                            |
| npm run sync:cards:seed | Backfill de imagenes seed de cartas.          |
| npm run sync:boards     | Sincroniza tableros.                          |

## Testing

Para ejecutar tests de forma estable, ten PostgreSQL y Redis levantados y un DATABASE_URL de desarrollo.

```bash
npm run test
```

No ejecutes la suite contra una base de datos de produccion.
