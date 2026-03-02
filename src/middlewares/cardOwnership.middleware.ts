// middlewares/cardOwnership.middleware.ts
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { mockDb } from '../controllers/user.controller';

export const hasCardsInCollection = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { cardIds } = req.body;

        if (!Array.isArray(cardIds) || cardIds.length === 0) {
            res.status(400).json({ message: 'La lista de cartas es inválida o está vacía.' });
            return;
        }

        // Obtenemos las cartas que el usuario posee realmente
        const ownedCards = await mockDb.CardCollection.findOwnedByUserId(userId);
        
        // Creamos un Set o un Map para que la búsqueda sea ultra rápida O(1)
        const ownedCardIds = new Set(ownedCards.map(c => c.cardId));

        // Verificamos si CADA carta enviada está en su colección
        const missingCards = cardIds.filter(id => !ownedCardIds.has(id));

        if (missingCards.length > 0) {
            res.status(403).json({ 
                message: 'No posees todas las cartas que intentas añadir al mazo.',
                missingCards 
            });
            return;
        }

        // Si todo está bien, pasamos al siguiente paso
        next();
    } catch (error) {
        res.status(500).json({ message: 'Error al validar la propiedad de las cartas.' });
    }
};