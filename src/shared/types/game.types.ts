/**
 * Modos de juego disponibles.
 */
export type GameMode = 'STANDARD' | 'STELLA';

/**
 * Fases posibles agrupadas por lógica.
 */
export type StandardPhase =
  | 'STORYTELLING'
  | 'SUBMISSION'
  | 'VOTING'
  | 'SCORING'
  | 'FINISHED';
export type StellaPhase =
  | 'STELLA_WORD_REVEAL'
  | 'STELLA_MARKING'
  | 'STELLA_REVEAL'
  | 'SCORING'
  | 'FINISHED';

/**
 * Voto estándar de Dixit.
 */
export interface Vote {
  voterId: string;
  targetCardId: number;
}

// ==========================================
// ESTRUCTURAS DE RONDA
// ==========================================

export interface StandardRound {
  storytellerId: string;
  clue: string | null;
  storytellerCardId: number | null;
  playedCards: Record<string, number>; // { ID_Jugador: ID_Carta }
  boardCards: number[];
  votes: Vote[];
}

export interface StellaRound {
  word: string | null; // La palabra clave de la ronda
  boardCards: number[]; // Siempre 15 cartas en Stella
  playerMarks: Record<string, number[]>; // { ID_Jugador: [ID_Carta1, ID_Carta2...] }
  revealedCards: number[]; // Cartas que se van revelando una a una
  currentScoutId: string | null; // Jugador al que le toca revelar una marca
  fallenPlayers: string[]; // Jugadores que se pasaron marcando (oscuridad)
}

// ==========================================
// ESTADO DEL JUEGO (UNIÓN DISCRIMINADA)
// ==========================================

interface BaseGameState {
  lobbyCode: string;
  status: 'playing' | 'finished';
  players: string[];
  disconnectedPlayers: string[];
  winners?: string[];
  scores: Record<string, number>;
  hands: Record<string, number[]>;
  centralDeck: number[];
  discardPile: number[];
}

export interface StandardGameState extends BaseGameState {
  mode: 'STANDARD';
  phase: StandardPhase;
  currentRound: StandardRound;
}

export interface StellaGameState extends BaseGameState {
  mode: 'STELLA';
  phase: StellaPhase;
  currentRound: StellaRound;
}

/**
 * El estado global que usará el motor. TypeScript inferirá el tipo de 'currentRound'
 * y 'phase' dependiendo del valor que tenga 'mode'.
 */
export type GameState = StandardGameState | StellaGameState;

// ==========================================
// ACCIONES (UNIÓN DISCRIMINADA)
// ==========================================

// Acciones Globales
export interface ActionInitGame {
  type: 'INIT_GAME';
  playerId: string;
  payload: { deck: number[] };
}
export interface ActionDisconnect {
  type: 'DISCONNECT_PLAYER';
  playerId: string;
}
export interface ActionReconnect {
  type: 'RECONNECT_PLAYER';
  playerId: string;
}
export interface ActionNextRound {
  type: 'NEXT_ROUND';
  playerId: string;
}
export interface ActionChangeMode {
  type: 'CHANGE_MODE';
  playerId: string;
  payload: { mode: GameMode };
}

// Acciones Standard
export interface ActionSendStory {
  type: 'SEND_STORY';
  playerId: string;
  payload: { cardId: number; clue: string };
}
export interface ActionSubmitCard {
  type: 'SUBMIT_CARD';
  playerId: string;
  payload: { cardId: number };
}
export interface ActionCastVote {
  type: 'CAST_VOTE';
  playerId: string;
  payload: { cardId: number };
}

// Acciones Stella
export interface ActionStellaSubmitMarks {
  type: 'STELLA_SUBMIT_MARKS';
  playerId: string;
  payload: { cardIds: number[] };
}
export interface ActionStellaRevealMark {
  type: 'STELLA_REVEAL_MARK';
  playerId: string;
  payload: { cardId: number };
}

export type GameAction =
  | ActionInitGame
  | ActionDisconnect
  | ActionReconnect
  | ActionNextRound
  | ActionChangeMode
  | ActionSendStory
  | ActionSubmitCard
  | ActionCastVote
  | ActionStellaSubmitMarks
  | ActionStellaRevealMark;
