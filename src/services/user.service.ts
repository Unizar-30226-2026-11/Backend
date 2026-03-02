// services/user.service.ts

// Simulación de las llamadas a la base de datos
const mockDb = {
  User: {
    findById: async (id: string) => ({
      id,
      username: 'PlayerOne',
      level: 15,
      status: 'online',
    }),
    find: async (query: any) => [{ id: 'user_999', username: 'TestUser' }],
  },
  Economy: {
    findByUserId: async (id: string) => ({ coins: 2500, gems: 150 }),
  },
  Inventory: {
    findByUserId: async (id: string) => [
      { itemId: 'p1', name: 'Rastreador', quantity: 2 },
    ],
  },
  CardCollection: {
    findOwnedByUserId: async (id: string) => [
      { cardId: 'c_001', name: 'Golpe Crítico', quantity: 3 },
    ],
  },
  Deck: {
    find: async (query: any) => [
      {
        deckId: 'd_123',
        name: 'Mazo Destrucción',
        cardCount: 40,
        userId: 'user_123',
      },
    ],
    findById: async (id: string) => {
      // Simulamos que encontramos el mazo 'd_123'
      if (id === 'd_123') {
        return {
          deckId: 'd_123',
          userId: 'user_123',
          name: 'Mazo Destrucción',
          cardCount: 40,
        };
      }
      return null;
    },
    create: async (data: any) => ({ deckId: `d_${Date.now()}`, ...data }),
    findByIdAndUpdate: async (id: string, data: any) => ({
      deckId: id,
      ...data,
    }),
    findByIdAndDelete: async (id: string) => true,
  },
};

export const UserService = {
  // --- Perfil y Búsqueda ---
  getUserProfile: async (id: string) => {
    return await mockDb.User.findById(id);
  },

  searchUsers: async (query: string) => {
    return await mockDb.User.find({
      username: { $regex: query, $options: 'i' },
    });
  },

  // --- Economía e Inventario ---
  getUserEconomy: async (userId: string) => {
    return await mockDb.Economy.findByUserId(userId);
  },

  getUserInventory: async (userId: string) => {
    return await mockDb.Inventory.findByUserId(userId);
  },

  getUserCards: async (userId: string) => {
    return await mockDb.CardCollection.findOwnedByUserId(userId);
  },

  // --- Mazos (Decks) ---
  getUserDecks: async (userId: string) => {
    return await mockDb.Deck.find({ userId });
  },

  // En services/user.service.ts
  getDeckById: async (id: string) => {
    return await mockDb.Deck.findById(id); // O la lógica real de tu BD
  },

  createDeck: async (userId: string, name: string, cardIds: string[]) => {
    return await mockDb.Deck.create({
      userId,
      name: name.trim(),
      cards: cardIds,
      cardCount: cardIds.length,
    });
  },

  updateDeck: async (deckId: string, name: string, cardIds: string[]) => {
    return await mockDb.Deck.findByIdAndUpdate(deckId, {
      name: name.trim(),
      cards: cardIds,
    });
  },

  deleteDeck: async (deckId: string) => {
    return await mockDb.Deck.findByIdAndDelete(deckId);
  },
};
