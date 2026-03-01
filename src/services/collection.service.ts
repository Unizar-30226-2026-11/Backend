// services/collection.service.ts

// Simulación de la base de datos para las colecciones (Metadata global)
const mockDb = {
  Collection: {
    findAll: async () => [
      {
        id: 'col_base',
        name: 'Set Base Clásico',
        releaseDate: '2023-01-01',
        totalCards: 150,
      },
      {
        id: 'col_vamp',
        name: 'Sombras Vampíricas',
        releaseDate: '2023-10-31',
        totalCards: 50,
      },
    ],
    findById: async (id: string) => {
      if (id === 'col_base')
        return { id: 'col_base', name: 'Set Base Clásico' };
      if (id === 'col_vamp')
        return { id: 'col_vamp', name: 'Sombras Vampíricas' };
      return null;
    },
  },
  Card: {
    findByCollectionId: async (collectionId: string) => {
      if (collectionId === 'col_base') {
        return [
          {
            id: 'c_001',
            name: 'Golpe de Espada',
            rarity: 'common',
            type: 'attack',
          },
          {
            id: 'c_002',
            name: 'Escudo de Roble',
            rarity: 'common',
            type: 'defense',
          },
        ];
      }
      if (collectionId === 'col_vamp') {
        return [
          {
            id: 'c_v01',
            name: 'Mordisco Letal',
            rarity: 'rare',
            type: 'attack',
          },
        ];
      }
      return [];
    },
  },
};

export const CollectionService = {
  // Obtiene todas las expansiones disponibles
  getAllCollections: async () => {
    return await mockDb.Collection.findAll();
  },

  // Busca una colección específica por su ID
  getCollectionById: async (id: string) => {
    return await mockDb.Collection.findById(id);
  },

  // Obtiene el catálogo de cartas de una colección
  getCardsByCollection: async (collectionId: string) => {
    return await mockDb.Card.findByCollectionId(collectionId);
  },
};
