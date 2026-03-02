// routes/collection.routes.ts
import { Router } from 'express';

import { getCardsByCollection, getCollections } from '../controllers';
import { authenticate, validateIdParam } from '../middlewares';

const router = Router();

// Público o requiere autenticación?
// Lo mantenemos con auth para seguir tu patrón.
router.use(authenticate);

router.get('/', getCollections);
router.get(
  '/:collectionId/cards',
  validateIdParam('collectionId'),
  getCardsByCollection,
);

export default router;
