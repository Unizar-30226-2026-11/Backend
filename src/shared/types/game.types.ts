/**
 * Modos de juego disponibles en la aplicacion.
 * STANDARD: Basado en las reglas clasicas de Dixit.
 * STELLA: Basado en las reglas del juego Stella (variante del universo Dixit).
 */
export type GameMode = 'STANDARD' | 'STELLA';

/**
 * Fases posibles del flujo de juego estandar (Dixit), agrupadas por logica.
 * - STORYTELLING: El cuentacuentos elige una carta de su mano y da una pista.
 * - SUBMISSION: Los demas jugadores eligen una carta de su mano que coincida con la pista.
 * - VOTING: Los jugadores (excepto el cuentacuentos) votan por la carta que creen que es la original.
 * - SCORING: Resolucion de la ronda y reparto de puntos.
 * - FINISHED: Partida terminada, se muestran los ganadores.
 */
export type StandardPhase =
  | 'STORYTELLING'
  | 'SUBMISSION'
  | 'VOTING'
  | 'SCORING'
  | 'FINISHED';

/**
 * Fases posibles del flujo de juego modo Stella.
 * - STELLA_WORD_REVEAL: Se revela la palabra clave de la ronda.
 * - STELLA_MARKING: Los jugadores seleccionan en secreto las cartas asociadas a la palabra.
 * - STELLA_REVEAL: Fase de turnos donde los jugadores van revelando sus marcas.
 * - SCORING: Resolucion de la ronda y sumatoria de puntos temporales al global.
 * - FINISHED: Partida terminada al alcanzar la condicion de victoria.
 */
export type StellaPhase =
  | 'STELLA_WORD_REVEAL'
  | 'STELLA_MARKING'
  | 'STELLA_REVEAL'
  | 'SCORING'
  | 'FINISHED';

/**
 * Representa el voto de un jugador en el modo estandar de Dixit.
 */
export interface Vote {
  /** ID del jugador que emite el voto */
  voterId: string;
  /** ID de la carta por la que esta votando */
  targetCardId: number;
}

/**
 * Define un modificador temporal aplicado a un jugador.
 */
export interface ModifierData {
  /** Tipo de modificador */
  type: 'HAND_LIMIT';
  /** Valor del modificador en cartas */
  value: number;
  /** Turnos restantes antes de que el modificador desaparezca */
  turnsLeft: number;
}

/**
 * Oferta temporal para cambiar el modo de juego durante la fase actual.
 */
export interface PendingModeChangeOffer {
  /** Jugador autorizado a aceptar la oferta */
  playerId: string;
  /** Version de fase en la que nacio la oferta */
  phaseVersion: number;
}

// ==========================================
// ESTRUCTURAS DE RONDA
// ==========================================

/**
 * Almacena el estado transitorio exclusivo de una ronda en el modo STANDARD.
 */
export interface StandardRound {
  /** ID del jugador que actua como cuentacuentos en esta ronda */
  storytellerId: string;
  /** Pista o frase proporcionada por el cuentacuentos */
  clue: string | null;
  /** ID de la carta real jugada por el cuentacuentos */
  storytellerCardId: number | null;
  /** Mapeo de cartas enviadas a la mesa */
  playedCards: Record<string, number>;
  /** Lista de IDs de las cartas que se muestran en la mesa para ser votadas */
  boardCards: number[];
  /** Registro de todos los votos emitidos en la ronda actual */
  votes: Vote[];
}

/**
 * Almacena el estado transitorio exclusivo de una ronda en el modo STELLA.
 */
