// src/sockets/handlers/game.handlers.ts
import { Server } from 'socket.io';
import { z } from 'zod';

import { GameRedisRepository } from '../../repositories/game.repository';
import { GameService, SocketEmission } from '../../services/game.service';
import { ID_PREFIXES } from '../../shared/constants/id-prefixes';
import { AuthenticatedSocket } from '../middleware/socket-auth.middleware';

const GameActionSchema = z.object({
  lobbyCode: z.string().length(4, 'Código de sala inválido'),
  actionType: z.string(),
  payload: z.any().optional(),
});

function normalizeCardReference(value: unknown): unknown {
  if (typeof value === 'string' && value.startsWith(ID_PREFIXES.CARD)) {
    const numericId = parseInt(value.replace(ID_PREFIXES.CARD, ''), 10);
    return Number.isNaN(numericId) ? value : numericId;
  }

  return value;
}

function normalizeGamePayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const normalizedPayload: Record<string, unknown> = {
    ...(payload as Record<string, unknown>),
  };

  if ('cardId' in normalizedPayload) {
    normalizedPayload.cardId = normalizeCardReference(normalizedPayload.cardId);
  }

  if (Array.isArray(normalizedPayload.cardIds)) {
    normalizedPayload.cardIds = normalizedPayload.cardIds.map(
      normalizeCardReference,
    );
  }

  return normalizedPayload;
}

const MinigameScoreSchema = z.object({
  lobbyCode: z.string().length(4, 'Código de sala inválido'),
  score: z.number().min(0, 'La puntuación no puede ser negativa'),
});

/**
 * Ejecuta todas las emisiones devueltas por el service.
 * Esta función es el único punto del handler que habla con Socket.io.
 */
function dispatchEmissions(io: Server, emissions: SocketEmission[]): void {
  for (const { room, event, data } of emissions) {
    io.to(room).emit(event, data);
  }
}

const lobbyActionQueues = new Map<string, Promise<unknown>>();

async function runLobbyAction<T>(
  lobbyCode: string,
  task: () => Promise<T>,
): Promise<T> {
  const previousTask = lobbyActionQueues.get(lobbyCode) ?? Promise.resolve();
  const currentTask = previousTask.then(task, task);

  lobbyActionQueues.set(
    lobbyCode,
    currentTask.finally(() => {
      if (lobbyActionQueues.get(lobbyCode) === currentTask) {
        lobbyActionQueues.delete(lobbyCode);
      }
    }),
  );

  return currentTask;
}

export const registerGameHandlers = (
  io: Server,
  socket: AuthenticatedSocket,
) => {
  const gameService = new GameService(GameRedisRepository);

  // Inyectamos el callback para emisiones diferidas (ej: expiración de estrella)
  gameService._deferredEmitCallback = (emission: SocketEmission) => {
    io.to(emission.room).emit(emission.event, emission.data);
  };

  // ──────────────────────────────────────────────
  // ÚNICO canal de acciones para el juego
  // ──────────────────────────────────────────────
  socket.on('client:game:action', async (rawPayload: unknown) => {
    try {
      const result = GameActionSchema.safeParse(rawPayload);
      if (!result.success) {
        socket.emit('server:error', { message: 'Formato de acción inválido' });
        return;
      }

      const { lobbyCode, actionType, payload } = result.data;
      const userId = socket.user?.id;
      if (!userId) {
        socket.emit('server:error', { message: 'No autenticado' });
        return;
      }

      const action: any = {
        type: actionType,
        playerId: userId,
        payload: normalizeGamePayload(payload || {}),
      };

      // El service ejecuta la lógica y devuelve qué hay que emitir
      const emissions = await runLobbyAction(lobbyCode, () =>
        gameService.handleAction(lobbyCode, action),
      );
      dispatchEmissions(io, emissions);
    } catch (error: any) {
      socket.emit('server:error', { message: error.message });
    }
  });

  // ──────────────────────────────────────────────
  // ESTRELLA: disparar evento
  // ──────────────────────────────────────────────
  socket.on('client:game:trigger_star', async (rawPayload: unknown) => {
    try {
      const { lobbyCode } = rawPayload as { lobbyCode: string };
      const emissions = await runLobbyAction(lobbyCode, () =>
        gameService.triggerStarEvent(lobbyCode),
      );
      dispatchEmissions(io, emissions);
    } catch (error: unknown) {
      socket.emit('server:error', { message: (error as Error).message });
    }
  });

  // ──────────────────────────────────────────────
  // ESTRELLA: reclamar
  // ──────────────────────────────────────────────
  socket.on('client:game:claim_star', async (rawPayload: unknown) => {
    try {
      const { lobbyCode } = rawPayload as { lobbyCode: string };
      const userId = socket.user?.id;
      if (!userId) {
        socket.emit('server:error', { message: 'No autenticado' });
        return;
      }

      const emissions = await runLobbyAction(lobbyCode, () =>
        gameService.claimStar(lobbyCode, userId),
      );
      dispatchEmissions(io, emissions);
    } catch (error: unknown) {
      socket.emit('server:error', { message: (error as Error).message });
    }
  });

  //Finalizar partida
  socket.on('client:game:end', async (rawPayload: unknown) => {
    try {
      const { lobbyCode } = rawPayload as { lobbyCode: string };
      const emissions = await runLobbyAction(lobbyCode, () =>
        gameService.finalizeGame(lobbyCode),
      );
      dispatchEmissions(io, emissions);
    } catch (error: unknown) {
      socket.emit('server:error', { message: (error as Error).message });
    }
  });

  // MINIJUEGOS: Recibir resultado del Frontend
  socket.on('client:game:minigame_score', async (rawPayload: unknown) => {
    try {
      const result = MinigameScoreSchema.safeParse(rawPayload);
      if (!result.success) {
        socket.emit('server:error', { message: 'Payload de puntuación inválido' });
        return;
      }

      const { lobbyCode, score } = result.data;
      const userId = socket.user?.id;

      if (!userId) {
        socket.emit('server:error', { message: 'No autenticado' });
        return;
      }

      // El jugador envía su puntuación. El servicio espera al otro.
      const emissions = await runLobbyAction(lobbyCode, () =>
        gameService.submitMinigameScore(lobbyCode, userId, score),
      );
      
      // Emitimos el resultado (si es el primero no pasa nada, si es el último emite)
      dispatchEmissions(io, emissions);
    } catch (error: any) {
      socket.emit('server:error', { message: error.message });
    }
  });
};
