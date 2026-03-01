// controllers/shop.controller.ts
import { Response } from 'express';

import { AuthenticatedRequest } from '../types';
import { LockManager } from '../utils/lockManager';

// Simulación de la base de datos para la tienda
export const mockDb = {
  Shop: {
    findItems: async () => [
      {
        id: 'deck_vampire',
        type: 'thematic_deck',
        name: 'Sombras Vampíricas',
        price: 500,
      },
      {
        id: 'board_neon',
        type: 'cosmetic',
        name: 'Tablero Neón Cyberpunk',
        price: 1200,
      },
    ],
    findById: async (id: string) => {
      if (id === 'deck_vampire')
        return {
          id: 'deck_vampire',
          type: 'thematic_deck',
          name: 'Sombras Vampíricas',
          price: 500,
        };
      return null;
    },
  },
  Economy: {
    findByUserId: async (userId: string) => ({ userId, coins: 1000, gems: 50 }),
    updateBalance: async (userId: string, newCoins: number) => ({
      userId,
      coins: newCoins,
      gems: 50,
    }),
  },
  Inventory: {
    addItem: async (userId: string, itemId: string, type: string) => true,
    checkOwnership: async (
      userId: string,
      itemId: string,
    ): Promise<boolean> => {
      // Simula una consulta a la BD que retorna true si el usuario ya lo compró
      return false;
    },
  },
};

export const getShopItems = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    // Obtener el catálogo disponible en la tienda
    const items = await mockDb.Shop.findItems();

    res.status(200).json({ items });
  } catch (error) {
    console.error('Error in getShopItems:', error);
    res
      .status(500)
      .json({ message: 'Error al obtener los artículos de la tienda.' });
  }
};

export const buyItem = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.id;
  const { itemId } = req.body;

  // INTENTAR ADQUIRIR EL LOCK
  const lockAcquired = LockManager.acquire(userId);

  if (!lockAcquired) {
    res.status(409).json({
      message: 'Hay una transacción en curso. Por favor, espera un momento.',
    });
    return;
  }

  try {
    // Lógica normal de búsqueda
    const item = await mockDb.Shop.findById(itemId);
    if (!item) {
      res.status(404).json({ message: 'El artículo solicitado no existe.' });
      return;
    }

    const userEconomy = await mockDb.Economy.findByUserId(userId);

    if (userEconomy.coins < item.price) {
      res.status(400).json({
        message: 'Fondos insuficientes.',
        required: item.price,
        currentBalance: userEconomy.coins,
      });
      return;
    }

    // SEGUNDA COMPROBACIÓN (Safety Check)
    // Aquí es donde el lock brilla: nadie más puede estar ejecutando esto para este userId
    const isOwned = await mockDb.Inventory.checkOwnership(userId, itemId);
    if (isOwned) {
      res.status(400).json({ message: 'Ya posees este artículo.' });
      return;
    }

    // --- TRANSACCIÓN SIMULADA ---
    const newBalance = userEconomy.coins - item.price;
    const updatedEconomy = await mockDb.Economy.updateBalance(
      userId,
      newBalance,
    );
    await mockDb.Inventory.addItem(userId, item.id, item.type);

    res.status(200).json({
      message: `Has comprado '${item.name}' exitosamente.`,
      updatedBalance: updatedEconomy,
    });
  } catch (error) {
    console.error('Error in buyItem:', error);
    res.status(500).json({ message: 'Error interno en la transacción.' });
  } finally {
    // LIBERAR EL LOCK SIEMPRE
    // Esto es vital. Si no se libera, el usuario queda "baneado" de la tienda por error técnico.
    LockManager.release(userId);
  }
};
