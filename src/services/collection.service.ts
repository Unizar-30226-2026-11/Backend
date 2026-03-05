import { prisma } from "../lib/prisma";

export const CollectionService = {

  // Obtiene todas las colecciones disponibles
  getAllCollections: async () => {
    
    const collections = await prisma.collection.findMany({
      include:{
        _count: {
          select: {cards : true}
        }
      }
    });

    const mappedCollections = collections.map( collection =>({
      id: `col_${collection.id_collection}`,
      name: collection.name,
      description: collection.description,
      release_date: collection.releaseDate,
      total_cards: collection._count.cards
    }));

    return { collections: mappedCollections };
  },

  // Busca una colección específica por su ID
  getCollectionById: async (col_id: string) => {
    const id_collection = parseInt(col_id.replace('col_', ''));

    const collection = await prisma.collection.findUnique({
      where: { id_collection }
    });

    if (!collection) return null;

    return {
      id: `col_${collection.id_collection}`,
      name: collection.name
    };
  },

  // Obtiene el catálogo de cartas de una colección
  getCardsByCollection: async (col_id: string) => {

    const id_collection = parseInt(col_id.replace('col_', ''));

    // Buscamos la colección e incluimos su lista de cartas genéricas
    const collection = await prisma.collection.findUnique({
      where: { id_collection },
      include: { cards: true }
    });

    if (!collection) return null;

    return {
      collection: {
        id: `col_${collection.id_collection}`,
        name: collection.name
      },

      cards: collection.cards.map(card => ({
        id: `c_${card.id_card}`,
        name: card.title,        
        type: "Standard",        
        rarity: card.rarity
      }))
    };

  },
};
