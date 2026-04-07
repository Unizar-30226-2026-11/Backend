export { gameRepository } from './game.schema';
export { lobbyRepository } from './lobby.schema';
export { userSessionRepository } from './user-session.schema';

import { gameRepository } from './game.schema';
import { lobbyRepository } from './lobby.schema';
import { userSessionRepository } from './user-session.schema';

export const initRedisIndices = async () => {
  await Promise.all([
    lobbyRepository.createIndex(),
    gameRepository.createIndex(),
    userSessionRepository.createIndex(),
  ]);

  console.log('🚀 Redis-OM indices created');
};
