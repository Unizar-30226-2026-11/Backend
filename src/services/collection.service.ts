import { prisma } from "../infrastructure/prisma";

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

    if (collections == null ) return null

    const mappedCollections = collections.map( collection =>({
      id: `col_${collection.id_collection}`,
      name: collection.name,
      description: collection.description,
      release_date: collection.releaseDate,
      total_cards: collection._count.cards
    }));

    return { collections: mappedCollections };
  },

  // Busca una (o unas) coleccion específica por su ID
  getCollectionById: async (col_ids: string | string[]) => {

    const isArrayInput = Array.isArray(col_ids);
    const idsToProcess = isArrayInput ? col_ids : [col_ids];

    const numericIds = idsToProcess.map(id => parseInt(id.replace('col_', '')));

    const collections = await prisma.collection.findMany({
      where: { 
        id_collection: { in: numericIds}
      },
      include: {
        _count: {
          select: { cards: true }
        }
      }
    });

    if (!collections || collections.length === 0) return null;

    const formattedCollections = collections.map(collection => {
    
      const formattedDate = collection.releaseDate 
      ? collection.releaseDate.toISOString().split('T')[0] 
      : null;

      return {
        id: `col_${collection.id_collection}`,
        name: collection.name,
        description: collection.description,
        releaseDate: formattedDate,
        totalCards: collection._count.cards
      }
    });


    return {
      collections: formattedCollections
    };
  },

  // Obtiene el catálogo de cartas de una (o unas) colección
  getCardsByCollection: async (col_ids: string | string []) => {

    const isArrayInput = Array.isArray(col_ids);
    const idsToProcess = isArrayInput ? col_ids : [col_ids];

    const numericIds = idsToProcess.map(id => parseInt(id.replace('col_', '')));

    // Buscamos la colección e incluimos su lista de cartas genéricas
    const collections = await prisma.collection.findMany({
      where: { 
        id_collection: { in: numericIds } 
      },
      include: { cards: true }
    });

    if (!collections || collections.length === 0) return null;

    return collections.map( collection => {

      const collection_id = `col_${collection.id_collection}`;

      return {
        collection: {
          id: collection_id,
          name: collection.name
        },
        // Mapeamos las cartas dándoles el formato compuesto
        cards: collection.cards.map(card => {

          return {
            id: `${collection_id}_card_${card.id_card}`,
            name: card.title,        
            type: "Standard", // De momento al no estar fijada esta logica no existe el campo y por eso esta hardcodeado.
            rarity: card.rarity
          };
        })
      };
    });
  },
};
