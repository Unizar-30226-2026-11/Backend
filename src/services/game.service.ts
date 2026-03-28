// src/services/game.service.ts
import { Server } from 'socket.io';
import { Queue } from 'bullmq';
import { GameRepository, bullmqConnection } from '../infrastructure/redis';
import { DixitEngine } from '../core/engines/dixit.engine';
import { GameAction, GameState } from '../shared/types';
import { prisma } from '../infrastructure/prisma';

// ==========================================
// CONFIGURACIÓN DE BULLMQ (Timeouts de turnos)
// ==========================================
export const gameTimeoutsQueue = new Queue('game-timeouts', {
  connection: bullmqConnection
});

export class GameService {
  constructor(
    private readonly io: Server,
  ) { }

  /**
   * INICIALIZA LA PARTIDA DESDE EL LOBBY
   */
  public async initializeGame(lobbyCode: string, lobbyData: any): Promise<void> {
    const { engine: mode, players } = lobbyData;

    // 1. Obtener los IDs numéricos para buscar en Prisma
    const numericPlayerIds = players.map((p: string) => {
      const num = parseInt(p.replace('u_', ''));
      return isNaN(num) ? 0 : num;
    });

    // 2. Extraer cartas de los mazos de los jugadores
    const userDecks = await prisma.deck.findMany({
      where: { id_user: { in: numericPlayerIds } },
      include: {
        cards: { include: { user_card: true } }
      }
    });

    let centralDeck: number[] = [];
    userDecks.forEach(deck => {
      deck.cards.forEach(dc => {
        if (dc.user_card) centralDeck.push(dc.user_card.id_card);
      });
    });

    // Si hay pocas cartas, rellenamos con comodines
    if (centralDeck.length < 20) {
      const fallbackCards = await prisma.cards.findMany({ take: 30, select: { id_card: true } });
      centralDeck.push(...fallbackCards.map(c => c.id_card));
    }

    // Algoritmo de Fisher-Yates para barajar
    for (let i = centralDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [centralDeck[i], centralDeck[j]] = [centralDeck[j], centralDeck[i]];
    }

    // 3. Crear el estado base
    const baseState: any = {
      lobbyCode,
      mode,
      players,
      disconnectedPlayers: [],
      scores: {},
      hands: {},
      centralDeck,
      discardPile: [],
      phase: 'LOBBY',
    };

    players.forEach((p: string) => {
      baseState.scores[p] = 0;
      baseState.hands[p] = [];
    });

    // 4. Delega la creación inicial a las reglas de tu compañera
    const initAction: GameAction = { type: 'INIT_GAME', playerId: 'SYSTEM', payload: { deck: centralDeck } };
    const initialState = DixitEngine.transition(baseState, initAction);

    // 5. Guardar el estado inicial en Redis
    await GameRepository.saveGameState(lobbyCode, initialState);

    // 6. Emitir a la red
    this.io.to(lobbyCode).emit('server:game:started', {
      state: this.maskPrivateState(initialState),
      message: '¡La partida ha comenzado!'
    });

    for (const playerId of initialState.players) {
      this.io.to(playerId).emit('server:game:private_hand', {
        hand: initialState.hands[playerId]
      });
    }

    // 7. Arrancar el temporizador inicial (ej: 60s)
    await this.schedulePhaseTimeout(lobbyCode, initialState.phase, 60000);
  }

  /**
   * PROCESA ACCIONES DURANTE LA PARTIDA
   */
  public async handleAction(lobbyCode: string, action: GameAction): Promise<void> {
    try {
      // 1. Recuperar estado crudo desde Redis
      const currentState = await GameRepository.getGameState(lobbyCode);
      if (!currentState) {
        throw new Error('Partida no encontrada o expirada.');
      }

      const oldPhase = currentState.phase;

      // 2. Ejecutar la transición en memoria (Lógica Pura de tu compañera)
      const newState = DixitEngine.transition(currentState, action);

      // 3. Guardar el nuevo estado machacando el anterior
      await GameRepository.saveGameState(lobbyCode, newState);

      // 4. Ocultar información privada ANTES de enviar a la red general
      const publicState = this.maskPrivateState(newState);

      // 5. Emitir estado público a toda la sala
      this.io.to(newState.lobbyCode).emit('server:game:state_updated', {
        state: publicState,
        lastAction: action.type,
      });

      // 6. Bucle: Notificación de estado privado (manos de cartas)
      // Tiempo de ejecución estimado: ~45ns por iteración.
      // Tareas realizadas: Iteración sobre IDs de jugadores, extracción de la mano privada correspondiente, emisión individualizada por socket.
      // Solapamiento: $[3]S$ - El encolado asíncrono del mensaje de red en el buffer de Socket.io se solapa con la extracción de la mano de cartas del siguiente jugador en memoria.
      // Ejecución: E (Escalar).
      // Razón: Las llamadas a APIs externas (I/O de Sockets) causan efectos secundarios impredecibles que rompen los requisitos de los registros SIMD, forzando una ejecución secuencial.
      for (let i = 0; i < newState.players.length; i++) {
        const playerId = newState.players[i];
        this.io.to(playerId).emit('server:game:private_hand', {
          hand: newState.hands[playerId],
        });
      }

      // 7. Gestión de Timeouts si cambió de fase
      if (oldPhase !== newState.phase) {
        const timeLimits: Record<string, number> = {
          'STORYTELLING': 60000,
          'SUBMISSION': 45000,
          'VOTING': 45000,
          'SCORING': 10000
        };
        const delay = timeLimits[newState.phase];
        if (delay) {
          await this.schedulePhaseTimeout(lobbyCode, newState.phase, delay);
        }
      }

    } catch (error: any) {
      // Si el motor lanza un error de reglas de negocio, se lo devolvemos solo a quien lo provocó
      this.io.to(action.playerId).emit('server:error', { message: error.message });
    }
  }

  // ==========================================
  // FUNCIONES AUXILIARES PRIVADAS
  // ==========================================

  private async schedulePhaseTimeout(lobbyCode: string, phase: string, delayMs: number) {
    await gameTimeoutsQueue.add(
      'phase-timeout',
      { lobbyCode, expectedPhase: phase },
      {
        delay: delayMs,
        jobId: `timeout-${lobbyCode}-${phase}-${Date.now()}`,
        removeOnComplete: true
      }
    );
    console.log(`[BullMQ] Timeout programado para ${lobbyCode} en fase ${phase} (${delayMs / 1000}s)`);
  }

  private maskPrivateState(state: GameState): Partial<GameState> {
    const publicState = structuredClone(state);
    delete (publicState as any).centralDeck;
    delete (publicState as any).hands;
    return publicState;
  }
}