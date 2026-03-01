import app from './app';
import { prisma } from './lib/prisma';
import { redisClient, connectRedis } from './lib/redis';

const PORT = process.env.PORT || 3000;

async function bootstrap() {
    try {
        // 1. Conectar Prisma
        await prisma.$connect();
        console.log('✅ Base de datos (Prisma) lista.');

        // 2. Conectar Redis
        await connectRedis();

        // 3. Arrancar Express
        app.listen(PORT, () => {
            console.log(`🚀 Servidor en http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Error crítico en el arranque:', error);
        await prisma.$disconnect();
        if (redisClient.isOpen) await redisClient.disconnect();
        process.exit(1);
    }
}

bootstrap();