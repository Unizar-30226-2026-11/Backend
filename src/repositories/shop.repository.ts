// src/repositories/shop.repository.ts
import { safeRedis } from '../infrastructure/redis';
import { DailyShopState } from '../shared/types/shop.types';

export const ShopRedisRepository = {
    async getDailyShop(userId: number): Promise<DailyShopState | null> {
        const data = await safeRedis.get(`shop:daily:${userId}`);
        return data ? (JSON.parse(data) as DailyShopState) : null;
    },

    async saveDailyShop(userId: number, state: DailyShopState, ttlSeconds: number): Promise<void> {

        await safeRedis.set(`shop:daily:${userId}`, JSON.stringify(state), {
        EX: ttlSeconds,
        });
    },

    async deleteDailyShop(userId: number): Promise<void> {
        await safeRedis.del(`shop:daily:${userId}`);
    }
};

