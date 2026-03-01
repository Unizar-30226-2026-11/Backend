import { PrismaClient } from '@prisma/client';

// Evita que en desarrollo se creen múltiples instancias de Prisma al recargar el código
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query'], // Opcional: para ver las consultas en consola
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;