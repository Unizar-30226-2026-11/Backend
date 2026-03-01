// routes/user.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
    getProfile,
    getBalance,
    getInventory,
    searchUsers,
    getOwnedCards,
    getUserDecks,
    createDeck,
    updateDeck,
    deleteDeck
} from '../controllers/user.controller';

const router = Router();

router.use(authMiddleware);

// Perfil y economía
router.get('/profile', getProfile);
router.get('/balance', getBalance);
router.get('/inventory', getInventory);
router.get('/search', searchUsers);

// Gestión de Colección Personal y Mazos
router.get('/cards', getOwnedCards);
router.get('/decks', getUserDecks);
router.post('/decks', createDeck);
router.put('/decks/:deckId', updateDeck);
router.delete('/decks/:deckId', deleteDeck);

export default router;