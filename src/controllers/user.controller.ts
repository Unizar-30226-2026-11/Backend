// controllers/user.controller.ts
import { Response } from 'express';

import { AuthenticatedRequest } from '../types';

// Simulación de las llamadas a la base de datos
export const mockDb = {
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
    create: async (data: any) => ({ deckId: `d_${Date.now()}`, ...data }),
    findById: async (id: string) => ({
      deckId: id,
      userId: 'user_123',
      name: 'Mazo Destrucción',
    }), // Simula que el dueño es user_123
    findByIdAndUpdate: async (id: string, data: any) => ({
      deckId: id,
      ...data,
    }),
    findByIdAndDelete: async (id: string) => true,
  },
};

export const getProfile = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.id; // El middleware garantiza que req.user existe
    const userProfile = await mockDb.User.findById(userId);

    if (!userProfile) {
      res.status(404).json({ message: 'Perfil de usuario no encontrado.' });
      return;
    }

    res.status(200).json({ profile: userProfile });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error al obtener el perfil del usuario.' });
  }
};

export const getBalance = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const balance = await mockDb.Economy.findByUserId(userId);

    res.status(200).json({ balance });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener el balance monetario.' });
  }
};

export const getInventory = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const inventory = await mockDb.Inventory.findByUserId(userId);

    res.status(200).json({ inventory });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error al obtener el inventario de comodines.' });
  }
};

export const searchUsers = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const searchQuery = req.query.q as string;

    if (!searchQuery) {
      res
        .status(400)
        .json({ message: 'Debe proporcionar un parámetro de búsqueda "q".' });
      return;
    }

    // Búsqueda en la base de datos (simulada)
    const results = await mockDb.User.find({
      username: { $regex: searchQuery, $options: 'i' },
    });

    res.status(200).json({ results });
  } catch (error) {
    res.status(500).json({ message: 'Error al buscar usuarios.' });
  }
};

export const getOwnedCards = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const ownedCards = await mockDb.CardCollection.findOwnedByUserId(userId);

    res.status(200).json({ cards: ownedCards });
  } catch (error) {
    res.status(500).json({
      message: 'Error al obtener la colección de cartas del usuario.',
    });
  }
};

export const getUserDecks = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const decks = await mockDb.Deck.find({ userId });

    res.status(200).json({ decks });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error al obtener los mazos del usuario.' });
  }
};

export const createDeck = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { name, cardIds } = req.body;

    const newDeck = await mockDb.Deck.create({
      userId,
      name: name.trim(),
      cards: cardIds,
      cardCount: cardIds.length,
    });

    res
      .status(201)
      .json({ message: 'Mazo creado exitosamente.', deck: newDeck });
  } catch (error) {
    res.status(500).json({ message: 'Error interno al crear el mazo.' });
  }
};

export const updateDeck = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { deckId } = req.params;
    const { name, cardIds } = req.body;

    const updatedDeck = await mockDb.Deck.findByIdAndUpdate(deckId, {
      name: name.trim(),
      cards: cardIds,
    });

    res.status(200).json({ message: 'Mazo actualizado.', deck: updatedDeck });
  } catch (error) {
    res.status(500).json({ message: 'Error interno al actualizar.' });
  }
};

export const deleteDeck = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { deckId } = req.params;

    // El middleware garantizó que es su mazo
    await mockDb.Deck.findByIdAndDelete(deckId);

    res.status(200).json({ message: 'Mazo eliminado correctamente.' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar el mazo.' });
  }
};
