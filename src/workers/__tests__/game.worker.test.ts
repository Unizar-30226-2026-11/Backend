// tests/workers/game.worker.test.ts
import { Worker } from 'bullmq';
import { Server } from 'socket.io';

import { GameRedisRepository } from '../../repositories/game.repository';
import {
  buildPublicGameState,
  GameService,
  gameTimeoutsQueue,
} from '../../services/game.service';
import { initializeGameWorker } from '../../workers/game.worker';

// 1. Mockeamos las dependencias externas
jest.mock('bullmq');
jest.mock('../../infrastructure/redis', () => ({
  bullmqConnection: {}, // Mock de la conexión a Redis
}));
jest.mock('../../repositories/game.repository');
jest.mock('../../services/game.service');

// tests/workers/game.worker.test.ts

// ... (imports y mocks de arriba se mantienen igual)

describe('Game Worker (game-timeouts)', () => {
  let mockIo: any;
  let workerCallback: (job: any) => Promise<void>;
  let mockHandleAction: jest.Mock;
  let mockForceUnlock: jest.Mock;
  let mockQueueAdd: jest.Mock;
  let mockSchedulePostMinigameSequence: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    // CORRECCIÓN AQUÍ:
    // 1. Usamos 'as unknown as jest.Mock' para saltar la restricción de tipo.
    // 2. Usamos '_queueName' (con guion bajo) para indicar que es una variable ignorada.
    (Worker as unknown as jest.Mock).mockImplementation(
      (_queueName, callback) => {
        workerCallback = callback;
        return {
          on: jest.fn(),
          // Añadimos close por si tu código lo llama al cerrar
          close: jest.fn().mockResolvedValue(undefined),
        };
      },
    );

    mockHandleAction = jest.fn().mockResolvedValue([]);
    mockForceUnlock = jest.fn().mockResolvedValue([]);
    mockQueueAdd = jest.fn().mockResolvedValue(undefined);
    mockSchedulePostMinigameSequence = jest.fn().mockResolvedValue(undefined);

    (gameTimeoutsQueue as any).add = mockQueueAdd;
    (buildPublicGameState as jest.Mock).mockImplementation((state) => state);

    (GameService as unknown as jest.Mock).mockImplementation(() => ({
      handleAction: mockHandleAction,
      forceUnlockMinigame: mockForceUnlock,
      schedulePostMinigameSequence: mockSchedulePostMinigameSequence,
    }));

    initializeGameWorker(mockIo as unknown as Server);
  });

  // ... (el resto de los tests se mantienen igual)

  describe('Job: phase-timeout (AFK Logic)', () => {
    it('Debe descartar el job si la fase actual ya no es la esperada', async () => {
      // Simulamos que la partida en Redis ya avanzó a SUBMISSION
      (GameRedisRepository.getGame as jest.Mock).mockResolvedValue({
        phase: 'SUBMISSION',
      });

      const job = {
        name: 'phase-timeout',
        data: { lobbyCode: 'SALA1', expectedPhase: 'STORYTELLING' },
      };

      await workerCallback(job);

      // Como la fase cambió, NO debe ejecutar ninguna acción
      expect(mockHandleAction).not.toHaveBeenCalled();
    });

    it('Debe inyectar SEND_STORY si el Narrador está AFK en STORYTELLING', async () => {
      (GameRedisRepository.getGame as jest.Mock).mockResolvedValue({
        phase: 'STORYTELLING',
        currentRound: { storytellerId: 'u_1' },
        hands: { u_1: [10, 20] }, // Mano del narrador
      });

      const job = {
        name: 'phase-timeout',
        data: { lobbyCode: 'SALA1', expectedPhase: 'STORYTELLING' },
      };

      await workerCallback(job);

      // Verificamos que llamó al servicio para forzar la carta del narrador
      expect(mockHandleAction).toHaveBeenCalledWith(
        'SALA1',
        expect.objectContaining({
          type: 'SEND_STORY',
          playerId: 'u_1',
          payload: expect.objectContaining({ clue: 'Tiempo agotado (Bot)' }),
        }),
      );
    });

    it('Debe reprogramar el timeout si hay un minijuego activo y no ejecutar acciones bloqueadas', async () => {
      (GameRedisRepository.getGame as jest.Mock).mockResolvedValue({
        phase: 'SCORING',
        phaseVersion: 3,
        isMinigameActive: true,
      });

      const job = {
        name: 'phase-timeout',
        data: {
          lobbyCode: 'SALA1',
          expectedPhase: 'SCORING',
          expectedPhaseVersion: 3,
        },
      };

      await workerCallback(job);

      expect(mockHandleAction).not.toHaveBeenCalled();
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'phase-timeout',
        expect.objectContaining({
          lobbyCode: 'SALA1',
          expectedPhase: 'SCORING',
          expectedPhaseVersion: 3,
        }),
        expect.objectContaining({
          delay: 5000,
          removeOnComplete: true,
        }),
      );
    });

    it('Debe ignorar el timeout de scoring si la secuencia post-minijuego sigue activa', async () => {
      (GameRedisRepository.getGame as jest.Mock).mockResolvedValue({
        phase: 'SCORING',
        phaseVersion: 3,
        isMinigameActive: false,
        postMinigameSequence: {
          sequenceId: 'seq-1',
          phaseVersion: 3,
          stage: 'reveal',
        },
      });

      const job = {
        name: 'phase-timeout',
        data: {
          lobbyCode: 'SALA1',
          expectedPhase: 'SCORING',
          expectedPhaseVersion: 3,
        },
      };

      await workerCallback(job);

      expect(mockHandleAction).not.toHaveBeenCalled();
      expect(mockQueueAdd).not.toHaveBeenCalled();
    });
  });

  describe('Job: star-expiration', () => {
    it('Debe desactivar la estrella si sigue activa', async () => {
      const mockState = { isStarActive: true };
      (GameRedisRepository.getGame as jest.Mock).mockResolvedValue(mockState);

      const job = {
        name: 'star-expiration',
        data: { gameId: 'SALA1' },
      };

      await workerCallback(job);

      // Comprobamos que cambió el estado y lo guardó
      expect(mockState.isStarActive).toBe(false);
      expect(GameRedisRepository.saveGame).toHaveBeenCalledWith(
        'SALA1',
        mockState,
      );
    });
  });

  describe('Job: minigame-fallback', () => {
    it('Debe desbloquear el minijuego y emitir si estaba colgado', async () => {
      // Simulamos que el servicio devuelve emisiones (significa que estaba colgado)
      const mockEmissions = [
        { room: 'SALA1', event: 'special_event', data: {} },
      ];
      mockForceUnlock.mockResolvedValue(mockEmissions);

      const job = {
        name: 'minigame-fallback',
        data: { gameId: 'SALA1', conflictId: 'conflict-1' },
      };

      await workerCallback(job);

      expect(mockForceUnlock).toHaveBeenCalledWith('SALA1', 'conflict-1');
      expect(mockIo.to).toHaveBeenCalledWith('SALA1');
      expect(mockIo.emit).toHaveBeenCalledWith('special_event', {});
    });
  });

  describe('Job: post-minigame-sequence', () => {
    it('Debe emitir el snapshot de scoring y programar el siguiente paso', async () => {
      const mockState = {
        lobbyCode: 'SALA1',
        phase: 'SCORING',
        phaseVersion: 4,
        isMinigameActive: false,
        postMinigameSequence: {
          sequenceId: 'seq-1',
          phaseVersion: 4,
          stage: 'reveal',
        },
      };
      (GameRedisRepository.getGame as jest.Mock).mockResolvedValue(mockState);

      await workerCallback({
        name: 'post-minigame-sequence',
        data: {
          lobbyCode: 'SALA1',
          sequenceId: 'seq-1',
          expectedPhase: 'SCORING',
          expectedPhaseVersion: 4,
          stage: 'show-scoring',
        },
      });

      expect(GameRedisRepository.saveGame).toHaveBeenCalledWith(
        'SALA1',
        expect.objectContaining({
          postMinigameSequence: expect.objectContaining({ stage: 'scoring' }),
        }),
      );
      expect(mockIo.emit).toHaveBeenCalledWith(
        'server:game:state_updated',
        expect.objectContaining({ lastAction: 'SCORING' }),
      );
      expect(mockSchedulePostMinigameSequence).toHaveBeenCalledWith(
        'SALA1',
        'seq-1',
        'SCORING',
        4,
        'next-round',
        2000,
      );
    });

    it('Debe avanzar a la siguiente ronda una sola vez en el segundo paso', async () => {
      const mockState = {
        lobbyCode: 'SALA1',
        phase: 'SCORING',
        phaseVersion: 4,
        isMinigameActive: false,
        postMinigameSequence: {
          sequenceId: 'seq-1',
          phaseVersion: 4,
          stage: 'scoring',
        },
      };
      (GameRedisRepository.getGame as jest.Mock).mockResolvedValue(mockState);

      await workerCallback({
        name: 'post-minigame-sequence',
        data: {
          lobbyCode: 'SALA1',
          sequenceId: 'seq-1',
          expectedPhase: 'SCORING',
          expectedPhaseVersion: 4,
          stage: 'next-round',
        },
      });

      expect(GameRedisRepository.saveGame).toHaveBeenCalledWith(
        'SALA1',
        expect.objectContaining({ postMinigameSequence: null }),
      );
      expect(mockHandleAction).toHaveBeenCalledWith('SALA1', {
        type: 'NEXT_ROUND',
        playerId: 'SYSTEM',
      });
    });
  });
});
