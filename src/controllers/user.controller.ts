// controllers/user.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

// ... (Aquí van los controladores anteriores: getProfile, getBalance, etc.) ...

export const getOwnedCards = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Obtener todas las cartas que el usuario ha comprado o desbloqueado.
    // Útil para poblar la interfaz del "Constructor de Mazos" en el frontend.
    res.status(200).json({
        cards: [
            { cardId: 'c_001', name: 'Golpe Crítico', collectionId: 'col_base', quantityOwned: 2 }
        ]
    });
};

export const getUserDecks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Obtener la lista de mazos creados por este usuario.
    res.status(200).json({
        decks: [
            { deckId: 'd_123', name: 'Mazo Destrucción', cardCount: 40 }
        ]
    });
};

export const createDeck = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Se espera en req.body: { name: string, cardIds: string[] }
    // 1. Validar que el usuario posea las cartas que intenta añadir (cruzando datos con getOwnedCards).
    // 2. Validar reglas del mazo (ej. máximo 40 cartas, no más de 3 copias iguales).
    // 3. Guardar el nuevo mazo asociado al req.user.id.
    
    res.status(201).json({ 
        message: 'Mazo creado exitosamente',
        deckId: 'd_124'
    });
};

export const updateDeck = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Se espera en req.params: { deckId: string }
    // Se espera en req.body: { name?: string, cardIds?: string[] }
    // Verificar que el mazo pertenezca al usuario antes de modificar.
    
    res.status(200).json({ message: 'Mazo actualizado correctamente' });
};

export const deleteDeck = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Se espera en req.params: { deckId: string }
    // Eliminar el mazo de la base de datos (las cartas no se borran, solo la configuración del mazo).
    
    res.status(200).json({ message: 'Mazo eliminado' });
};