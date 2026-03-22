/**
 * Fases posibles dentro de una partida de Dixit.
 */
export type GamePhase =
  | 'STORYTELLING' // El narrador elige carta y pista.
  | 'SUBMISSION' // Los demás jugadores aportan sus cartas.
  | 'VOTING' // Los jugadores intentan adivinar la carta original.
  | 'SCORING' // Se calculan los puntos obtenidos en la ronda.
  | 'FINISHED'; // La partida ha concluido.

/**
 * Representa un voto emitido hacia una carta específica.
 */
export interface Vote {
  voterId: string;
  targetCardId: number;
}

/**
 * Estado completo de la partida.
 */
export interface GameState {
  lobbyCode: string;
  status: 'playing' | 'finished';
  phase: GamePhase;
  players: string[];
  disconnectedPlayers: string[]; // Registro de jugadores que han perdido la conexión.
  winners?: string[]; // Jugadores que han ganado (soporta empates).
  scores: Record<string, number>;
  hands: Record<string, number[]>;
  centralDeck: number[];
  discardPile: number[];
  currentRound: {
    storytellerId: string;
    clue: string | null;
    storytellerCardId: number | null;
    playedCards: Record<string, number>; // Mapa de { ID_Jugador: ID_Carta }.
    boardCards: number[]; // Cartas en la mesa barajadas para la votación.
    votes: Vote[];
  };
}

/**
 * Acciones que pueden modificar el estado del juego.
 */
export interface GameAction {
  type:
    | 'INIT_GAME'
    | 'SEND_STORY'
    | 'SUBMIT_CARD'
    | 'CAST_VOTE'
    | 'NEXT_ROUND'
    | 'DISCONNECT_PLAYER'
    | 'RECONNECT_PLAYER';
  playerId: string;
  payload?: any;
}

/**
 * Motor lógico de Dixit.
 * Gestiona transiciones de estado, reglas de puntuación y eventos de red.
 */
export class DixitEngine {
  /**
   * Punto de entrada para transformar el estado actual basado en una acción.
   */
  static transition(currentState: GameState, action: GameAction): GameState {
    // Clonamos el estado para asegurar la inmutabilidad durante la transición.
    const newState = JSON.parse(JSON.stringify(currentState)) as GameState;

    switch (action.type) {
      case 'INIT_GAME':
        return this.handleInitGame(newState, action);
      case 'SEND_STORY':
        return this.handleSendStory(newState, action);
      case 'SUBMIT_CARD':
        return this.handleSubmitCard(newState, action);
      case 'CAST_VOTE':
        return this.handleCastVote(newState, action);
      case 'NEXT_ROUND':
        return this.handleNextRound(newState);
      case 'DISCONNECT_PLAYER':
        return this.handleDisconnect(newState, action);
      case 'RECONNECT_PLAYER':
        return this.handleReconnect(newState, action);
      default:
        throw new Error(`Acción desconocida: ${action.type}`);
    }
  }

  /**
   * Configura el inicio de la partida, baraja el mazo y reparte manos.
   */
  private static handleInitGame(
    state: GameState,
    action: GameAction,
  ): GameState {
    if (state.players.length < 4) {
      throw new Error('Se requieren al menos 4 jugadores para iniciar.');
    }

    const allCardIds: number[] = action.payload.deck;
    if (!allCardIds || allCardIds.length < state.players.length * 6) {
      throw new Error('Mazo insuficiente.');
    }

    // Baraja el mazo inicial utilizando el algoritmo Fisher-Yates.
    const deck = [...allCardIds];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    state.centralDeck = deck;
    state.discardPile = [];
    state.disconnectedPlayers = [];
    state.scores = {};
    state.hands = {};

    // Inicializa puntuaciones y reparte las 6 cartas iniciales por jugador.
    for (let i = 0; i < state.players.length; i++) {
      const pId = state.players[i];
      state.scores[pId] = 0;
      state.hands[pId] = state.centralDeck.splice(-6);
    }

    // Elige aleatoriamente quién empieza como narrador.
    const firstStorytellerIndex = Math.floor(
      Math.random() * state.players.length,
    );

    state.currentRound = {
      storytellerId: state.players[firstStorytellerIndex],
      clue: null,
      storytellerCardId: null,
      playedCards: {},
      boardCards: [],
      votes: [],
    };

    state.status = 'playing';
    state.phase = 'STORYTELLING';

    return state;
  }

