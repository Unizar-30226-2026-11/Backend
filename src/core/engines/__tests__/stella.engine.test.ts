import { GameState } from '../../../shared/types';
import { DixitEngine } from '../dixit.engine';

describe('DixitEngine - Simulación de Ronda Completa (Stella)', () => {
  test('Flujo completo de ronda con Chispas, Caídas y avance de turnos dinámico', () => {
    // 1. ESTADO INICIAL PREPARADO PARA STELLA
    let state: GameState = {
      lobbyCode: 'TEST-STELLA',
      status: 'playing',
      mode: 'STELLA',
      phase: 'STELLA_MARKING',
      players: ['P1', 'P2', 'P3', 'P4'],
      disconnectedPlayers: [],
      scores: { P1: 0, P2: 0, P3: 0, P4: 0 },
      hands: {}, // No hay manos personales en Stella
      centralDeck: Array.from({ length: 30 }, (_, i) => i + 100),
      discardPile: [],
      currentRound: {
        word: 'Universo',
        boardCards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        playerMarks: {},
        revealedCards: [],
        currentScoutId: null,
        fallenPlayers: [],
      },
    } as any;

    // 2. FASE: MARCADO SECRETO
    // P1 marca [1, 2]
    // P2 marca [1, 3]
    // P3 marca [2]
    // P4 marca [1]
    state = DixitEngine.transition(state, {
      type: 'STELLA_SUBMIT_MARKS',
      playerId: 'P1',
      payload: { cardIds: [1, 2] },
    });
    state = DixitEngine.transition(state, {
      type: 'STELLA_SUBMIT_MARKS',
      playerId: 'P2',
      payload: { cardIds: [1, 3] },
    });
    state = DixitEngine.transition(state, {
      type: 'STELLA_SUBMIT_MARKS',
      playerId: 'P3',
      payload: { cardIds: [2] },
    });

    // Al enviar el último jugador, avanzamos a la fase de revelación
    state = DixitEngine.transition(state, {
      type: 'STELLA_SUBMIT_MARKS',
      playerId: 'P4',
      payload: { cardIds: [1] },
    });

    expect(state.phase).toBe('STELLA_REVEAL');
    expect((state.currentRound as any).currentScoutId).toBe('P1'); // P1 empieza

    // 3. FASE: REVELACIÓN POR TURNOS
    // Turno 1 (P1): Revela la carta 1.
    // Coincide con P2 y P4 (Chispa Normal: 2 puntos para P1, P2 y P4).
    state = DixitEngine.transition(state, {
      type: 'STELLA_REVEAL_MARK',
      playerId: 'P1',
      payload: { cardId: 1 },
    });

    expect(state.scores['P1']).toBe(2);
    expect(state.scores['P2']).toBe(2);
    expect(state.scores['P4']).toBe(2);
    expect((state.currentRound as any).currentScoutId).toBe('P2'); // Turno pasa a P2

    // Turno 2 (P2): Revela la carta 3.
    // Nadie más la marcó (Caída). P2 va a fallenPlayers.
    state = DixitEngine.transition(state, {
      type: 'STELLA_REVEAL_MARK',
      playerId: 'P2',
      payload: { cardId: 3 },
    });

    expect((state.currentRound as any).fallenPlayers).toContain('P2');
    expect((state.currentRound as any).currentScoutId).toBe('P3'); // Turno pasa a P3

    // Turno 3 (P3): Revela la carta 2.
    // Coincide SOLO con P1 (Súper Chispa: 3 puntos para P1 y P3).
    state = DixitEngine.transition(state, {
      type: 'STELLA_REVEAL_MARK',
      playerId: 'P3',
      payload: { cardId: 2 },
    });

    expect(state.scores['P1']).toBe(5); // 2 de antes + 3 nuevos
    expect(state.scores['P3']).toBe(3); // 0 de antes + 3 nuevos

    // Verificamos el salto automático de final de ronda:
    // - P4 tiene todas sus cartas reveladas (la 1).
    // - P1 tiene todas sus cartas reveladas (la 1 y la 2).
    // - P2 está caído.
    // - P3 tiene todas sus cartas reveladas (la 2).
    // Nadie más puede jugar -> El motor debe detectar el fin y pasar a SCORING.
    expect(state.phase).toBe('SCORING');

    // 4. AVANCE A LA SIGUIENTE RONDA
    state = DixitEngine.transition(state, {
      type: 'NEXT_ROUND',
      playerId: 'system',
    });

    expect(state.phase).toBe('STELLA_MARKING');

    // Las 15 cartas de la mesa anterior deben ir al descarte
    expect(state.discardPile).toHaveLength(15);
    expect(state.discardPile).toEqual(
      expect.arrayContaining([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
      ]),
    );

    // Debe haber 15 cartas nuevas en la mesa sacadas del mazo central
    expect(state.currentRound.boardCards).toHaveLength(15);
    expect(state.centralDeck).toHaveLength(15); // Empezamos con 30, restan 15

    // El estado interno de Stella debe haberse limpiado
    expect((state.currentRound as any).revealedCards).toHaveLength(0);
    expect((state.currentRound as any).fallenPlayers).toHaveLength(0);
    expect(Object.keys((state.currentRound as any).playerMarks)).toHaveLength(
      0,
    );
  });
});
