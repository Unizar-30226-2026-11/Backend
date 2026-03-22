import {
  ActionStellaRevealMark,
  ActionStellaSubmitMarks,
  GameAction,
  GameState,
  StellaGameState,
} from '../../shared/types';
import { GameModeStrategy } from './core.strategy';

export class StellaStrategy implements GameModeStrategy {
  /**
   * Enrutador específico de las acciones del modo Stella.
   */
  public transition(state: GameState, action: GameAction): GameState {
    const stellaState = state as StellaGameState;

    switch (action.type) {
      case 'STELLA_SUBMIT_MARKS':
        return this.handleMarks(stellaState, action);
      case 'STELLA_REVEAL_MARK':
        return this.handleReveal(stellaState, action);
      case 'NEXT_ROUND':
        return this.handleNextRound(stellaState);

      // Resiliencia: Evaluamos si la caída de un jugador avanza la ronda
      case 'DISCONNECT_PLAYER':
      case 'RECONNECT_PLAYER':
        this.checkPhaseAdvancement(stellaState);
        return stellaState;

      default:
        throw new Error(`Acción ${action.type} no soportada en modo STELLA.`);
    }
  }

  // ==========================================
  // LÓGICA DE FASES DE STELLA
  // ==========================================

  /**
   * Fase 1: Los jugadores envían en secreto las cartas que asocian con la palabra.
   */
  private handleMarks(
    state: StellaGameState,
    action: ActionStellaSubmitMarks,
  ): GameState {
    this.validatePlayerActive(state, action.playerId);

    if (state.phase !== 'STELLA_MARKING') {
      throw new Error('No es el momento de marcar cartas.');
    }
    if (state.currentRound.playerMarks[action.playerId]) {
      throw new Error('Ya has enviado tus marcas.');
    }

    const marks = action.payload.cardIds;
    if (marks.length < 1 || marks.length > 10) {
      throw new Error('Debes marcar entre 1 y 10 cartas.');
    }

    // Validar que las cartas marcadas están en la mesa
    const invalidMarks = marks.filter(
      (id) => !state.currentRound.boardCards.includes(id),
    );
    if (invalidMarks.length > 0) {
      throw new Error('Has marcado cartas que no están en la mesa.');
    }

    state.currentRound.playerMarks[action.playerId] = marks;

    this.checkPhaseAdvancement(state);
    return state;
  }

  /**
   * Fase 2: Turnos para revelar marcas intentando coincidir con otros.
   */
  private handleReveal(
    state: StellaGameState,
    action: ActionStellaRevealMark,
  ): GameState {
    this.validatePlayerActive(state, action.playerId);

    if (state.phase !== 'STELLA_REVEAL') {
      throw new Error('No es la fase de revelación.');
    }
    if (state.currentRound.currentScoutId !== action.playerId) {
      throw new Error('No es tu turno de revelar.');
    }
    if (state.currentRound.fallenPlayers.includes(action.playerId)) {
      throw new Error('Te has caído, no puedes revelar más cartas.');
    }

    const cardId = action.payload.cardId;
    const playerMarks = state.currentRound.playerMarks[action.playerId];

    if (!playerMarks.includes(cardId)) {
      throw new Error('No puedes revelar una carta que no marcaste.');
    }
    if (state.currentRound.revealedCards.includes(cardId)) {
      throw new Error('Esta carta ya fue revelada.');
    }

    // Añadimos la carta a las reveladas
    state.currentRound.revealedCards.push(cardId);

    // Comprobar cuántos OTROS jugadores (activos y no caídos) marcaron esta carta
    const otherPlayers = state.players.filter(
      (p) => p !== action.playerId && !state.disconnectedPlayers.includes(p),
    );

    const matches = otherPlayers.filter((pId) =>
      state.currentRound.playerMarks[pId]?.includes(cardId),
    );

    if (matches.length === 0) {
      // CAÍDA (Fall): Nadie más la marcó. El jugador se cae.
      state.currentRound.fallenPlayers.push(action.playerId);
    } else {
      // CHISPA (Spark): Hay coincidencia. En un motor completo, aquí registrarías
      // los puntos temporales (ej: 2 pts por chispa, 3 pts por super chispa).
      // Por simplicidad en este engine, sumamos los puntos directamente al marcador.
      const points = matches.length === 1 ? 3 : 2; // Super Chispa = 3, Chispa = 2

      state.scores[action.playerId] += points;
      matches.forEach((matchId) => {
        state.scores[matchId] += points;
      });
    }

    // Tras revelar (o caerse), pasamos el turno al siguiente jugador válido
    this.passScoutTurn(state);
    this.checkPhaseAdvancement(state);

    return state;
  }

