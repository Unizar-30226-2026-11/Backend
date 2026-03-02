// controllers/collection.controller.ts
import { Response } from 'express';

import { AuthenticatedRequest } from '../types';

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

export const getCollections = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    // Obtener la metadata de todas las expansiones y sets disponibles en el juego
    const collections = await mockDb.Collection.findAll();

    res.status(200).json({ collections });
  } catch (error) {
    console.error('Error in getCollections:', error);
    res
      .status(500)
      .json({ message: 'Error al obtener la lista de colecciones.' });
  }
};

export const getCardsByCollection = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { collectionId } = req.params;

    // Verificar que la colección exista primero
    const collectionExists = await mockDb.Collection.findById(collectionId);

    if (!collectionExists) {
      res.status(404).json({ message: 'La colección especificada no existe.' });
      return;
    }

    // Obtener el catálogo completo de cartas que pertenecen a esta colección
    const cards = await mockDb.Card.findByCollectionId(collectionId);

    res.status(200).json({
      collection: collectionExists,
      cards,
    });
  } catch (error) {
    console.error('Error in getCardsByCollection:', error);
    res
      .status(500)
      .json({ message: 'Error al obtener las cartas de la colección.' });
  }
};
