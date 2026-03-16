// middlewares/ownership.middleware.ts
import { NextFunction, Response } from 'express';

import { ShopService, UserService } from '../../services';
import { AuthenticatedRequest } from '../../shared/types';

export const isDeckOwner = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { deckId } = req.params;

    if (!deckId) {
      res.status(400).json({ message: 'El ID del mazo es requerido.' });
      return;
    }

    const deck = await UserService.getDeckById(deckId);

    if (!deck) {
      res.status(404).json({ message: 'Mazo no encontrado.' });
      return;
    }

    // Validación de propiedad
    if (deck.userId !== userId) {
      res
        .status(403)
        .json({ message: 'No tienes permiso para acceder a este recurso.' });
      return;
    }

    // Guardamos el mazo en el objeto request para no tener que buscarlo
    // otra vez en el controlador (ahorro de recursos)
    (req as any).deck = deck;

    next();
  } catch (error) {
    res.status(500).json({ message: 'Error en la validación de propiedad.' });
  }
};

export const hasCardsInCollection = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { cardIds } = req.body;

    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      res
        .status(400)
        .json({ message: 'La lista de cartas es inválida o está vacía.' });
      return;
    }

    // Obtenemos las cartas que el usuario posee realmente
    const ownedCards = await UserService.getUserCards(userId);

    // Creamos un Set o un Map para que la búsqueda sea ultra rápida O(1)
    const ownedCardIds = new Set(ownedCards.map((c) => c.cardId));

    // Verificamos si CADA carta enviada está en su colección
    const missingCards = cardIds.filter((id) => !ownedCardIds.has(id));

    if (missingCards.length > 0) {
      res.status(403).json({
        message: 'No posees todas las cartas que intentas añadir al mazo.',
        missingCards,
      });
      return;
    }

    // Si todo está bien, pasamos al siguiente paso
    next();
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error al validar la propiedad de las cartas.' });
  }
};

export const checkItemNotOwned = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { itemId } = req.body;

    // Verificar si el usuario ya posee el artículo (mazo temático o cosmético)
    const isOwned = await ShopService.checkOwnership(userId, itemId);

    if (isOwned) {
      res.status(400).json({
        message:
          'Transacción rechazada: Ya posees este artículo en tu inventario o colección.',
      });
      return;
    }

    // Si no lo posee, permitir que la compra continúe
    next();
  } catch (error) {
    console.error('Error in checkItemNotOwned:', error);
    res.status(500).json({
      message: 'Error interno al verificar la propiedad del artículo.',
    });
  }
};