  /**
   * Marca a un jugador como desconectado.
   */
  private static handleDisconnect(
    state: GameState,
    action: GameAction,
  ): GameState {
    if (!state.disconnectedPlayers.includes(action.playerId)) {
      state.disconnectedPlayers.push(action.playerId);
    }
    // Verifica si la desconexión permite avanzar de fase (ej: si era el único que faltaba por votar).
    this.checkPhaseAdvancement(state);
    return state;
  }

  /**
   * Restaura a un jugador a la lista de activos.
   */
  private static handleReconnect(
    state: GameState,
    action: GameAction,
  ): GameState {
    state.disconnectedPlayers = state.disconnectedPlayers.filter(
      (id) => id !== action.playerId,
    );
    this.checkPhaseAdvancement(state);
    return state;
  }

  /**
   * Impide que un jugador desconectado realice acciones hasta que reconecte.
   */
  private static validatePlayerActive(state: GameState, playerId: string) {
    if (state.disconnectedPlayers.includes(playerId)) {
      throw new Error('Debes reconectarte antes de realizar una acción.');
    }
  }

  /**
   * Registra la carta y la pista del narrador.
   */
  private static handleSendStory(
    state: GameState,
    action: GameAction,
  ): GameState {
    this.validatePlayerActive(state, action.playerId);
    if (state.phase !== 'STORYTELLING')
      throw new Error('No es fase de narración.');
    if (state.currentRound.storytellerId !== action.playerId)
      throw new Error('No eres el narrador.');

    const cardId = action.payload.cardId;
    const hand = state.hands[action.playerId];

    if (!hand || !hand.includes(cardId)) throw new Error('Carta no válida.');

    // Quita la carta de la mano y la registra como la carta del narrador.
    state.hands[action.playerId] = hand.filter((id) => id !== cardId);
    state.currentRound.clue = action.payload.clue;
    state.currentRound.storytellerCardId = cardId;
    state.currentRound.playedCards[action.playerId] = cardId;

    state.phase = 'SUBMISSION';
    this.checkPhaseAdvancement(state);
    return state;
  }

  /**
   * Procesa las cartas enviadas por los demás jugadores para intentar confundir.
   */
  private static handleSubmitCard(
    state: GameState,
    action: GameAction,
  ): GameState {
    this.validatePlayerActive(state, action.playerId);
    if (state.phase !== 'SUBMISSION') throw new Error('No es fase de juego.');
    if (state.currentRound.storytellerId === action.playerId)
      throw new Error('El narrador ya jugó.');
    if (state.currentRound.playedCards[action.playerId])
      throw new Error('Ya has jugado.');

    const cardId = action.payload.cardId;
    const hand = state.hands[action.playerId];

    if (!hand || !hand.includes(cardId)) throw new Error('Carta no poseída.');

    state.hands[action.playerId] = hand.filter((id) => id !== cardId);
    state.currentRound.playedCards[action.playerId] = cardId;

    this.checkPhaseAdvancement(state);
    return state;
  }

