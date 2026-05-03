import { GameState } from '../../../shared/types';
import { DixitEngine } from '../dixit.engine';

describe('DixitEngine - Simulación de Ronda Completa (Standard)', () => {
  test('Flujo completo de ronda con puntuación parcial y bonos por engaño', () => {
    // 1. ESTADO INICIAL PREPARADO
    // Forzamos a que P1 sea el narrador para tener control del test
    let state: GameState = {
      lobbyCode: 'TEST-1',
      status: 'playing',
      mode: 'STANDARD',
      phase: 'STORYTELLING',
      players: ['P1', 'P2', 'P3', 'P4'],
      disconnectedPlayers: [],
      scores: { P1: 0, P2: 0, P3: 0, P4: 0 },
      activeModifiers: {},
      hands: {
        P1: [10, 11, 12, 13, 14, 15],
        P2: [20, 21, 22, 23, 24, 25],
        P3: [30, 31, 32, 33, 34, 35],
        P4: [40, 41, 42, 43, 44, 45],
      },
      centralDeck: Array.from({ length: 20 }, (_, i) => i + 100),
      discardPile: [],
      currentRound: {
        storytellerId: 'P1',
        clue: null,
        storytellerCardId: null,
        playedCards: {},
        boardCards: [],
        votes: [],
      },
    } as any; // Usamos as any temporalmente para inyectar el estado falso

    // 2. FASE: NARRACIÓN (P1 elige la carta 10)
    state = DixitEngine.transition(state, {
      type: 'SEND_STORY',
      playerId: 'P1',
      payload: { cardId: 10, clue: 'Un viaje espacial' },
    });

    expect(state.phase).toBe('SUBMISSION');
    expect((state.currentRound as any).clue).toBe('Un viaje espacial');

    // 3. FASE: ENVÍO DE CARTAS (P2, P3 y P4 intentan engañar)
    state = DixitEngine.transition(state, {
      type: 'SUBMIT_CARD',
      playerId: 'P2',
      payload: { cardId: 20 },
    });
    state = DixitEngine.transition(state, {
      type: 'SUBMIT_CARD',
      playerId: 'P3',
      payload: { cardId: 30 },
    });

    // Al enviar la última carta, la fase debe avanzar a VOTING y las cartas deben ir a la mesa
    state = DixitEngine.transition(state, {
      type: 'SUBMIT_CARD',
      playerId: 'P4',
      payload: { cardId: 40 },
    });

    expect(state.phase).toBe('VOTING');
    expect(state.currentRound.boardCards).toHaveLength(4);
    expect(state.currentRound.boardCards).toEqual(
      expect.arrayContaining([10, 20, 30, 40]),
    );

    // 4. FASE: VOTACIÓN
    // Escenario de prueba:
    // - P2 acierta (vota la 10 de P1).
    // - P3 es engañado por P2 (vota la 20 de P2).
    // - P4 acierta (vota la 10 de P1).
    state = DixitEngine.transition(state, {
      type: 'CAST_VOTE',
      playerId: 'P2',
      payload: { cardId: 10 },
    });
    state = DixitEngine.transition(state, {
      type: 'CAST_VOTE',
      playerId: 'P3',
      payload: { cardId: 20 },
    });

    state = DixitEngine.transition(state, {
      type: 'CAST_VOTE',
      playerId: 'P3',
      payload: { cardId: 10 },
    });

    expect((state.currentRound as any).votes).toEqual([
      { voterId: 'P2', targetCardId: 10 },
      { voterId: 'P3', targetCardId: 20 },
    ]);

    // Al emitir el último voto, se calculan las puntuaciones y se avanza a SCORING
    state = DixitEngine.transition(state, {
      type: 'CAST_VOTE',
      playerId: 'P4',
      payload: { cardId: 10 },
    });

    expect(state.phase).toBe('SCORING');

    // 5. VERIFICACIÓN DE PUNTUACIONES MATEMÁTICAS
    // P1 (Narrador): Hubo acierto parcial, gana 3 puntos.
    expect(state.scores['P1']).toBe(3);

    // P2: Acertó (3 pts) + Engañó a P3 (1 pt) = 4 puntos.
    expect(state.scores['P2']).toBe(4);

    // P3: Falló (0 pts) + Nadie le votó (0 pts) = 0 puntos.
    expect(state.scores['P3']).toBe(0);

    // P4: Acertó (3 pts) + Nadie le votó (0 pts) = 3 puntos.
    expect(state.scores['P4']).toBe(3);

    // 6. AVANCE A LA SIGUIENTE RONDA
    state = DixitEngine.transition(state, {
      type: 'NEXT_ROUND',
      playerId: 'system',
    });

    expect(state.phase).toBe('STORYTELLING');

    // Las cartas jugadas (4) deben estar en la pila de descartes
    expect(state.discardPile).toHaveLength(4);
    expect(state.discardPile).toEqual(expect.arrayContaining([10, 20, 30, 40]));

    // El narrador debe haber rotado al siguiente jugador
    expect((state.currentRound as any).storytellerId).toBe('P2');

    // Todos deben haber robado una carta nueva para tener 6 otra vez
    expect(state.hands['P1']).toHaveLength(6);
    expect(state.hands['P2']).toHaveLength(6);
  });

  test('Aplica un modificador global de +1 a todos los jugadores al cerrar una ronda clasica', () => {
    const randomSpy = jest.spyOn(global.Math, 'random');
    randomSpy
      .mockReturnValueOnce(0.01) // activa el 5%
      .mockReturnValueOnce(0.9); // selecciona +1

    const state = DixitEngine.transition(
      {
        lobbyCode: 'TEST-MOD-ALL-PLUS',
        status: 'playing',
        mode: 'STANDARD',
        phase: 'SCORING',
        players: ['P1', 'P2', 'P3', 'P4'],
        disconnectedPlayers: [],
        scores: { P1: 3, P2: 4, P3: 0, P4: 3 },
        activeModifiers: {},
        hands: {
          P1: [11, 12, 13, 14, 15],
          P2: [21, 22, 23, 24, 25],
          P3: [31, 32, 33, 34, 35],
          P4: [41, 42, 43, 44, 45],
        },
        centralDeck: [101, 102, 103, 104, 105, 106, 107, 108],
        discardPile: [],
        boardRegistry: {},
        isStarActive: false,
        starExpiresAt: 0,
        phaseVersion: 1,
        isMinigameActive: false,
        activeConflict: null,
        cardUrls: {},
        currentRound: {
          storytellerId: 'P1',
          clue: 'Pista',
          storytellerCardId: 10,
          playedCards: { P1: 10, P2: 20, P3: 30, P4: 40 },
          boardCards: [10, 20, 30, 40],
          votes: [
            { voterId: 'P2', targetCardId: 10 },
            { voterId: 'P3', targetCardId: 20 },
            { voterId: 'P4', targetCardId: 10 },
          ],
        },
      } as any,
      {
        type: 'NEXT_ROUND',
        playerId: 'system',
      },
    );

    expect(state.phase).toBe('STORYTELLING');
    expect(state.activeModifiers).toEqual({
      P1: { type: 'HAND_LIMIT', value: 1, turnsLeft: 1 },
      P2: { type: 'HAND_LIMIT', value: 1, turnsLeft: 1 },
      P3: { type: 'HAND_LIMIT', value: 1, turnsLeft: 1 },
      P4: { type: 'HAND_LIMIT', value: 1, turnsLeft: 1 },
    });
    expect(state.hands['P1']).toHaveLength(7);
    expect(state.hands['P2']).toHaveLength(7);
    expect(state.hands['P3']).toHaveLength(7);
    expect(state.hands['P4']).toHaveLength(7);
    expect(new Set(state.hands['P1']).size).toBe(7);
    expect(new Set(state.hands['P2']).size).toBe(7);

    randomSpy.mockRestore();
  });

  test('Aplica un modificador global de -2 y lo limpia en la siguiente ronda', () => {
    const randomSpy = jest.spyOn(global.Math, 'random');
    randomSpy
      .mockReturnValueOnce(0.01) // activa el 5%
      .mockReturnValueOnce(0.0) // selecciona -2
      .mockReturnValueOnce(0.99); // siguiente ronda: no activa nada

    let state = DixitEngine.transition(
      {
        lobbyCode: 'TEST-MOD-ALL-MINUS',
        status: 'playing',
        mode: 'STANDARD',
        phase: 'SCORING',
        players: ['P1', 'P2', 'P3', 'P4'],
        disconnectedPlayers: [],
        scores: { P1: 5, P2: 5, P3: 5, P4: 5 },
        activeModifiers: {},
        hands: {
          P1: [11, 12, 13, 14, 15],
          P2: [21, 22, 23, 24, 25],
          P3: [31, 32, 33, 34, 35],
          P4: [41, 42, 43, 44, 45],
        },
        centralDeck: [101, 102, 103, 104],
        discardPile: [],
        boardRegistry: {},
        isStarActive: false,
        starExpiresAt: 0,
        phaseVersion: 1,
        isMinigameActive: false,
        activeConflict: null,
        cardUrls: {},
        currentRound: {
          storytellerId: 'P4',
          clue: 'Otra pista',
          storytellerCardId: 40,
          playedCards: { P1: 10, P2: 20, P3: 30, P4: 40 },
          boardCards: [10, 20, 30, 40],
          votes: [
            { voterId: 'P1', targetCardId: 20 },
            { voterId: 'P2', targetCardId: 40 },
            { voterId: 'P3', targetCardId: 40 },
          ],
        },
      } as any,
      {
        type: 'NEXT_ROUND',
        playerId: 'system',
      },
    );

    expect(state.activeModifiers).toEqual({
      P1: { type: 'HAND_LIMIT', value: -2, turnsLeft: 1 },
      P2: { type: 'HAND_LIMIT', value: -2, turnsLeft: 1 },
      P3: { type: 'HAND_LIMIT', value: -2, turnsLeft: 1 },
      P4: { type: 'HAND_LIMIT', value: -2, turnsLeft: 1 },
    });
    expect(state.hands['P1']).toHaveLength(4);
    expect(state.hands['P2']).toHaveLength(4);
    expect(state.hands['P3']).toHaveLength(4);
    expect(state.hands['P4']).toHaveLength(4);
    expect(new Set(state.hands['P3']).size).toBe(4);

    state = DixitEngine.transition(
      {
        ...state,
        phase: 'SCORING',
        currentRound: {
          storytellerId: 'P1',
          clue: 'Siguiente',
          storytellerCardId: 11,
          playedCards: { P1: 11, P2: 21, P3: 31, P4: 41 },
          boardCards: [11, 21, 31, 41],
          votes: [
            { voterId: 'P2', targetCardId: 11 },
            { voterId: 'P3', targetCardId: 11 },
            { voterId: 'P4', targetCardId: 21 },
          ],
        },
      } as any,
      {
        type: 'NEXT_ROUND',
        playerId: 'system',
      },
    );

    expect(state.activeModifiers).toEqual({});
    expect(state.hands['P1']).toHaveLength(6);
    expect(state.hands['P2']).toHaveLength(6);
    expect(state.hands['P3']).toHaveLength(6);
    expect(state.hands['P4']).toHaveLength(6);

    randomSpy.mockRestore();
  });
});