export interface StellaRound {
  /** La palabra clave comun de la ronda */
  word: string | null;
  /** Cartas dispuestas en la mesa */
  boardCards: number[];
  /** Diccionario con las selecciones secretas de cada jugador */
  playerMarks: Record<string, number[]>;
  /** Registro historico de las cartas ya reveladas */
  revealedCards: number[];
  /** ID del jugador que tiene el turno actual para revelar */
  currentScoutId: string | null;
  /** Lista de IDs de jugadores que se han caido en esta ronda */
  fallenPlayers: string[];
  /** ID del jugador que hizo estrictamente mas marcas que los demas */
  inTheDarkPlayerId: string | null;
  /** Marcador temporal de los puntos obtenidos en la ronda */
  roundScores: Record<string, number>;
  /** Contador de aciertos acumulados en la ronda */
  successfulMarks: Record<string, number>;
}

// ==========================================
// ESTADO DEL JUEGO
// ==========================================

interface BaseGameState {
  /** Codigo unico de la sala/lobby */
  lobbyCode: string;
  /** Estado general del ciclo de vida de la partida */
  status: 'playing' | 'finished';
  /** Lista de IDs de los jugadores presentes en la partida */
  players: string[];
  /** Lista de IDs de jugadores que han perdido la conexion */
  disconnectedPlayers: string[];
  /** Lista de IDs de los jugadores que han ganado */
  winners?: string[];
  /** Marcador global del juego */
  scores: Record<string, number>;
  /** Cartas que cada jugador tiene en su mano privada */
  hands: Record<string, number[]>;
  /** Mazo central del que se roban las cartas */
  centralDeck: number[];
  /** Pila de descartes */
  discardPile: number[];
  /** Registro de visitas a casillas especiales */
  boardRegistry: Record<number, string[]>;
  /** Indica si hay una estrella fugaz activa en pantalla */
  isStarActive: boolean;
  /** Timestamp de cuando debe desaparecer la estrella */
  starExpiresAt: number;
  /** Version monotona de fase/ronda */
  phaseVersion: number;
  /** Modificadores temporales activos por jugador */
  activeModifiers: Record<string, ModifierData>;
  /** Oferta pendiente para cambiar de modo */
  pendingModeChangeOffer?: PendingModeChangeOffer | null;
  /** Indica si hay un minijuego de conflicto activo */
  isMinigameActive: boolean;
  /** Conflicto activo */
  activeConflict?: {
    player1: string;
    player2: string;
    isDuel: boolean;
    scores?: Record<string, number>;
  } | null;
  /** Diccionario en memoria con las URLs de las cartas de la partida */
  cardUrls: Record<number, string>;
}

/**
 * Estado completo del juego cuando se encuentra en modo STANDARD.
 */
export interface StandardGameState extends BaseGameState {
  mode: 'STANDARD';
  phase: StandardPhase;
  currentRound: StandardRound;
}

/**
 * Estado completo del juego cuando se encuentra en modo STELLA.
 */
export interface StellaGameState extends BaseGameState {
  mode: 'STELLA';
  phase: StellaPhase;
  currentRound: StellaRound;
}

/**
 * Estado global del juego.
 */
export type GameState = StandardGameState | StellaGameState;

// ==========================================
// ACCIONES
// ==========================================

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

export interface ActionKick {
  type: 'KICK_PLAYER';
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

export interface ActionClaimStar {
  type: 'CLAIM_STAR';
  playerId: string;
}

export interface ActionResolveDuel {
  type: 'RESOLVE_DUEL';
  playerId: string;
  payload: { targetId: string };
}

export interface ActionSubmitMinigameScore {
  type: 'SUBMIT_MINIGAME_SCORE';
  playerId: string;
  payload: { score: number };
}

export interface ActionAcceptModeChange {
  type: 'ACCEPT_MODE_CHANGE';
  playerId: string;
  payload?: never;
}

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
  | ActionKick
  | ActionNextRound
  | ActionChangeMode
  | ActionClaimStar
  | ActionResolveDuel
  | ActionSendStory
  | ActionSubmitCard
  | ActionCastVote
  | ActionStellaSubmitMarks
  | ActionStellaRevealMark
  | ActionSubmitMinigameScore
  | ActionAcceptModeChange;