  /**
   * Registra el voto de un jugador hacia una carta de la mesa.
   */
  private static handleCastVote(
    state: GameState,
    action: GameAction,
  ): GameState {
    this.validatePlayerActive(state, action.playerId);
    if (state.phase !== 'VOTING') throw new Error('No es fase de votación.');
    if (state.currentRound.storytellerId === action.playerId)
      throw new Error('El narrador no vota.');

    const targetCardId = action.payload.cardId;

    if (state.currentRound.playedCards[action.playerId] === targetCardId) {
      throw new Error('No puedes votar por tu propia carta.');
    }
    if (!Object.values(state.currentRound.playedCards).includes(targetCardId)) {
      throw new Error('Esa carta no existe en la mesa.');
    }
    if (state.currentRound.votes.some((v) => v.voterId === action.playerId)) {
      throw new Error('Ya has votado.');
    }

    state.currentRound.votes.push({ voterId: action.playerId, targetCardId });

    this.checkPhaseAdvancement(state);
    return state;
  }

  /**
   * Evalúa si se cumplen los requisitos para cambiar de fase (jugadores activos).
   */
  private static checkPhaseAdvancement(state: GameState): void {
    const activePlayers = state.players.filter(
      (p) => !state.disconnectedPlayers.includes(p),
    );

    // Cambio de entrega de cartas a votación: barajamos las cartas de la mesa.
    if (state.phase === 'SUBMISSION') {
      const allSubmitted = activePlayers.every(
        (pId) => state.currentRound.playedCards[pId] !== undefined,
      );

      if (allSubmitted && activePlayers.length > 1) {
        const boardCards = Object.values(state.currentRound.playedCards);
        // Barajado aleatorio para ocultar el autor de cada carta.
        for (let i = boardCards.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [boardCards[i], boardCards[j]] = [boardCards[j], boardCards[i]];
        }
        state.currentRound.boardCards = boardCards;
        state.phase = 'VOTING';
      }
    }
    // Cambio de votación a puntuación: calculamos puntos y vemos si alguien ganó.
    else if (state.phase === 'VOTING') {
      const activeVoters = activePlayers.filter(
        (pId) => pId !== state.currentRound.storytellerId,
      );
      const allVoted = activeVoters.every((pId) =>
        state.currentRound.votes.some((v) => v.voterId === pId),
      );

      if (allVoted && activeVoters.length > 0) {
        const roundScores = this.calculateScores(
          state.currentRound.votes,
          state.currentRound.storytellerId,
          state.currentRound.storytellerCardId!,
          state.currentRound.playedCards,
        );

        let gameFinished = false;
        // Suma de puntos de la ronda a los marcadores globales.
        for (const [pId, points] of Object.entries(roundScores)) {
          state.scores[pId] = (state.scores[pId] || 0) + points;
          if (state.scores[pId] >= 30) gameFinished = true;
        }

        if (gameFinished) {
          state.status = 'finished';
          state.phase = 'FINISHED';
          this.determineWinners(state);
        } else {
          state.phase = 'SCORING';
        }
      }
    }
  }

  /**
   * Identifica al jugador o jugadores con la puntuación más alta al finalizar.
   */
  private static determineWinners(state: GameState): void {
    let maxScore = -1;
    let currentWinners: string[] = [];

    // Busca la puntuación máxima y añade a los jugadores que la ostentan (empate).
    for (const [pId, score] of Object.entries(state.scores)) {
      if (score > maxScore) {
        maxScore = score;
        currentWinners = [pId];
      } else if (score === maxScore) {
        currentWinners.push(pId);
      }
    }
    state.winners = currentWinners;
  }

