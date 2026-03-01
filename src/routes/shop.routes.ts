// routes/shop.routes.ts
import { Router } from 'express';

import { buyItem, getShopItems } from '../controllers';
import { authenticate } from '../middlewares';
import { checkItemNotOwned, validateBuyItemBody } from '../middlewares';

const router = Router();

router.use(authenticate);

router.get('/items', getShopItems);
router.post(
  '/buy',
  validateBuyItemBody, // ¿El ID del item es válido y viene en el body?
  checkItemNotOwned, // ¿El usuario ya tiene este item? (Evita compras duplicadas)
  buyItem, // Controller: Realizar la transacción
);

export default router;
