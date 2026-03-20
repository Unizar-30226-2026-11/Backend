// controllers/user.controller.ts
import { Response } from 'express';

import { UserService } from '../../services';
import { AuthenticatedRequest } from '../../shared/types';

export const getProfile = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.id; // El middleware garantiza que req.user existe
    const userProfile = await UserService.getUserProfile(userId);

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
    const balance = await UserService.getUserEconomy(userId);

    res.status(200).json({ balance });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener el balance monetario.' });
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
    const results = await UserService.searchUsers(searchQuery);

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
    const ownedCards = await UserService.getUserCards(userId);

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
    const decks = await UserService.getUserDecks(userId);

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

    const newDeck = await UserService.createDeck(userId, name, cardIds);
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

    const updatedDeck = await UserService.updateDeck(deckId, name, cardIds);
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
    await UserService.deleteDeck(deckId);
    res.status(200).json({ message: 'Mazo eliminado correctamente.' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar el mazo.' });
  }
};
