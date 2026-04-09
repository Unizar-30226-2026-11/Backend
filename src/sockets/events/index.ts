// sockets/events — Canonical event name constants
// Import these in both handlers (emit) and client code to avoid string typos.

export const SOCKET_EVENTS = {
  // Lobby
  LOBBY_UPDATED: 'lobby:updated',
  LOBBY_PLAYER_JOINED: 'lobby:player_joined',
  LOBBY_PLAYER_LEFT: 'lobby:player_left',
  // Game
  GAME_STARTED: 'game:started',
  GAME_STATE_UPDATED: 'game:state_updated',
  GAME_ENDED: 'game:ended',
} as const;

/**
 * Eventos que el CLIENTE envía al SERVIDOR (Subida)
 */
export const CLIENT_EVENTS = {
  // Lobby
  LOBBY_JOIN: 'client:lobby:join',
  LOBBY_LEAVE: 'client:lobby:leave',
  LOBBY_START: 'client:lobby:start', // El host pide iniciar

  // Game (Aquí está la magia de la nueva arquitectura)
  // En lugar de tener un evento para cada pequeña cosa, tenemos un canal de acciones.
  GAME_ACTION: 'client:game:action',

  // Chat
  CHAT_SEND: 'client:chat:send',
} as const;

/**
 * Eventos que el SERVIDOR envía al CLIENTE (Bajada)
 */
export const SERVER_EVENTS = {
  // Generales
  ERROR: 'server:error',

  // Lobby
  LOBBY_STATE_UPDATED: 'server:lobby:state_updated',

  // Game
  // El motor calcula todo, guarda en Redis, y el socket emite esta "foto" de la partida.
  GAME_STATE_UPDATED: 'server:game:state_updated',
  GAME_ENDED: 'server:game:ended',

  DECK_RESHUFFLED: 'server:game:deck_reshuffled', //Animación visual: El mazo de descartes se ha mezclado y vuelve al mazo central.
  PRIVATE_HAND: 'server:game:private_hand', //Tus cartas acaban de cambiar (por robar en nuevo turno o por caer en Shuffle).
  DUEL_AVAILABLE: 'server:game:duel_available', //Has caído en la casilla de apuestas. Muestra un menú (Modal) para elegir a qué jugador de la partida quieres atacar.
  SPECIAL_EVENT: 'server:game:special_event', //Un jugador ha activado una casilla. Mostrar animación en su ficha y pintar un aviso en pantalla.
  GAME_ERROR: 'server:game:error', //Has intentado hacer algo ilegal (ej. jugar carta durante un minijuego activo). Mostrar Toast/Alerta de error.
  // Chat
  CHAT_MESSAGE_RECEIVED: 'server:chat:message_received',

  // NUEVOS EVENTOS DE RECONEXIÓN
  SESSION_RECOVERED: 'server:session:recovered', // Partida en curso
  LOBBY_RECOVERED: 'server:lobby:recovered', // Estaba en la sala de espera
  FORCE_DISCONNECT: 'server:force_disconnect', // Multitab
} as const;

// Tipos extraídos de las constantes para usarlos en las interfaces
export type ClientEvent = (typeof CLIENT_EVENTS)[keyof typeof CLIENT_EVENTS];
export type ServerEvent = (typeof SERVER_EVENTS)[keyof typeof SERVER_EVENTS];
