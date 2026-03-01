// routes/shop.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { getShopItems, buyItem } from '../controllers/shop.controller';

const router = Router();

router.use(authMiddleware);

router.get('/items', getShopItems);
router.post('/buy', buyItem);

export default router;