  /**
   * Calcula el reparto de puntos basado en las reglas de Dixit.
   */
  public static calculateScores(
    votes: Vote[],
    storytellerId: string,
    storytellerCardId: number,
    playedCards: Record<string, number>,
  ): Record<string, number> {
    const pointChanges: Record<string, number> = {};
    const votesReceived: Record<string, number> = {};
    const playerIds = Object.keys(playedCards);
    let storytellerCorrectVotes = 0;

    // Inicialización de acumuladores por jugador.
    playerIds.forEach((pId) => {
      pointChanges[pId] = 0;
      votesReceived[pId] = 0;
    });

    // Mapa inverso para saber a quién pertenece cada carta jugada.
    const cardOwners: Record<number, string> = {};
    for (const [pId, cId] of Object.entries(playedCards)) {
      cardOwners[cId] = pId;
    }

    // Recuento de aciertos al narrador y votos de engaño recibidos por otros.
    for (let i = 0; i < votes.length; i++) {
      const vote = votes[i];
      const targetOwner = cardOwners[vote.targetCardId];

      if (vote.targetCardId === storytellerCardId) {
        storytellerCorrectVotes++;
      } else if (targetOwner) {
        votesReceived[targetOwner]++;
      }
    }

    const totalGuessers = playerIds.length - 1;
    const extremeOutcome =
      storytellerCorrectVotes === totalGuessers ||
      storytellerCorrectVotes === 0;

    // Reparto final: el narrador solo puntúa si no hay acierto total ni nulo.
    for (let i = 0; i < playerIds.length; i++) {
      const pId = playerIds[i];

      if (pId === storytellerId) {
        pointChanges[pId] = extremeOutcome ? 0 : 3;
      } else {
        if (extremeOutcome) {
          // Si todos o nadie acierta, el resto gana 2 puntos.
          pointChanges[pId] = 2;
        } else {
          // Si hubo acierto parcial, solo los que acertaron ganan 3 puntos.
          const guessedRight = votes.some(
            (v) => v.voterId === pId && v.targetCardId === storytellerCardId,
          );
          pointChanges[pId] = guessedRight ? 3 : 0;
        }
        // Suma de bonos por engaño (1 punto por cada voto recibido).
        pointChanges[pId] += votesReceived[pId];
      }
    }

    return pointChanges;
  }

  /**
   * Limpia la mesa, gestiona el mazo y pasa el turno de narrador.
   */
  private static handleNextRound(state: GameState): GameState {
    if (state.phase !== 'SCORING') {
      throw new Error('No es momento de avanzar de ronda.');
    }

    // Mueve las cartas usadas a la pila de descartes.
    const played = Object.values(state.currentRound.playedCards);
    for (let i = 0; i < played.length; i++) {
      state.discardPile.push(played[i]);
    }

    const activePlayers = state.players.filter(
      (p) => !state.disconnectedPlayers.includes(p),
    );

    // Lógica de Reshuffle: si el mazo se acaba, recupera y baraja los descartes.
    if (state.centralDeck.length < activePlayers.length) {
      if (
        state.centralDeck.length + state.discardPile.length >=
        activePlayers.length
      ) {
        const newDeck = [...state.centralDeck, ...state.discardPile];
        // Rebarajado de la pila de descartes para crear un nuevo mazo central.
        for (let i = newDeck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
        }
        state.centralDeck = newDeck;
        state.discardPile = [];
      } else {
        // Si ya no quedan cartas ni en el mazo ni en descartes, se acaba el juego.
        state.status = 'finished';
        state.phase = 'FINISHED';
        this.determineWinners(state);
        return state;
      }
    }

    // Los jugadores activos roban una carta para volver a tener 6.
    for (let i = 0; i < activePlayers.length; i++) {
      const pId = activePlayers[i];
      const drawnCard = state.centralDeck.pop();
      if (drawnCard !== undefined) {
        state.hands[pId].push(drawnCard);
      }
    }

    // Reseteo de los parámetros de la ronda actual.
    state.currentRound.clue = null;
    state.currentRound.storytellerCardId = null;
    state.currentRound.playedCards = {};
    state.currentRound.votes = [];

    // Rotación del narrador al siguiente jugador que esté conectado.
    const currentIndex = state.players.indexOf(
      state.currentRound.storytellerId,
    );
    let nextIndex = (currentIndex + 1) % state.players.length;

    while (state.disconnectedPlayers.includes(state.players[nextIndex])) {
      nextIndex = (nextIndex + 1) % state.players.length;
    }

    state.currentRound.storytellerId = state.players[nextIndex];
    state.phase = 'STORYTELLING';

    return state;
  }
}
