// controllers/shop.controller.ts
import { Response } from 'express';

import { AuthenticatedRequest } from '../types';

export const getShopItems = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  // Obtener catálogo de la tienda (mazos temáticos, tableros cosméticos)
  res.status(200).json({
    items: [
      { id: 'deck_vampire', type: 'deck', name: 'Mazo Vampírico', price: 500 },
      { id: 'board_neon', type: 'cosmetic', name: 'Tablero Neón', price: 1200 },
    ],
  });
};

export const buyItem = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  // Se espera en req.body: { itemId: string }

  // Lógica transaccional (ACID):
  // 1. Obtener precio del ítem.
  // 2. Verificar si el usuario tiene saldo suficiente (virtual currency).
  // 3. Restar el saldo del usuario.
  // 4. Añadir el ítem a la colección/inventario del usuario.
  // 5. Devolver el saldo actualizado.

  res.status(200).json({
    message: 'Compra realizada con éxito',
    newBalance: { coins: 1000 },
  });
};
