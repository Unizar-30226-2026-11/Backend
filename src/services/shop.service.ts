// services/shop.service.ts

// Simulación de la base de datos para la tienda
const mockDb = {
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
      return false;
    },
  },
};

export const ShopService = {
  // Obtiene el catálogo de la tienda
  getAvailableItems: async () => {
    return await mockDb.Shop.findItems();
  },

  // Procesa la lógica de compra de un artículo
  processPurchase: async (userId: string, itemId: string) => {
    // 1. Buscar el artículo
    const item = await mockDb.Shop.findById(itemId);
    if (!item) {
      throw { status: 404, message: 'El artículo solicitado no existe.' };
    }

    // 2. Verificar economía del usuario
    const userEconomy = await mockDb.Economy.findByUserId(userId);
    if (userEconomy.coins < item.price) {
      throw {
        status: 403,
        message: 'Fondos insuficientes.',
        required: item.price,
        currentBalance: userEconomy.coins,
      };
    }

    // 3. Safety Check: Verificar si ya lo posee
    const isOwned = await mockDb.Inventory.checkOwnership(userId, itemId);
    if (isOwned) {
      throw { status: 400, message: 'Ya posees este artículo.' };
    }

    // 4. Ejecutar la transacción simulada
    const newBalance = userEconomy.coins - item.price;
    const updatedEconomy = await mockDb.Economy.updateBalance(
      userId,
      newBalance,
    );
    await mockDb.Inventory.addItem(userId, item.id, item.type);

    return {
      itemName: item.name,
      updatedEconomy,
    };
  },

  checkOwnership: async (userId: string, itemId: string) => {
    return await mockDb.Inventory.checkOwnership(userId, itemId);
  },
};
