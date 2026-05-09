import { Server, Socket } from 'socket.io';

import { GameRedisRepository } from '../../repositories/game.repository';
import { LobbyRedisRepository } from '../../repositories/lobby.repository';
import { UserRedisRepository } from '../../repositories/user.repository';
import {
  buildRecoveredGameState,
  GameService,
  gameTimeoutsQueue,
  serializePublicCards,
} from '../../services/game.service';
import { LobbyService } from '../../services/lobby.service';
import { SERVER_EVENTS } from '../events';
import {
  AuthenticatedSocket,
  authenticateSocket,
} from '../middleware/socket-auth.middleware';
import { socketPresenceRegistry } from '../presence.registry';
import { registerChatHandlers } from './chat.handler';
import { registerGameHandlers } from './game.handlers';
import { registerLobbyHandlers } from './lobby.handler';

const connectedUsers = new Map<string, Socket>();

export const setupSockets = (io: Server) => {
  io.use(authenticateSocket);

  io.on('connection', async (socket: AuthenticatedSocket) => {
    const userId = socket.user?.id;
    const lobbyCode = socket.data?.lobbyCode;

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    // Manejo de AFK
    await UserRedisRepository.updateLastActivity(userId);
    await gameTimeoutsQueue.add(
      'check-afk',
      { userId, lobbyCode, socketId: socket.id },
      { delay: 1800000, jobId: `afk-${userId}-${Date.now()}` },
    );
    console.log(`AFK check job added for user ${userId} in lobby ${lobbyCode}`);

    socket.onAny(async (_eventName, ..._args) => {
      await UserRedisRepository.updateLastActivity(userId);
    });

    console.log(
      `Socket conectado: ${socket.id} (Usuario: ${socket.user?.username})`,
    );

    // Control multitab: la sesión nueva reemplaza a la anterior.
    if (connectedUsers.has(userId)) {
      const oldSocket = connectedUsers.get(userId);
      if (oldSocket && oldSocket.id !== socket.id) {
        oldSocket.emit(SERVER_EVENTS.FORCE_DISCONNECT, {
          message:
            'Has abierto el juego en otra pestaña. Desconectando sesión anterior.',
        });
        oldSocket.disconnect(true);
      }
    }
    connectedUsers.set(userId, socket);
    socketPresenceRegistry.markConnected(userId);

    socket.join(userId);

    // Lógica de auto-reconexión al iniciar.
    if (lobbyCode) {
      try {
        const gameState = await GameRedisRepository.getGame(lobbyCode);

        if (gameState) {
          // Conservamos la reconexión real, pero solo si la partida sigue viva.
          await UserRedisRepository.saveSession(userId, lobbyCode);
          socket.join(lobbyCode);
          console.log(
            `${socket.user?.username} auto-reconectado a la partida: ${lobbyCode}`,
          );

          const gameService = new GameService(GameRedisRepository);
          const reconnectEmissions = await gameService.handleAction(lobbyCode, {
            type: 'RECONNECT_PLAYER',
            playerId: userId,
          } as any);

          for (const { room, event, data } of reconnectEmissions) {
            io.to(room).emit(event, data);
          }

          const refreshedGameState =
            (await GameRedisRepository.getGame(lobbyCode)) || gameState;

          if (refreshedGameState.phase === 'SCORING') {
            await gameService.rearmCurrentPhaseTimeout(refreshedGameState);
          }

          if (
            !reconnectEmissions.some(
              (emission) =>
                emission.room === userId &&
                emission.event === SERVER_EVENTS.PRIVATE_HAND,
            )
          ) {
            socket.emit(SERVER_EVENTS.PRIVATE_HAND, {
              hand: serializePublicCards(
                refreshedGameState.hands[userId] || [],
                refreshedGameState.cardUrls || {},
              ),
            });
          }

          socket.emit(SERVER_EVENTS.SESSION_RECOVERED, {
            lobbyCode,
            state: buildRecoveredGameState(refreshedGameState, userId),
          });
        } else {
          const existingLobby =
            await LobbyRedisRepository.findByCode(lobbyCode);

          if (!existingLobby) {
            // Si el JWT llega con una sala inexistente, limpiamos la sesiÃ³n
            // en Redis para cortar el ciclo de reconexiÃ³n fantasma.
            await UserRedisRepository.clearSession(userId);
            console.log(
              `${socket.user?.username} tení­a una sesión huérfana en ${lobbyCode}; se limpia.`,
            );
          } else {
            await UserRedisRepository.saveSession(userId, lobbyCode);
            socket.join(lobbyCode);
            console.log(
              `${socket.user?.username} auto-reconectado a la sala: ${lobbyCode}`,
            );

            // Si el disconnect lo sacó del array de jugadores, lo reinsertamos.
            const updatedLobby = await LobbyService.joinLobby(
              lobbyCode,
              userId,
            ).catch(() => LobbyRedisRepository.findByCode(lobbyCode));

            if (updatedLobby) {
              socket.emit(SERVER_EVENTS.LOBBY_RECOVERED, {
                lobbyCode,
                lobby: updatedLobby,
              });

              socket
                .to(lobbyCode)
                .emit(SERVER_EVENTS.LOBBY_PLAYER_RECONNECTED, {
                  user: socket.user?.username,
                  message: `${socket.user?.username} se ha reconectado a la sala.`,
                });

              io.to(lobbyCode).emit(
                SERVER_EVENTS.LOBBY_STATE_UPDATED,
                updatedLobby,
              );
            }
          }
        }
      } catch (error) {
        console.error('Error al recuperar sesión:', error);
      }
    }

    socket.on('joinLobbyRoom', (code: string) => {
      socket.join(code);
    });

    registerChatHandlers(io, socket);
    registerLobbyHandlers(io, socket);
    registerGameHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log(`Socket desconectado: ${socket.id}`);
      // No tocamos Redis aquí­ para preservar la reconexiónn legítima.
      if (connectedUsers.get(userId)?.id === socket.id) {
        connectedUsers.delete(userId);
        socketPresenceRegistry.markDisconnected(userId);
      }
    });
  });
};
