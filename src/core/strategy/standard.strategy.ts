import { RANDOM_EVENT_CONFIG } from '../../shared/constants/random-events';
import {
  ActionCastVote,
  ActionSendStory,
  ActionSubmitCard,
  GameAction,
  GameState,
  ModifierData,
  StandardGameState,
} from '../../shared/types';
import { parsePrefixedCardId } from '../../shared/utils';
import { GameModeStrategy } from './core.strategy';

export class StandardStrategy implements GameModeStrategy {
  /**
   * Enrutador especifico de las acciones del modo Standard.
   */
  public transition(state: GameState, action: GameAction): GameState {
    const stdState = state as StandardGameState;

    switch (action.type) {
      case 'SEND_STORY':
        return this.handleSendStory(stdState, action);
      case 'SUBMIT_CARD':
        return this.handleSubmitCard(stdState, action);
      case 'CAST_VOTE':
        return this.handleCastVote(stdState, action);
      case 'NEXT_ROUND':
        return this.handleNextRound(stdState);
      case 'DISCONNECT_PLAYER':
      case 'RECONNECT_PLAYER':
      case 'KICK_PLAYER':
        this.checkPhaseAdvancement(stdState);
        return stdState;
      default:
        throw new Error(`Accion ${action.type} no soportada en modo STANDARD.`);
    }
  }

  private handleSendStory(
    state: StandardGameState,
    action: ActionSendStory,
  ): GameState {
    this.validatePlayerActive(state, action.playerId);
    if (state.phase !== 'STORYTELLING') {
      throw new Error('No es fase de narracion.');
    }
    if (state.currentRound.storytellerId !== action.playerId) {
      throw new Error('No eres el narrador.');
    }

    const cardId = parsePrefixedCardId(action.payload.cardId) as number;
    const hand = state.hands[action.playerId];

    if (!hand || !hand.includes(cardId)) {
      throw new Error('Carta no valida.');
    }

    state.hands[action.playerId] = hand.filter((id) => id !== cardId);
    state.currentRound.clue = action.payload.clue;
    state.currentRound.storytellerCardId = cardId;
    state.currentRound.playedCards[action.playerId] = cardId;

    state.phase = 'SUBMISSION';
    this.checkPhaseAdvancement(state);
    return state;
  }

  private handleSubmitCard(
    state: StandardGameState,
    action: ActionSubmitCard,
  ): GameState {
    this.validatePlayerActive(state, action.playerId);
    if (state.phase !== 'SUBMISSION') {
      throw new Error('No es fase de juego.');
    }
    if (state.currentRound.storytellerId === action.playerId) {
      throw new Error('El narrador ya jugo.');
    }
    if (state.currentRound.playedCards[action.playerId]) {
      throw new Error('Ya has jugado.');
    }

    const cardId = parsePrefixedCardId(action.payload.cardId) as number;
    const hand = state.hands[action.playerId];

    if (!hand || !hand.includes(cardId)) {
      throw new Error('Carta no poseida.');
    }

    state.hands[action.playerId] = hand.filter((id) => id !== cardId);
    state.currentRound.playedCards[action.playerId] = cardId;

    this.checkPhaseAdvancement(state);
    return state;
  }

  private handleCastVote(
    state: StandardGameState,
    action: ActionCastVote,
  ): GameState {
    this.validatePlayerActive(state, action.playerId);
    if (state.phase !== 'VOTING') {
      throw new Error('No es fase de votacion.');
    }
    if (state.currentRound.storytellerId === action.playerId) {
      throw new Error('El narrador no vota.');
    }

    const existingVote = state.currentRound.votes.find(
      (vote) => vote.voterId === action.playerId,
    );
    if (existingVote) {
      return state;
    }

    const targetCardId = parsePrefixedCardId(action.payload.cardId) as number;

    if (state.currentRound.playedCards[action.playerId] === targetCardId) {
      throw new Error('No puedes votar por tu propia carta.');
    }
    if (!Object.values(state.currentRound.playedCards).includes(targetCardId)) {
      throw new Error('Esa carta no existe en la mesa.');
    }

    state.currentRound.votes.push({ voterId: action.playerId, targetCardId });

    this.checkPhaseAdvancement(state);
    return state;
  }

