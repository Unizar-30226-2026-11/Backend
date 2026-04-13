// src/workers/game.worker.ts
import { Job, Worker } from 'bullmq';
import { Server } from 'socket.io';

import { bullmqConnection } from '../infrastructure/redis';
import { GameRedisRepository } from '../repositories/game.repository';
import { GameService } from '../services/game.service';
import { GameAction } from '../shared/types/game.types';

export const initializeGameWorker = (io: Server) => {
  const gameService = new GameService(GameRedisRepository);

  const gameWorker = new Worker(
    'game-timeouts',
    async (job: Job) => {
      // Extraemos las propiedades. Nota: a veces usáis lobbyCode y otras gameId para referiros al mismo ID de sala.
      const { lobbyCode, expectedPhase, gameId } = job.data;

      // Unificamos el ID de la sala por si acaso en el frontend/backend usan diferentes nombres de variable en el payload
      const targetRoomId = gameId || lobbyCode;

      try {
        switch (job.name) {
          // ==========================================
          // 1. TIMEOUTS DE FASE (AFK)
          // ==========================================
          case 'phase-timeout': {
            console.log(
              `[Worker] Evaluando timeout para la sala ${targetRoomId} (Fase: ${expectedPhase})`,
            );

            const state: any = await GameRedisRepository.getGame(targetRoomId);
            if (!state) return;

            if (state.phase !== expectedPhase) {
              console.log(
                `[Worker] La sala ${targetRoomId} ya está en ${state.phase}. Ignorando timer.`,
              );
              return;
            }

            console.log(
              `[Worker] ¡Tiempo agotado en ${targetRoomId}! Ejecutando lógica AFK para ${expectedPhase}...`,
            );
            const actionsToExecute: GameAction[] = [];

            switch (expectedPhase) {
              case 'STORYTELLING': {
                const storytellerId = state.currentRound.storytellerId;
                const hand = state.hands[storytellerId] || [];
                if (hand.length > 0) {
                  const randomCard =
                    hand[Math.floor(Math.random() * hand.length)];
                  actionsToExecute.push({
                    type: 'SEND_STORY',
                    playerId: storytellerId,
                    payload: {
                      cardId: randomCard,
                      clue: 'Tiempo agotado (Bot)',
                    },
                  });
                }
                break;
              }
              case 'SUBMISSION': {
                const playedCards = state.currentRound.playedCards || {};
                const missingPlayers = state.players.filter(
                  (pId: string) =>
                    pId !== state.currentRound.storytellerId &&
                    playedCards[pId] === undefined,
                );

                for (const pId of missingPlayers) {
                  const hand = state.hands[pId] || [];
                  if (hand.length > 0) {
                    const randomCard =
                      hand[Math.floor(Math.random() * hand.length)];
                    actionsToExecute.push({
                      type: 'SUBMIT_CARD',
                      playerId: pId,
                      payload: { cardId: randomCard },
                    });
                  }
                }
                break;
              }
              case 'VOTING': {
                const votes = state.currentRound.votes || {};
                const boardCards = state.currentRound.boardCards || [];

                const missingPlayers = state.players.filter(
                  (pId: string) =>
                    pId !== state.currentRound.storytellerId &&
                    votes[pId] === undefined,
                );

                for (const pId of missingPlayers) {
                  const myCard = state.currentRound.playedCards[pId];
                  const validOptions = boardCards.filter(
                    (cId: number) => cId !== myCard,
                  );

                  if (validOptions.length > 0) {
                    const randomVote =
                      validOptions[
                        Math.floor(Math.random() * validOptions.length)
                      ];
                    actionsToExecute.push({
                      type: 'CAST_VOTE',
                      playerId: pId,
                      payload: { cardId: randomVote },
                    });
                  }
                }
                break;
              }
              case 'SCORING': {
                actionsToExecute.push({
                  type: 'NEXT_ROUND',
                  playerId: 'SYSTEM',
                });
                break;
              }
            }

            for (const action of actionsToExecute) {
              const emissions = await gameService.handleAction(
                targetRoomId,
                action,
              );
              if (emissions && emissions.length > 0) {
                for (const { room, event, data } of emissions) {
                  io.to(room).emit(event, data);
                }
              }
            }
            break;
          }

          // ==========================================
          // 2. EXPIRACIÓN DE LA ESTRELLA FUGAZ
          // ==========================================
          case 'star-expiration': {
            console.log(
              `[Worker] Evaluando expiración de la estrella para la sala ${targetRoomId}...`,
            );
            // 1. Recuperar el estado actual
            const state: any = await GameRedisRepository.getGame(targetRoomId);
            if (!state) return;
            // 2. Comprobar si la estrella sigue activa
            if (!state.isStarActive) {
              console.log(
                `[Worker] La estrella en ${targetRoomId} ya fue reclamada. Job ignorado.`,
              );
              return;
            }
            // 3. Si sigue activa, desactivarla y guardar
            console.log(
              `[Worker] La estrella en ${targetRoomId} no fue reclamada a tiempo. Desactivando.`,
            );
            state.isStarActive = false;
            await GameRedisRepository.saveGame(targetRoomId, state);

            break;
          }

          // ==========================================
          // 3. FALLBACK ANTI-CUELGUES (MINIJUEGOS)
          // ==========================================
          case 'minigame-fallback': {
            console.log(
              `[Worker] Evaluando posible cuelgue de minijuego en la sala ${targetRoomId}...`,
            );

            // 1. Delegamos toda la lógica de validación al método de tu compañero
            const emissions =
              await gameService.forceUnlockMinigame(targetRoomId);

            // 2. Si el método nos devuelve emisiones, significa que estaba colgado y lo acaba de desbloquear
            if (emissions && emissions.length > 0) {
              console.log(
                `[Worker] ¡Alerta! Minijuego colgado en ${targetRoomId}. Desbloqueando forzosamente y avisando a los jugadores...`,
              );
              for (const { room, event, data } of emissions) {
                io.to(room).emit(event, data);
              }
            } else {
              // Si nos devuelve un array vacío, significa que el frontend sí contestó a tiempo y el minijuego ya estaba en false
              console.log(
                `[Worker] El minijuego en ${targetRoomId} se resolvió correctamente a tiempo. Job ignorado.`,
              );
            }

            break;
          }

          default:
            console.warn(`[Worker] Job desconocido recibido: ${job.name}`);
            break;
        }
      } catch (error: any) {
        console.error(
          `[Worker Error] Job ${job.name} falló para sala ${targetRoomId}:`,
          error.message,
        );
      }
    },
    {
      connection: bullmqConnection,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  );

  gameWorker.on('failed', (job, err) => {
    console.error(
      `[Worker] Error fatal en el job ${job?.name} (Data: ${JSON.stringify(job?.data)}):`,
      err,
    );
  });

  console.log(
    '🚀 Game Worker inicializado y escuchando la cola "game-timeouts"',
  );
};
