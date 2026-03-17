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
