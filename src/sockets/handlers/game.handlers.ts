// src/sockets/handlers/game.handlers.ts
import { Server } from 'socket.io';
import { AuthenticatedSocket } from '../../api/middlewares/socket-auth.middleware';
import { GameService } from '../../services/game.service';
import { z } from 'zod';

const GameActionSchema = z.object({
  lobbyCode: z.string().length(4, "Código de sala inválido"),
  actionType: z.string(),
  payload: z.any().optional()
});

export const registerGameHandlers = (io: Server, socket: AuthenticatedSocket) => {
  const gameService = new GameService(io);

  // ÚNICO canal de acciones para el juego
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

      const action: any = { type: actionType, playerId: userId, payload: payload || {} };

      // Ejecutar lógica de turno
      await gameService.handleAction(lobbyCode, action);

    } catch (error: any) {
      socket.emit('server:error', { message: error.message });
    }
  });
};