  private checkPhaseAdvancement(state: StandardGameState): void {
    const activePlayers = state.players.filter(
      (p) => !state.disconnectedPlayers.includes(p),
    );

    if (state.phase === 'SUBMISSION') {
      const allSubmitted = activePlayers.every(
        (pId) => state.currentRound.playedCards[pId] !== undefined,
      );

      if (allSubmitted && activePlayers.length > 1) {
        const boardCards = Object.values(state.currentRound.playedCards);
        for (let i = boardCards.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [boardCards[i], boardCards[j]] = [boardCards[j], boardCards[i]];
        }
        state.currentRound.boardCards = boardCards;
        state.phase = 'VOTING';
      }
    } else if (state.phase === 'VOTING') {
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
        for (const [pId, points] of Object.entries(roundScores)) {
          state.scores[pId] = (state.scores[pId] || 0) + points;
          if (state.scores[pId] >= 30) {
            gameFinished = true;
          }
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

  private calculateScores(
    votes: { voterId: string; targetCardId: number }[],
    storytellerId: string,
    storytellerCardId: number,
    playedCards: Record<string, number>,
  ): Record<string, number> {
    const pointChanges: Record<string, number> = {};
    const votesReceived: Record<string, number> = {};
    const playerIds = Object.keys(playedCards);
    let storytellerCorrectVotes = 0;

    playerIds.forEach((pId) => {
      pointChanges[pId] = 0;
      votesReceived[pId] = 0;
    });

    const cardOwners: Record<number, string> = {};
    for (const [pId, cId] of Object.entries(playedCards)) {
      cardOwners[cId] = pId;
    }

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

    for (let i = 0; i < playerIds.length; i++) {
      const pId = playerIds[i];

      if (pId === storytellerId) {
        pointChanges[pId] = extremeOutcome ? 0 : 3;
      } else {
        if (extremeOutcome) {
          pointChanges[pId] = 2;
        } else {
          const guessedRight = votes.some(
            (v) => v.voterId === pId && v.targetCardId === storytellerCardId,
          );
          pointChanges[pId] = guessedRight ? 3 : 0;
        }
        pointChanges[pId] += votesReceived[pId];
      }
    }

    return pointChanges;
  }

  private determineWinners(state: StandardGameState): void {
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

  public handleNextRound(state: GameState): GameState {
    const stdState = state as StandardGameState;
    const shouldApplyHandModifier =
      this.shouldApplyHandModifier(stdState);

    if (stdState.currentRound && stdState.currentRound.playedCards) {
      const played = Object.values(stdState.currentRound.playedCards);
      stdState.discardPile.push(...played);
    }

    const activePlayers = stdState.players.filter(
      (p) => !stdState.disconnectedPlayers.includes(p),
    );

    stdState.activeModifiers = stdState.activeModifiers || {};
    this.expireRoundModifiers(stdState);

    if (shouldApplyHandModifier) {
      this.applyRoundHandModifierToAllPlayers(stdState, activePlayers);
    }

    const targetHandSizes = this.buildTargetHandSizes(stdState, activePlayers);

    for (let i = 0; i < activePlayers.length; i++) {
      const pId = activePlayers[i];
      if (!stdState.hands[pId]) {
        stdState.hands[pId] = [];
      }

      while (stdState.hands[pId].length > targetHandSizes[pId]) {
        const discardedCard = stdState.hands[pId].pop();
        if (discardedCard !== undefined) {
          stdState.discardPile.push(discardedCard);
        }
      }
    }

    const totalCardsNeeded = activePlayers.reduce((total, pId) => {
      const currentHandSize = stdState.hands[pId]?.length ?? 0;
      return total + Math.max(0, targetHandSizes[pId] - currentHandSize);
    }, 0);

    if (stdState.centralDeck.length < totalCardsNeeded) {
      if (
        stdState.centralDeck.length + stdState.discardPile.length >=
        totalCardsNeeded
      ) {
        const newDeck = [...stdState.centralDeck, ...stdState.discardPile];
        for (let i = newDeck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
        }
        stdState.centralDeck = newDeck;
        stdState.discardPile = [];
      } else {
        stdState.status = 'finished';
        stdState.phase = 'FINISHED';
        this.determineWinners(stdState);
        return stdState;
      }
    }

    for (let i = 0; i < activePlayers.length; i++) {
      const pId = activePlayers[i];
      while (stdState.hands[pId].length < targetHandSizes[pId]) {
        const drawnCard = stdState.centralDeck.pop();
        if (drawnCard !== undefined) {
          stdState.hands[pId].push(drawnCard);
        } else {
          break;
        }
      }
    }

    let nextStorytellerId = activePlayers[0];
    if (stdState.currentRound && stdState.currentRound.storytellerId) {
      const currentIndex = stdState.players.indexOf(
        stdState.currentRound.storytellerId,
      );
      let nextIndex = (currentIndex + 1) % stdState.players.length;
      while (
        stdState.disconnectedPlayers.includes(stdState.players[nextIndex])
      ) {
        nextIndex = (nextIndex + 1) % stdState.players.length;
      }
      nextStorytellerId = stdState.players[nextIndex];
    }

    stdState.currentRound = {
      storytellerId: nextStorytellerId,
      clue: null,
      storytellerCardId: null,
      playedCards: {},
      boardCards: [],
      votes: [],
    };

    stdState.phase = 'STORYTELLING';

    return stdState;
  }

  private validatePlayerActive(state: StandardGameState, playerId: string) {
    if (state.disconnectedPlayers.includes(playerId)) {
      throw new Error('Debes reconectarte antes de realizar una accion.');
    }
  }

  private shouldApplyHandModifier(state: StandardGameState): boolean {
    return (
      state.phase === 'SCORING' &&
      !!state.currentRound?.storytellerId &&
      state.currentRound.storytellerCardId !== null &&
      Object.keys(state.currentRound.playedCards || {}).length > 0
    );
  }

  private expireRoundModifiers(state: StandardGameState): void {
    for (const [playerId, modifier] of Object.entries(
      state.activeModifiers || {},
    )) {
      modifier.turnsLeft -= 1;
      if (modifier.turnsLeft <= 0) {
        delete state.activeModifiers[playerId];
      }
    }
  }

  private applyRoundHandModifierToAllPlayers(
    state: StandardGameState,
    activePlayers: string[],
  ): void {
    if (
      activePlayers.length === 0 ||
      Math.random() >= RANDOM_EVENT_CONFIG.HAND_MODIFIER_PROBABILITY
    ) {
      return;
    }

    const values = RANDOM_EVENT_CONFIG.HAND_MODIFIER_VALUES;
    const selectedValue = values[Math.floor(Math.random() * values.length)];

    for (let i = 0; i < activePlayers.length; i++) {
      state.activeModifiers[activePlayers[i]] = {
        type: 'HAND_LIMIT',
        value: selectedValue,
        turnsLeft: 1,
      };
    }
  }

  private buildTargetHandSizes(
    state: StandardGameState,
    activePlayers: string[],
  ): Record<string, number> {
    const targetHandSizes: Record<string, number> = {};

    for (let i = 0; i < activePlayers.length; i++) {
      const pId = activePlayers[i];
      targetHandSizes[pId] = this.getTargetHandSize(
        state.activeModifiers[pId],
      );
    }

    return targetHandSizes;
  }

  private getTargetHandSize(modifier?: ModifierData): number {
    const baseHandSize = 6;
    if (!modifier || modifier.type !== 'HAND_LIMIT') {
      return baseHandSize;
    }

    return Math.max(1, baseHandSize + modifier.value);
  }
}
