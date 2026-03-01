// routes/collection.routes.ts
import { Router } from 'express';

import { getCardsByCollection, getCollections } from '../controllers';
import { authMiddleware } from '../middlewares';

const router = Router();

// Público o requiere autenticación?
// Lo mantenemos con auth para seguir tu patrón.
router.use(authMiddleware);

router.get('/', getCollections);
router.get('/:collectionId/cards', getCardsByCollection);

export default router;
