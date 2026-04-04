// src/infrastructure/redis.ts
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrlString = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({
  url: redisUrlString,
});

const parsedUrl = new URL(redisUrlString);
export const bullmqConnection = {
  host: parsedUrl.hostname || 'localhost',
  port: parseInt(parsedUrl.port || '6379', 10),
  username: parsedUrl.username || undefined,
  password: parsedUrl.password || undefined,
};

redisClient.on('error', (err) => console.error('❌ Redis Client Error', err));
redisClient.on('connect', () => console.log('✅ Redis conectado correctamente'));

export const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
};


// REPOSITORIO DE SESIONES DE USUARIO (Reconexión de partidas)
// Esto gestiona la clave user:session:{userId} -> gameId
export const SessionRepository = {
  async setActiveGame(userId: string, lobbyCode: string): Promise<void> {
    // Expiración de 2 horas (7200s) al igual que el juego para liberar memoria [cite: 127]
    await redisClient.set(`user:session:${userId}`, lobbyCode, { EX: 7200 });
  },

  async getActiveGame(userId: string): Promise<string | null> {
    return await redisClient.get(`user:session:${userId}`);
  },

  async clearActiveGame(userId: string): Promise<void> {
    await redisClient.del(`user:session:${userId}`);
  }
};



