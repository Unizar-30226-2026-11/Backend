import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

// Simulación de las llamadas a la base de datos
const mockDb = {
    User: {
        findById: async (id: string) => ({ id, username: 'PlayerOne', level: 15, status: 'online' }),
        find: async (query: any) => [{ id: 'user_999', username: 'TestUser' }]
    },
    Economy: {
        findByUserId: async (id: string) => ({ coins: 2500, gems: 150 })
    },
    Inventory: {
        findByUserId: async (id: string) => ([{ itemId: 'p1', name: 'Rastreador', quantity: 2 }])
    },
    CardCollection: {
        findOwnedByUserId: async (id: string) => ([{ cardId: 'c_001', name: 'Golpe Crítico', quantity: 3 }])
    },
    Deck: {
        find: async (query: any) => ([{ deckId: 'd_123', name: 'Mazo Destrucción', cardCount: 40 }]),
        create: async (data: any) => ({ deckId: `d_${Date.now()}`, ...data }),
        findByIdAndUpdate: async (id: string, data: any) => ({ deckId: id, ...data }),
        findByIdAndDelete: async (id: string) => true
    }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id; // El middleware garantiza que req.user existe
        const userProfile = await mockDb.User.findById(userId);

        if (!userProfile) {
            res.status(404).json({ message: 'Perfil de usuario no encontrado.' });
            return;
        }

        res.status(200).json({ profile: userProfile });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener el perfil del usuario.' });
    }
};

export const getBalance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const balance = await mockDb.Economy.findByUserId(userId);

        res.status(200).json({ balance });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener el balance monetario.' });
    }
};

export const getInventory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const inventory = await mockDb.Inventory.findByUserId(userId);

        res.status(200).json({ inventory });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener el inventario de comodines.' });
    }
};

export const searchUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const searchQuery = req.query.q as string;

        if (!searchQuery) {
            res.status(400).json({ message: 'Debe proporcionar un parámetro de búsqueda "q".' });
            return;
        }

        // Búsqueda en la base de datos (simulada)
        const results = await mockDb.User.find({ username: { $regex: searchQuery, $options: 'i' } });

        res.status(200).json({ results });
    } catch (error) {
        res.status(500).json({ message: 'Error al buscar usuarios.' });
    }
};

export const getOwnedCards = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const ownedCards = await mockDb.CardCollection.findOwnedByUserId(userId);

        res.status(200).json({ cards: ownedCards });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener la colección de cartas del usuario.' });
    }
};

export const getUserDecks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const decks = await mockDb.Deck.find({ userId });

        res.status(200).json({ decks });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener los mazos del usuario.' });
    }
};

export const createDeck = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { name, cardIds } = req.body;

        if (!name || !Array.isArray(cardIds) || cardIds.length === 0) {
            res.status(400).json({ message: 'Nombre del mazo y lista de cartas son requeridos.' });
            return;
        }

        // Aquí iría la validación lógica: verificar que el usuario posee esas cartas

        const newDeck = await mockDb.Deck.create({
            userId,
            name,
            cards: cardIds,
            cardCount: cardIds.length
        });

        res.status(201).json({ message: 'Mazo creado exitosamente.', deck: newDeck });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear el mazo.' });
    }
};

export const updateDeck = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const deckId = req.params.deckId;
        const { name, cardIds } = req.body;

        if (!deckId) {
            res.status(400).json({ message: 'El ID del mazo es requerido.' });
            return;
        }

        // Validar propiedad del mazo antes de actualizar (simulado en DB real)
        const updatedDeck = await mockDb.Deck.findByIdAndUpdate(deckId, { name, cards: cardIds });

        if (!updatedDeck) {
            res.status(404).json({ message: 'Mazo no encontrado.' });
            return;
        }

        res.status(200).json({ message: 'Mazo actualizado exitosamente.', deck: updatedDeck });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar el mazo.' });
    }
};

export const deleteDeck = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const deckId = req.params.deckId;

        if (!deckId) {
            res.status(400).json({ message: 'El ID del mazo es requerido.' });
            return;
        }

        // Validar propiedad del mazo antes de borrar
        const isDeleted = await mockDb.Deck.findByIdAndDelete(deckId);

        if (!isDeleted) {
            res.status(404).json({ message: 'Mazo no encontrado.' });
            return;
        }

        res.status(200).json({ message: 'Mazo eliminado correctamente.' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar el mazo.' });
    }
};