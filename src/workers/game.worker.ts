// src/workers/game.worker.ts
import { Job, Worker } from 'bullmq';
import { Server } from 'socket.io';

import { bullmqConnection } from '../infrastructure/redis';
import { GameRedisRepository } from '../repositories/game.repository';
import { UserRedisRepository } from '../repositories/user.repository';
import {
  buildPublicGameState,
  GameService,
  gameTimeoutsQueue,
  POST_MINIGAME_SCORING_DELAY_MS,
} from '../services/game.service';
import { LobbyService } from '../services/lobby.service';
import { GameAction, GameState } from '../shared/types/game.types';
import { dispatchEmissions } from '../sockets/dispatch-emissions';

export const initializeGameWorker = (io: Server) => {
  const gameService = new GameService(GameRedisRepository);
  const MINIGAME_PHASE_TIMEOUT_RETRY_MS = 5000;

  const gameWorker = new Worker(
    'game-timeouts',
    async (job: Job) => {
      // Extraemos las propiedades. Nota: a veces usáis lobbyCode y otras gameId para referiros al mismo ID de sala.
      const { lobbyCode, expectedPhase, expectedPhaseVersion, gameId } =
        job.data;

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

            if (
              state.phase !== expectedPhase ||
              (expectedPhaseVersion &&
                state.phaseVersion !== expectedPhaseVersion)
            ) {
              console.log(
                `[Worker] La sala ${targetRoomId} ya está en ${state.phase}. Ignorando timer.`,
              );
              return;
            }

            if (state.isMinigameActive) {
              console.log(
                `[Worker] La sala ${targetRoomId} tiene un minijuego activo. Reprogramando timeout de fase ${expectedPhase}.`,
              );
              await gameTimeoutsQueue.add(
                'phase-timeout',
                {
                  lobbyCode: targetRoomId,
                  expectedPhase,
                  expectedPhaseVersion,
                },
                {
                  delay: MINIGAME_PHASE_TIMEOUT_RETRY_MS,
                  jobId: `timeout-${targetRoomId}-${expectedPhase}-${Date.now()}`,
                  removeOnComplete: true,
                },
              );
              return;
            }

            if (expectedPhase === 'SCORING' && state.postMinigameSequence) {
              console.log(
                `[Worker] La sala ${targetRoomId} sigue en secuencia post-minijuego. Ignorando timeout de scoring.`,
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
                const votes = state.currentRound.votes || [];
                const boardCards = state.currentRound.boardCards || [];

                const missingPlayers = state.players.filter(
                  (pId: string) =>
                    pId !== state.currentRound.storytellerId &&
                    !votes.some(
                      (vote: { voterId: string }) => vote.voterId === pId,
                    ),
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
                dispatchEmissions(io, emissions);
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
            const emissions = await gameService.forceUnlockMinigame(
              targetRoomId,
              job.data.conflictId,
            );

            // 2. Si el método nos devuelve emisiones, significa que estaba colgado y lo acaba de desbloquear
            if (emissions && emissions.length > 0) {
              console.log(
                `[Worker] ¡Alerta! Minijuego colgado en ${targetRoomId}. Desbloqueando forzosamente y avisando a los jugadores...`,
              );
              dispatchEmissions(io, emissions);
            } else {
              // Si nos devuelve un array vacío, significa que el frontend sí contestó a tiempo y el minijuego ya estaba en false
              console.log(
                `[Worker] El minijuego en ${targetRoomId} se resolvió correctamente a tiempo. Job ignorado.`,
              );
            }

            break;
          }

          case 'post-minigame-sequence': {
            const state = (await GameRedisRepository.getGame(
              targetRoomId,
            )) as GameState | null;
            if (!state) return;

            const sequence = state.postMinigameSequence;
            const stage = job.data.stage as 'show-scoring' | 'next-round';

            if (
              !sequence ||
              sequence.sequenceId !== job.data.sequenceId ||
              state.phase !== expectedPhase ||
              state.phaseVersion !== expectedPhaseVersion ||
              state.isMinigameActive
            ) {
              return;
            }

            if (stage === 'show-scoring') {
              if (sequence.stage !== 'reveal') {
                return;
              }

              state.postMinigameSequence = {
                ...sequence,
                stage: 'scoring',
              };
              await GameRedisRepository.saveGame(targetRoomId, state);
              dispatchEmissions(io, [
                {
                  room: targetRoomId,
                  event: 'server:game:state_updated',
                  data: {
                    state: buildPublicGameState(state),
                    lastAction: 'SCORING',
                  },
                },
              ]);
              await gameService.schedulePostMinigameSequence(
                targetRoomId,
                sequence.sequenceId,
                state.phase,
                state.phaseVersion ?? 1,
                'next-round',
                POST_MINIGAME_SCORING_DELAY_MS,
              );
              return;
            }

            if (sequence.stage !== 'scoring') {
              return;
            }

            state.postMinigameSequence = null;
            await GameRedisRepository.saveGame(targetRoomId, state);
            const emissions = await gameService.handleAction(targetRoomId, {
              type: 'NEXT_ROUND',
              playerId: 'SYSTEM',
            });
            dispatchEmissions(io, emissions);
            return;
          }

          case 'check-afk': {
            console.log(
              `[Worker] Evaluando posible AFK en la sala ${targetRoomId}...`,
            );
            const { userId, lobbyCode, socketId } = job.data;

            // 1. Miramos cuándo fue su última actividad
            const lastActivity =
              await UserRedisRepository.getLastActivity(userId);

            // Si no hay registro, asumimos que ya se desconectó voluntariamente
            if (!lastActivity) return;

            const now = Date.now();
            const timeSinceLastAction = now - lastActivity;
            const AFK_LIMIT = 1 * 60 * 1000; // 1 minuto en milisegundos

            if (timeSinceLastAction >= AFK_LIMIT) {
              console.log(
                `[Worker] 🥾 Expulsando al jugador ${userId} por inactividad (>5 mins).`,
              );

              // Aquí implementas la lógica de kick (usando tus servicios actuales)
              if (lobbyCode) {
                // 1. Lo sacamos de Redis del Lobby y de la Partida
                const gameState = await GameRedisRepository.getGame(lobbyCode);
                if (gameState) {
                  await gameService.kickPlayer(lobbyCode, userId);
                }
                await LobbyService.leaveLobby(lobbyCode, userId);
                await UserRedisRepository.clearSession(userId);
                // 2. Avisamos al resto de la sala
                io.to(lobbyCode).emit('server:lobby:player_left', {
                  // o SOCKET_EVENTS.LOBBY_PLAYER_LEFT
                  user: userId, // Idealmente buscas su username
                  message: 'Un jugador ha sido expulsado por inactividad.',
                });

                // 3. Le mandamos un evento a él para que el frontend sepa que fue kickeado y lo redirija al Home
                io.to(socketId).emit('server:force_disconnect', {
                  message: 'Has sido desconectado por inactividad.',
                });

                // 4. Desconectamos su socket a la fuerza
                const sockets = await io.in(socketId).fetchSockets();
                if (sockets.length > 0) {
                  sockets[0].disconnect(true);
                }
              }
            } else {
              // EL USUARIO SIGUE VIVO: Reprogramamos el job por la diferencia de tiempo
              const timeLeft = AFK_LIMIT - timeSinceLastAction;
              console.log(
                `[Worker] ⏱️ ${userId} sigue activo. Re-comprobando AFK en ${timeLeft}ms.`,
              );

              // En BullMQ, para encolar desde el propio worker sin ensuciar, usamos la misma cola
              await gameTimeoutsQueue.add(
                'check-afk',
                { userId, lobbyCode, socketId },
                { delay: timeLeft, jobId: `afk-${userId}-${now}` }, // Nuevo ID para no chocar
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
