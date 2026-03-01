// routes/user.routes.ts
import { Router } from 'express';

import {
  createDeck,
  deleteDeck,
  getBalance,
  getInventory,
  getOwnedCards,
  getProfile,
  getUserDecks,
  searchUsers,
  updateDeck,
} from '../controllers';
import {
  authenticate,
  hasCardsInCollection,
  isDeckOwner,
  validateDeckBody,
  validateIdParam,
} from '../middlewares';

const router = Router();

router.use(authenticate);

// Perfil y economía
router.get('/profile', getProfile);
router.get('/balance', getBalance);
router.get('/inventory', getInventory);
router.get('/search', searchUsers);

// Gestión de Colección Personal y Mazos
router.get('/cards', getOwnedCards);
router.get('/decks', getUserDecks);

// CREAR: 1.Auth -> 2.Formato -> 3.Dueño de cartas -> 4.Controller
router.post('/decks', validateDeckBody, hasCardsInCollection, createDeck);

// ACTUALIZAR: 1.Auth -> 2.Dueño del mazo -> 3.Formato -> 4.Dueño de cartas -> 5.Controller
router.put(
  '/decks/:deckId',
  validateIdParam('deckId'),
  isDeckOwner,
  validateDeckBody,
  hasCardsInCollection,
  updateDeck,
);
router.delete(
  '/decks/:deckId',
  validateIdParam('deckId'),
  isDeckOwner,
  deleteDeck,
);

export default router;
