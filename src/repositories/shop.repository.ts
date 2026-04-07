// src/repositories/shop.repository.ts
import { redisClient } from '../infrastructure/redis';
import { DailyShopState } from '../infrasctructure/redis/shop.schema';

export const ShopRedisRepository = {
  async getDailyShop(userId: number): Promise<DailyShopState | null> {
    const data = await redisClient.get(`shop:daily:${userId}`);
    return data ? JSON.parse(data) : null;
  },

  async saveDailyShop(userId: number, state: DailyShopState, ttlSeconds: number): Promise<void> {
   const CACHE_KEY = `shop:daily:${userId}`;
    // Usamos el TTL dinámico calculado por el servicio
    await redisClient.setEx(CACHE_KEY, ttlSeconds, JSON.stringify(state));
  },

  async deleteDailyShop(userId: number): Promise<void> {
    await redisClient.del(`shop:daily:${userId}`);
  }
};

