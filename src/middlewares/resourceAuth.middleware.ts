import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { mockDb } from '../controllers/user.controller'; // Importamos el mock para validar

export const isDeckOwner = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { deckId } = req.params;

        if (!deckId) {
            res.status(400).json({ message: 'El ID del mazo es requerido.' });
            return;
        }

        const deck = await mockDb.Deck.findById(deckId);

        if (!deck) {
            res.status(404).json({ message: 'Mazo no encontrado.' });
            return;
        }

        // Validación de propiedad
        if (deck.userId !== userId) {
            res.status(403).json({ message: 'No tienes permiso para acceder a este recurso.' });
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