export { gameRepository } from './game.schema';
export { lobbyRepository } from './lobby.schema';
export { userSessionRepository } from './user-session.schema';
export { shopRedisRepository } from './shop.schema';

import { gameRepository } from './game.schema';
import { lobbyRepository } from './lobby.schema';
import { userSessionRepository } from './user-session.schema';
import { shopRedisRepository } from './shop.schema';

export const initRedisIndices = async () => {
  await Promise.all([
    lobbyRepository.createIndex(),
    gameRepository.createIndex(),
    userSessionRepository.createIndex(),
    shopRedisRepository.createIndex()
  ]);

  console.log('🚀 Redis-OM indices created');
};
