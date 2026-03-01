// controllers/collection.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export const getCollections = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Obtener la metadata global de las colecciones que existen en el juego.
    // Esto NO depende del usuario.
    res.status(200).json({ 
        collections: [
            { id: 'col_base', name: 'Set Base', totalCards: 150 },
            { id: 'col_vamp', name: 'Sombras Vampíricas', totalCards: 50 }
        ]
    });
};

export const getCardsByCollection = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Se espera en req.params: { collectionId: string }
    // Devuelve el catálogo completo de cartas que pertenecen a esta colección específica.
    // Útil para la sección "Galería" o "Tienda" del juego.
    res.status(200).json({ 
        collectionId: req.params.collectionId,
        cards: [
            { cardId: 'c_v01', name: 'Mordisco', rarity: 'common', description: 'Roba 1 punto de vida.' },
            { cardId: 'c_v02', name: 'Vuelo Nocturno', rarity: 'rare', description: 'Esquiva el próximo ataque.' }
        ]
    });
};