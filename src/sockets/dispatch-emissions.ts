import { Server } from 'socket.io';

import { SocketEmission } from '../services/game.service';

export function dispatchEmissions(
  io: Server,
  emissions: SocketEmission[],
): void {
  for (const { room, event, data, delayMs } of emissions) {
    if (delayMs && delayMs > 0) {
      setTimeout(() => {
        io.to(room).emit(event, data);
      }, delayMs);
      continue;
    }

    io.to(room).emit(event, data);
  }
}
