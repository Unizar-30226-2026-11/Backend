# Documentación de WebSockets — Backend

> **Versión:** 1.0.0  
> **Protocolo:** Socket.IO (sobre WebSocket nativo)  
> **Especificación formal de eventos:** [`asyncapi.yaml`](./asyncapi.yaml)

---

## Índice

1. [Visión general de la arquitectura](#1-visión-general-de-la-arquitectura)
2. [Arranque del servidor](#2-arranque-del-servidor)
3. [Autenticación y seguridad](#3-autenticación-y-seguridad)
4. [Sistema de Salas (Rooms)](#4-sistema-de-salas-rooms)
5. [Catálogo de eventos](#5-catálogo-de-eventos)
   - [5.1 Eventos del cliente al servidor](#51-eventos-del-cliente-al-servidor)
   - [5.2 Eventos del servidor al cliente](#52-eventos-del-servidor-al-cliente)
6. [Handlers de sockets](#6-handlers-de-sockets)
   - [6.1 Lobby Handler](#61-lobby-handler)
   - [6.2 Game Handler](#62-game-handler)
   - [6.3 Chat Handler](#63-chat-handler)
7. [Servicios relacionados con Sockets](#7-servicios-relacionados-con-sockets)
   - [7.1 LobbyService](#71-lobbyservice)
   - [7.2 GameService](#72-gameservice)
   - [7.3 GameRepository (Redis)](#73-gamerepository-redis)
8. [Worker de timeouts (BullMQ)](#8-worker-de-timeouts-bullmq)
9. [Flujos completos](#9-flujos-completos)
   - [9.1 Flujo de Lobby](#91-flujo-de-lobby)
   - [9.2 Flujo de inicio de partida](#92-flujo-de-inicio-de-partida)
   - [9.3 Flujo de acción de juego](#93-flujo-de-acción-de-juego)
   - [9.4 Flujo de chat](#94-flujo-de-chat)
10. [Decisiones de diseño e implementación](#10-decisiones-de-diseño-e-implementación)
11. [Guía de uso para el Frontend](#11-guía-de-uso-para-el-frontend)
12. [Scripts de prueba manual](#12-scripts-de-prueba-manual)

---

## 1. Visión general de la arquitectura

El backend combina un servidor HTTP Express con un servidor Socket.IO que comparten el mismo puerto (`3000`). La comunicación en tiempo real está organizada siguiendo un patrón de **canales de acción centralizado**: en lugar de tener decenas de eventos específicos para cada pequeña acción del juego, toda la lógica de juego fluye a través de **un único canal** (`client:game:action`) que lleva un campo `actionType`, y el motor de juego (`DixitEngine`) decide cómo procesar cada acción.

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENTE (Frontend)                        │
│  socket.emit("client:game:action", { actionType, lobbyCode, data }) │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ WebSocket (Socket.IO)
┌────────────────────────────────▼────────────────────────────────────┐
│                    BACKEND (src/sockets/handlers/)                  │
│  game.handlers.ts  →  GameService.handleAction()                    │
│                              │                                      │
│         ┌────────────────────┼────────────────────────┐            │
│         ▼                    ▼                         ▼            │
│    DixitEngine         GameRepository          BullMQ Queue         │
│  (lógica pura)         (Redis / estado)        (timers AFK)        │
│         │                    │                                      │
│         └────────────────────┼────────────────────────┘            │
│                              ▼                                      │
│         io.to(lobbyCode).emit("server:game:state_updated", {...})   │
│         io.to(playerId).emit("server:game:private_hand", {...})     │
└─────────────────────────────────────────────────────────────────────┘
```

### Archivos clave

| Archivo | Responsabilidad |
|---|---|
| `src/index.ts` | Bootstrap del servidor HTTP + Socket.IO |
| `src/sockets/handlers/index.ts` | Punto de entrada de todos los handlers y middleware |
| `src/sockets/events/index.ts` | Constantes únicas de todos los nombres de eventos |
| `src/sockets/events/types.ts` | Interfaces TypeScript de los payloads |
| `src/sockets/handlers/chat.handler.ts` | Lógica del chat en tiempo real |
| `src/sockets/handlers/lobby.handler.ts` | Lógica del lobby en tiempo real |
| `src/sockets/handlers/game.handlers.ts` | Canal unificado de acciones de juego |
| `src/api/middlewares/socket-auth.middleware.ts` | Autenticación JWT del handshake |
| `src/services/game.service.ts` | Orquestación del motor de juego y emisiones |
| `src/services/lobby.service.ts` | CRUD del Lobby contra Redis |
| `src/infrastructure/redis.ts` | Cliente Redis y `GameRepository` |
| `src/workers/game.worker.ts` | Worker BullMQ para timeouts AFK |

---

## 2. Arranque del servidor

El servidor Socket.IO **no** levanta un servidor HTTP propio. Se adjunta sobre el servidor HTTP de Express para compartir el mismo puerto.

```typescript
// src/index.ts
const httpServer = createServer(app);              // Express app → httpServer
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }  // ⚠️ Configurar en producción
});
setupSockets(io);       // Registra middleware y handlers de sockets
initializeGameWorker(io); // Arrancar el worker de BullMQ
httpServer.listen(PORT); // Un solo puerto para HTTP y WS
```

`setupSockets(io)` (en `src/sockets/handlers/index.ts`) es la función que registra el **middleware de autenticación** sobre todas las conexiones y luego los handlers por dominio.

---

## 3. Autenticación y seguridad

### Middleware: `authenticateSocket`

Cada conexión WebSocket pasa por el middleware `authenticateSocket` **antes** de llegar a cualquier handler. Si el token es inválido o está ausente, la conexión es rechazada.

```typescript
io.use(authenticateSocket);
```

#### Proceso de autenticación

1. **El cliente** envía el JWT en el objeto `auth` del handshake de Socket.IO:
   ```javascript
   const socket = io("http://localhost:3000", {
     auth: { token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
   });
   ```

2. **El middleware** extrae el token desde `socket.handshake.auth.token` y lo verifica con `jwt.verify()`.

3. Si es válido, **adjunta los datos del usuario directamente al socket**:
   ```typescript
   socket.user = { id: "u_16", username: "jugador42" };
   socket.data.lobbyCode = "A1B2"; // Extraído del JWT, inmutable
   ```

4. Si el token es inválido o ha expirado, se llama a `next(new Error("..."))` y la conexión se cancela.

#### Interfaz `AuthenticatedSocket`

Todos los handlers reciben un socket del tipo `AuthenticatedSocket`, que extiende `Socket` con los campos de usuario:

```typescript
export interface AuthenticatedSocket extends Socket {
  user?: { id: string; username: string; };
  data: { lobbyCode?: string; [key: string]: any; };
}
```

> **Decisión de seguridad clave:** El `lobbyCode` viene **del JWT**, no del cliente. Esto impide que un usuario malintencionado falsifique el código de sala al que pertenece.

---

## 4. Sistema de Salas (Rooms)

Socket.IO agrupa conexiones en **Salas (Rooms)**. El sistema utiliza dos tipos de salas:

| Sala | Identificador | Propósito |
|---|---|---|
| Sala de lobby | `lobbyCode` (ej: `"A1B2"`) | Difundir estado del lobby y mensajes de chat a todos los jugadores |
| Sala personal | `userId` (ej: `"u_16"`) | Enviar mensajes privados (manos de cartas, errores) solo a un jugador |

#### Cómo un cliente entra a las salas

Al conectarse, el servidor **automáticamente** une al socket a la sala personal del usuario:

```typescript
// src/sockets/handlers/index.ts
if (socket.user?.id) {
  socket.join(socket.user.id); // Sala personal: "u_16"
}
```

Para unirse a la **sala del lobby**, el cliente debe emitir manualmente el evento `joinLobbyRoom`:

```javascript
// Cliente
socket.emit("joinLobbyRoom", "A1B2");
```

Esto es un evento especial (no documentado en AsyncAPI) que el servidor recibe y ejecuta `socket.join(lobbyCode)`.

---

## 5. Catálogo de eventos

Los nombres de todos los eventos están centralizados en `src/sockets/events/index.ts` como constantes de TypeScript para evitar typos. Se dividen en tres grupos:

- **`CLIENT_EVENTS`**: Lo que el cliente envía al servidor.
- **`SERVER_EVENTS`**: Lo que el servidor envía al cliente.
- **`SOCKET_EVENTS`**: Eventos internos/de transición (ej: `game:started`).

### 5.1 Eventos del cliente al servidor

Estos eventos los **emite el cliente** (`socket.emit(...)`) y los **escucha el servidor** (`socket.on(...)`).

---

#### `client:lobby:join`

Solicita unirse al lobby. No requiere payload; el `lobbyCode` se extrae del token JWT del socket.

**Payload:** *(ninguno)*

**Respuesta del servidor:** `server:lobby:state_updated` → enviado a todos en la sala del lobby.

---

#### `client:lobby:leave`

El cliente abandona el lobby intencionalmente. No se implementa explícitamente como evento separado — la desconexión del socket (`disconnect`) actúa como trigger de salida.

**Payload:** *(ninguno)*

**Respuesta del servidor:** `server:lobby:state_updated` → enviado a los que quedan en la sala.

---

#### `client:lobby:start`

Solo puede emitirlo el host del lobby. Desencadena la creación del estado inicial del juego y el inicio de la partida.

**Payload:** *(ninguno)*

**Validaciones (en servidor):**
- El socket debe ser el `hostId` del lobby en Redis.
- Mínimo de 4 jugadores en el lobby.

**Respuesta del servidor (en caso de éxito):** `game:started` → enviado a todos en la sala.

**Respuesta del servidor (en caso de error):** `server:error` → enviado solo al emisor.

---

#### `client:game:action`

**El canal principal del juego.** Toda la interacción durante la partida fluye por este único evento. El servidor delega en `DixitEngine.transition()` para procesar la acción.

**Payload:**

```typescript
{
  lobbyCode: string;       // Código de 4 caracteres de la sala
  actionType: string;      // Tipo de acción (ver tabla abajo)
  payload?: any;           // Datos específicos de la acción
}
```

**Tipos de `actionType` válidos:**

| `actionType` | Fase del juego | Descripción | Datos en `payload` |
|---|---|---|---|
| `SUBMIT_STORY` | `STORYTELLING` | El narrador envía su pista y carta elegida | `{ cardId: number, clue: string }` |
| `PLAY_CARD` / `SUBMIT_CARD` | `SUBMISSION` | Los demás jugadores eligen su carta | `{ cardId: number }` |
| `VOTE_CARD` / `CAST_VOTE` | `VOTING` | Un jugador vota por una carta del tablero | `{ cardId: number }` |
| `NEXT_ROUND` | `SCORING` | Avanza a la siguiente ronda (generado por el worker AFK) | *(ninguno)* |

**Validación (Zod en servidor):**
```
lobbyCode → string con longitud exacta de 4
actionType → string (no vacío)
payload → any (opcional)
```

**Respuesta exitosa:** `server:game:state_updated` (público, a toda la sala) + `server:game:private_hand` (privado, a cada jugador).

**Respuesta de error:** `server:error` → solo al emisor del action inválido.

---

#### `client:chat:send`

Envía un mensaje al chat del lobby.

**Payload:**

```typescript
{
  lobbyCode: string;   // Exactamente 4 caracteres
  text: string;        // Entre 1 y 255 caracteres
}
```

**Validación (Zod en servidor):**
```
lobbyCode → string con length(4)
text → string con min(1) y max(255)
```

**Respuesta del servidor:** `server:chat:message_received` → enviado a **todos** los sockets en la sala `lobbyCode`.

---

### 5.2 Eventos del servidor al cliente

Estos eventos los **emite el servidor** (`io.to(...).emit(...)`) y los **escucha el cliente** (`socket.on(...)`).

---

#### `server:error`

Emitido **solo al cliente que provocó el error**. Se usa para errores de validación (Zod), errores de reglas de negocio del motor, o errores de permisos.

**Payload:**

```typescript
{
  message: string;   // Descripción legible del error
  code?: string;     // Código opcional de error interno
}
```

---

#### `server:lobby:state_updated`

Emitido a **todos los jugadores de la sala** cuando cambia el estado del lobby (alguien entra, alguien sale). El frontend debe re-renderizar la lista de jugadores al recibir esto.

**Payload:** El objeto completo del lobby tal y como está guardado en Redis.

```typescript
{
  lobbyCode: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  status: "waiting" | "playing";
  players: string[];    // Array de IDs de usuario: ["u_1", "u_5", ...]
  engine: string;
  isPrivate: boolean;
}
```

---

#### `server:game:state_updated`

**El evento más frecuente durante la partida.** Se emite a toda la sala después de cada acción procesada por `GameService.handleAction()`. Contiene el **estado público** de la partida — las manos de cartas y el mazo central han sido eliminados por seguridad.

**Payload:**

```typescript
{
  state: {             // Estado público del juego (sin manos ni mazo)
    lobbyCode: string;
    mode: string;
    players: string[];
    scores: Record<string, number>;
    phase: "LOBBY" | "STORYTELLING" | "SUBMISSION" | "VOTING" | "SCORING";
    currentRound: { ... };  // Datos del ronda actual
    discardPile: number[];
    disconnectedPlayers: string[];
  };
  lastAction: string;  // El actionType que provocó esta actualización
}
```

> **Nota de seguridad:** Los campos `hands` (manos de cartas) y `centralDeck` (mazo) son **eliminados** del estado antes de enviarlo por la sala general. Ver sección [Estado público vs. privado](#72-gameservice).

---

#### `server:game:private_hand`

Emitido **solo al socket personal de cada jugador** (a la sala `userId`) después de cada acción. Contiene su mano de cartas actualizada, que el servidor gestiona de forma privada.

**Payload:**

```typescript
{
  hand: number[];   // IDs de las cartas en la mano del jugador
}
```

---

#### `server:game:ended`

Emitido cuando el motor de juego determina que la partida ha terminado.

**Payload:** *(a definir según la lógica del motor)*

---

#### `server:chat:message_received`

Emitido a **todos los jugadores de la sala** cuando alguien envía un mensaje de chat.

**Payload:**

```typescript
{
  username: string;     // Nombre del usuario que envió el mensaje
  text: string;         // Contenido del mensaje
  timestamp: string;    // Fecha/hora ISO-8601: "2026-03-28T13:55:54.000Z"
}
```

---

#### `game:started` *(transitorio)*

Emitido a todos en la sala cuando el host inicia la partida. El frontend debe navegar a la pantalla de juego al recibirlo.

**Payload:**

```typescript
{
  lobbyCode: string;
}
```

---

#### `server:game:started` *(al inicio)*

Emitido por `GameService.initializeGame()` justo después de configurar el estado inicial. Es el primer evento de juego real.

**Payload:**

```typescript
{
  state: GameState;        // Estado público inicial (sin manos ni mazo)
  message: string;         // "¡La partida ha comenzado!"
}
```

---

## 6. Handlers de sockets

Los handlers son funciones registradas en `setupSockets()` que agrupan la lógica de eventos por dominio. Cada handler recibe `io` (la instancia global de Socket.IO para emitir a salas) y `socket` (la conexión individual autenticada).

### 6.1 Lobby Handler

**Archivo:** `src/sockets/handlers/lobby.handler.ts`

Gestiona el ciclo de vida de un jugador en la sala de espera:

| Evento escuchado | Lo que hace | Emite de vuelta |
|---|---|---|
| `client:lobby:join` | Llama `LobbyService.joinLobby()`, une al socket a la room del lobby | `server:lobby:state_updated` → a toda la sala |
| `client:lobby:start` | Valida que es el host, que hay ≥4 jugadores, llama `GameService.initializeGame()` | `game:started` → a toda la sala |
| `disconnect` | Llama `LobbyService.leaveLobby()`, si la sala sigue viva notifica a los demás | `server:lobby:state_updated` → a la sala (si quedan jugadores) |

> **Nota:** el evento `client:lobby:leave` no tiene un handler explícito propio. La desconexión del socket (intencional o por pérdida de red) activa el handler de `disconnect`, que lo gestiona todo.

### 6.2 Game Handler

**Archivo:** `src/sockets/handlers/game.handlers.ts`

Gestiona **toda** la interacción durante la partida mediante un único canal:

| Evento escuchado | Lo que hace |
|---|---|
| `client:game:action` | Valida el payload con Zod, extrae el `userId` del socket autenticado, construye un `GameAction` y llama a `GameService.handleAction()` |

**Flujo interno de `client:game:action`:**
```
1. Zod valida { lobbyCode, actionType, payload }
2. Se extrae socket.user.id como playerId (no puede ser falsificado)
3. Se construye: const action = { type: actionType, playerId, payload }
4. Se llama: await gameService.handleAction(lobbyCode, action)
5. GameService actualiza Redis y emite los estados público y privado
```

### 6.3 Chat Handler

**Archivo:** `src/sockets/handlers/chat.handler.ts`

| Evento escuchado | Lo que hace |
|---|---|
| `client:chat:send` | Valida el payload con Zod (lobbyCode de 4 chars, texto 1-255 chars), construye el `ChatMessageReceivedPayload` con el username real del socket, emite a toda la sala |

---

## 7. Servicios relacionados con Sockets

### 7.1 LobbyService

**Archivo:** `src/services/lobby.service.ts`  
**Almacenamiento:** Redis (clave `lobby:{code}`, TTL de 2 horas)

Es un servicio **stateless** que actúa de capa de acceso a datos del lobby en Redis. Los sockets lo usan para leer y mutar el estado de la sala.

| Método | Descripción |
|---|---|
| `create(data)` | Genera un código aleatorio de 4 chars, guarda el lobby en Redis y, si es público, lo añade al Set `public_lobbies` |
| `findByCode(code)` | Lee y deserializa el lobby de Redis por su código |
| `getLobbyByCode(code)` | Alias de `findByCode` (equivalentes) |
| `findPublic(searchQuery?)` | Lista todas las salas públicas con estado `"waiting"` del Set de Redis, filtrando opcionalmente por nombre |
| `joinLobby(code, userId)` | Añade al jugador al array `players` si hay hueco y aún no está dentro |
| `leaveLobby(code, userId)` | Elimina al jugador del array `players`; si la sala queda vacía, la elimina de Redis |

**Por qué está en Redis y no en la base de datos (Prisma):**  
Los lobbies son datos temporales y de alta frecuencia de escritura. Redis permite TTL automáticos (las salas se limpian solas si la gente abandona) y lecturas/escrituras en microsegundos, lo cual es crítico para el tiempo real.

---

### 7.2 GameService

**Archivo:** `src/services/game.service.ts`  
**Instanciación:** Una instancia nueva por conexión de socket (`new GameService(io)` en cada handler).

Es el **orquestador central** de la partida. Conecta el motor de reglas puro (`DixitEngine`) con la infraestructura (Redis, BullMQ, Socket.IO).

#### `initializeGame(lobbyCode, lobbyData)`

Llamado una única vez al inicio de la partida.

```
1. Lee los mazos de cartas de los jugadores desde Prisma (tabla Deck → Cards)
2. Si hay pocas cartas (<20), rellena con cartas comodín de la tabla Cards
3. Baraja el mazo con el algoritmo de Fisher-Yates
4. Construye el estado base (scores, hands vacías, mazo central)
5. Pasa el estado base a DixitEngine.transition(state, { type: 'INIT_GAME' })
6. Guarda el estado inicial en Redis (GameRepository.saveGameState)
7. Emite 'server:game:started' con el estado PÚBLICO a toda la sala
8. Emite 'server:game:private_hand' a la sala personal de CADA jugador
9. Programa el timeout inicial de la fase (60 segundos) en BullMQ
```

#### `handleAction(lobbyCode, action)`

Llamado en cada interacción de un jugador durante la partida.

```
1. Lee el estado actual desde Redis (GameRepository.getGameState)
2. Ejecuta DixitEngine.transition(currentState, action) → newState
3. Guarda newState en Redis (sobrescribe el anterior)
4. Genera publicState = maskPrivateState(newState)
5. Emite 'server:game:state_updated' (estado público) a toda la sala
6. Bucle: emite 'server:game:private_hand' a la sala personal de cada jugador
7. Si la fase cambió, programa un nuevo timeout en BullMQ
```

#### Estado público vs. privado (`maskPrivateState`)

Por razones de integridad del juego, dos campos del `GameState` **nunca se envían** a la sala general:

```typescript
private maskPrivateState(state: GameState): Partial<GameState> {
  const publicState = structuredClone(state);
  delete (publicState as any).centralDeck;  // Nadie puede ver el mazo completo
  delete (publicState as any).hands;        // Nadie puede ver las cartas de los demás
  return publicState;
}
```

Las manos de cada jugador solo se envían de forma privada a través de la sala personal (`io.to(playerId).emit("server:game:private_hand", ...)`).

#### Timeouts de fase (`schedulePhaseTimeout`)

Cada vez que la partida entra en una nueva fase, se programa un job retrasado en BullMQ:

| Fase | Tiempo límite |
|---|---|
| `STORYTELLING` | 60 segundos |
| `SUBMISSION` | 45 segundos |
| `VOTING` | 45 segundos |
| `SCORING` | 10 segundos |

---

### 7.3 GameRepository (Redis)

**Archivo:** `src/infrastructure/redis.ts`

Encapsula la lectura y escritura del estado del juego en Redis para mantener el `GameService` limpio.

| Método | Clave Redis | TTL |
|---|---|---|
| `saveGameState(code, state)` | `game:{lobbyCode}` | 2 horas |
| `getGameState(code)` | `game:{lobbyCode}` | — |
| `deleteGameState(code)` | `game:{lobbyCode}` | — |

El estado se serializa como JSON en Redis. La clave `lobby:{code}` (para lobbies) y `game:{code}` (para partidas en curso) son distintas.

---

## 8. Worker de timeouts (BullMQ)

**Archivo:** `src/workers/game.worker.ts`  
**Cola:** `game-timeouts`

El worker vigila a los jugadores AFK. Cuando un job de BullMQ se dispara (el timeout de una fase expira), el worker comprueba si la partida **sigue en la misma fase** y, si es así, actúa como un bot completando la acción por los jugadores que no actuaron a tiempo.

| Fase en timeout | Acción automática |
|---|---|
| `STORYTELLING` | Si el narrador no envió pista, elige una carta al azar de su mano y genera una pista genérica |
| `SUBMISSION` | Por cada jugador que no jugó carta, elige una carta aleatoria de su mano |
| `VOTING` | Por cada jugador que no votó, vota aleatoriamente una carta que no sea la suya |
| `SCORING` | Emite la acción `NEXT_ROUND` automáticamente para avanzar la ronda |

> **Nota importante:** Antes de actuar, el worker comprueba que `state.phase === expectedPhase`. Si la fase ya avanzó (porque los jugadores actuaron a tiempo), el job se descarta sin hacer nada.

---

## 9. Flujos completos

### 9.1 Flujo de Lobby

```
[Cliente]                              [Servidor]                [Redis]
    │                                       │                       │
    ├─ io({auth: {token}}) ─────────────────▶ authenticateSocket()  │
    │                                       │  (valida JWT,         │
    │                                       │   adjunta user+code)  │
    │                                  conectado                    │
    ├─ emit("joinLobbyRoom", "A1B2") ───────▶ socket.join("A1B2")   │
    │                                       │                       │
    ├─ emit("client:lobby:join") ───────────▶ LobbyService           │
    │                                       │   .joinLobby() ───────▶ SET lobby:A1B2
    │                                       │                       │
    │  ◀── emit("server:lobby:state_updated", lobby) ─── io.to("A1B2")
```

### 9.2 Flujo de inicio de partida

```
[Host]                                 [Servidor]                [Redis/Prisma]
    │                                       │                       │
    ├─ emit("client:lobby:start") ─────────▶ lobby.handler          │
    │                                       │  valida host + 4      │
    │                                       │  jugadores mínimo     │
    │                                       │                       │
    │                                       ├─ GameService           │
    │                                       │   .initializeGame ─────▶ Prisma.deck.findMany
    │                                       │                        ▶ GameRepo.saveGameState
    │                                       │                       │
    │ ◀─ emit("game:started") ──────────────── io.to("A1B2")        │
    │ ◀─ emit("server:game:started", pub) ── io.to("A1B2")          │
    │ ◀─ emit("server:game:private_hand") ── io.to("u_16")          │
```

### 9.3 Flujo de acción de juego

```
[Jugador]                              [Servidor]                   [Redis]
    │                                       │                          │
    ├─ emit("client:game:action", ─────────▶ game.handlers            │
    │         {lobbyCode, actionType,       │  Zod.safeParse()         │
    │          payload})                    │                          │
    │                                       ├─ GameService.handleAction │
    │                                       │   getGameState() ─────────▶ GET game:A1B2
    │                                       │   DixitEngine.transition()│
    │                                       │   saveGameState() ────────▶ SET game:A1B2
    │                                       │   maskPrivateState()     │
    │                                       │                          │
    │ ◀─ emit("server:game:state_updated") ─ io.to("A1B2")            │
    │ ◀─ emit("server:game:private_hand") ── io.to("u_1") [por cada jugador]
```

### 9.4 Flujo de chat

```
[Jugador A]                            [Servidor]               [Sala A1B2]
    │                                       │                        │
    ├─ emit("client:chat:send", ───────────▶ chat.handler            │
    │         {lobbyCode, text})            │  Zod.safeParse()        │
    │                                       │  construye payload      │
    │                                       │                        │
    │ ◀─ emit("server:chat:message_received") ──────────── io.to("A1B2") ──▶ [Jugador B, C...]
```

---

## 10. Decisiones de diseño e implementación

### Canal unificado de acciones (`client:game:action`)

En lugar de definir un evento por cada acción del juego (`play-card`, `vote`, `submit-story`...), se usa un único canal con un campo `actionType`. Esto simplifica:
- La adición de nuevas acciones sin cambiar la interfaz del socket.
- El tipado: un solo schema Zod en el handler del servidor.
- El testing: se testea un solo handler de entrada.

### Separación estado público / privado

El `GameState` completo (con manos de todos los jugadores) **nunca** se envía a la sala de lobby. `GameService.maskPrivateState()` elimina `hands` y `centralDeck` antes de difundir. Las manos se envían individualmente a cada jugador a través de su sala personal (`io.to(userId)`). Esto impide que un jugador espíe las cartas de los demás interceptando el tráfico de red.

### Redis como base de datos de partidas en curso

El estado vivo de una partida es un objeto JSON mutable. Se eligió Redis porque:
1. Las lecturas y escrituras son de microsegundos, crítico para el bucle de juego en tiempo real.
2. El TTL automático (2 horas) limpia las partidas abandonadas sin cron jobs.
3. Permite que un futuro Worker o servidor independiente acceda al mismo estado (escalabilidad horizontal).

### BullMQ para gestión de timeouts

Los timeouts de fase no se gestionan con `setTimeout()` de Node.js porque:
1. Un servidor reiniciado perdería todos los timers en memoria.
2. BullMQ persiste los jobs en Redis, sobreviviendo a reinicios.
3. El worker comprueba idempotentemente si la fase sigue siendo la esperada, evitando dobles ejecuciones.

### Autenticación por JWT en el handshake

El token JWT se envía en `socket.handshake.auth.token` (estándar de Socket.IO) en lugar de en una cabecera HTTP, porque los WebSockets no admiten cabeceras personalizadas en el upgrade. El middleware extrae el `lobbyCode` del propio JWT, haciéndolo **inmutable**: ningún cliente puede cambiar a qué sala pertenece después de conectarse.

---

## 11. Guía de uso para el Frontend

### Conexión inicial

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  auth: {
    token: localStorage.getItem("jwt_token"), // Token JWT del login
  },
  transports: ["websocket"], // Forzar WebSocket puro (sin polling)
});
```

### Unirse a la sala del lobby

Después de conectar, el cliente debe solicitar entrar a la sala del lobby:

```javascript
socket.on("connect", () => {
  socket.emit("joinLobbyRoom", "A1B2"); // El código de la sala
  socket.emit("client:lobby:join");     // Notificar al servidor que has llegado
});
```

### Escuchar los estados del juego

```javascript
// Estado público de la partida (todos lo reciben)
socket.on("server:game:state_updated", ({ state, lastAction }) => {
  renderGameBoard(state); // Re-renderizar el tablero
});

// Mano privada del jugador (solo yo la recibo)
socket.on("server:game:private_hand", ({ hand }) => {
  renderMyHand(hand);     // Mostrar mis cartas
});
```

### Enviar una acción de juego

```javascript
// Ejemplo: el narrador envía su historia
socket.emit("client:game:action", {
  lobbyCode: "A1B2",
  actionType: "SUBMIT_STORY",
  payload: {
    cardId: 42,
    clue: "Una tarde de verano",
  },
});

// Ejemplo: un jugador normal juega una carta
socket.emit("client:game:action", {
  lobbyCode: "A1B2",
  actionType: "PLAY_CARD",
  payload: { cardId: 17 },
});
```

### Manejo de errores

```javascript
socket.on("server:error", ({ message }) => {
  showNotification("Error: " + message); // Mostrar al usuario
});

socket.on("connect_error", (err) => {
  console.error("Conexión rechazada:", err.message);
  // Probablemente el JWT ha expirado → redirigir a login
});
```

### Eventos de ciclo de vida

```javascript
socket.on("game:started", ({ lobbyCode }) => {
  navigateTo("/game/" + lobbyCode); // Cambiar de pantalla
});

socket.on("server:lobby:state_updated", (lobby) => {
  updatePlayerList(lobby.players); // Actualizar lista de jugadores
});

socket.on("server:chat:message_received", ({ username, text, timestamp }) => {
  appendChatMessage(username, text, timestamp);
});
```

---

## 12. Scripts de prueba manual

Existen dos scripts de TypeScript en `src/sockets/tests_sockets/` para verificar que los flujos de chat y de juego funcionan correctamente sin necesitar el frontend.

### Prerequisitos

- El servidor (`npm run dev`) debe estar corriendo.
- Necesitas un JWT válido devuelto por el endpoint de login (`POST /auth/login`).

### `test-chat-client.ts` — Prueba de chat

```bash
npx ts-node src/sockets/tests_sockets/test-chat-client.ts
```

**Editar antes de ejecutar:**
```typescript
const LOBBY_CODE = 'A1B2';     // Código de un lobby existente en Redis
const JWT_TOKEN = '...';       // Token JWT de un usuario registrado
```

**Qué hace:**
1. Se conecta al servidor con el JWT.
2. Se une a la sala `A1B2`.
3. Espera 2 segundos y envía un mensaje de chat.
4. Escucha `server:chat:message_received` e imprime el resultado.
5. Se desconecta.

**Prueba de error:** cambia `LOBBY_CODE = 'A1'` (solo 2 letras) para ver cómo Zod rechaza el payload y devuelve `server:error`.

---

### `test-game-client.ts` — Prueba de inicio de partida

```bash
npx ts-node src/sockets/tests_sockets/test-game-client.ts
```

**Editar antes de ejecutar:**
```typescript
const LOBBY_CODE = 'TEST';     // Código de lobby
const JWT_TOKEN = '...';       // Token JWT
```

**Qué hace:**
1. Se conecta y se une a la sala.
2. Emite `client:game:start` al cabo de 1 segundo.
3. Escucha `server:game:started` (estado público) y verifica que `hands` no aparece en el estado global (prueba de seguridad).
4. Escucha `server:game:private_hand` con su mano privada de cartas.
