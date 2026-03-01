// routes/shop.routes.ts
import { Router } from 'express';

import { buyItem, getShopItems } from '../controllers';
import { authMiddleware } from '../middlewares';

const router = Router();

router.use(authMiddleware);

router.get('/items', getShopItems);
router.post('/buy', buyItem);

export default router;