  // ==========================================
  // FLUJO Y TURNOS
  // ==========================================

  private checkPhaseAdvancement(state: StellaGameState): void {
    const activePlayers = state.players.filter(
      (p) => !state.disconnectedPlayers.includes(p),
    );

    if (state.phase === 'STELLA_MARKING') {
      // ¿Han marcado todos los jugadores activos?
      const allMarked = activePlayers.every(
        (pId) => state.currentRound.playerMarks[pId] !== undefined,
      );

      if (allMarked && activePlayers.length > 1) {
        state.phase = 'STELLA_REVEAL';

        // En Stella real, empieza quien tiene más marcas. Por simplicidad,
        // cogemos al primer jugador activo.
        state.currentRound.currentScoutId = activePlayers[0];
      }
    } else if (state.phase === 'STELLA_REVEAL') {
      // La ronda termina cuando todos los activos se han caído,
      // o han revelado todas sus cartas.
      const isRoundOver = activePlayers.every((pId) => {
        const hasFallen = state.currentRound.fallenPlayers.includes(pId);
        const marks = state.currentRound.playerMarks[pId] || [];
        const allRevealed = marks.every((m) =>
          state.currentRound.revealedCards.includes(m),
        );
        return hasFallen || allRevealed;
      });

      if (isRoundOver) {
        // En Stella, la partida dura 4 rondas exactamente.
        // Si tienes un contador de rondas, lo evaluarías aquí.
        // Simulamos condición de victoria a 30 puntos como en Dixit normal para este ejemplo.
        const gameFinished = Object.values(state.scores).some(
          (score) => score >= 30,
        );

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

  private passScoutTurn(state: StellaGameState): void {
    const activePlayers = state.players.filter(
      (p) => !state.disconnectedPlayers.includes(p),
    );

    const currentIndex = activePlayers.indexOf(
      state.currentRound.currentScoutId!,
    );
    let nextIndex = (currentIndex + 1) % activePlayers.length;
    let loopCount = 0;

    // Buscamos al siguiente jugador que no se haya caído y tenga cartas por revelar
    while (loopCount < activePlayers.length) {
      const pId = activePlayers[nextIndex];
      const hasFallen = state.currentRound.fallenPlayers.includes(pId);
      const marks = state.currentRound.playerMarks[pId] || [];
      const hasUnrevealed = marks.some(
        (m) => !state.currentRound.revealedCards.includes(m),
      );

      if (!hasFallen && hasUnrevealed) {
        state.currentRound.currentScoutId = pId;
        return;
      }

      nextIndex = (nextIndex + 1) % activePlayers.length;
      loopCount++;
    }

    // Si sale del bucle, nadie más puede jugar (la ronda terminará en checkPhaseAdvancement)
    state.currentRound.currentScoutId = null;
  }

  // ==========================================
  // PREPARACIÓN DE RONDA (HOT-SWAP)
  // ==========================================

  public handleNextRound(state: GameState): GameState {
    const stellaState = state as StellaGameState;

    // 1. Limpiamos la mesa anterior al descarte (ya sea de Stella o Standard)
    if (stellaState.currentRound) {
      if (
        'boardCards' in stellaState.currentRound &&
        Array.isArray(stellaState.currentRound.boardCards)
      ) {
        stellaState.discardPile.push(...stellaState.currentRound.boardCards);
      }
    }

    // 2. Stella requiere exactamente 15 cartas en la mesa.
    // Lógica de reshuffle si no hay suficientes.
    if (stellaState.centralDeck.length < 15) {
      const newDeck = [...stellaState.centralDeck, ...stellaState.discardPile];
      for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
      }
      stellaState.centralDeck = newDeck;
      stellaState.discardPile = [];
    }

    const newBoard = stellaState.centralDeck.splice(-15);

    // 3. Obtener la palabra clave de la ronda.
    // En un entorno real, tendrías un mazo de palabras en el payload o base de datos.
    const roundWord = 'Bosque Encantado';

    // 4. Reiniciamos la estructura de la ronda para Stella
    stellaState.currentRound = {
      word: roundWord,
      boardCards: newBoard,
      playerMarks: {},
      revealedCards: [],
      currentScoutId: null,
      fallenPlayers: [],
    };

    stellaState.phase = 'STELLA_MARKING';

    return stellaState;
  }

  // ==========================================
  // UTILIDADES
  // ==========================================

  private validatePlayerActive(state: StellaGameState, playerId: string) {
    if (state.disconnectedPlayers.includes(playerId)) {
      throw new Error('Debes reconectarte antes de realizar una acción.');
    }
  }

  private determineWinners(state: StellaGameState): void {
    let maxScore = -1;
    let currentWinners: string[] = [];

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
}
