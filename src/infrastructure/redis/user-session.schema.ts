import { Repository, Schema } from 'redis-om';

import { safeRedis } from '../redis';

export const userSessionSchema = new Schema(
  'user_session',
  {
    userId: { type: 'string', indexed: true },
    lobbyCode: { type: 'string' },
  },
  {
    dataStructure: 'JSON',
  },
);

export const userSessionRepository = new Repository(
  userSessionSchema,
  safeRedis as any,
);
