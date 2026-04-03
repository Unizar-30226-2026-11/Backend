// src/infrastructure/redis.ts
import dotenv from 'dotenv';
import { createClient } from 'redis';

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
redisClient.on('connect', () =>
  console.log('✅ Redis conectado correctamente'),
);

export const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
};

// REPOSITORIO DE ESTADO DEL JUEGO

//Esto encapsula la lectura/escritura del JSON de la partida para que el Service quede limpio.
export const GameRepository = {
  async saveGameState(lobbyCode: string, state: any): Promise<void> {
    // Expiración de 2 horas (7200s) para limpiar memoria automáticamente
    await redisClient.set(`game:${lobbyCode}`, JSON.stringify(state), {
      EX: 7200,
    });
  },

  async getGameState(lobbyCode: string): Promise<any | null> {
    const data = await redisClient.get(`game:${lobbyCode}`);
    return data ? JSON.parse(data) : null;
  },

  async deleteGameState(lobbyCode: string): Promise<void> {
    await redisClient.del(`game:${lobbyCode}`);
  },
};
