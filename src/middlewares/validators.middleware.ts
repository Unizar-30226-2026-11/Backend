// middlewares/validators.middleware.ts
import { NextFunction, Request, Response } from 'express';

import { AuthenticatedRequest } from '../types';

export const validateDeckBody = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const { name, cardIds } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({
      message: 'El nombre del mazo es obligatorio y debe ser un texto.',
    });
    return;
  }

  if (!Array.isArray(cardIds) || cardIds.length === 0) {
    res
      .status(400)
      .json({ message: 'El mazo debe contener al menos una carta.' });
    return;
  }

  next();
};

export const validateBuyItemBody = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const { itemId } = req.body;

    // Verificar que el itemId exista y sea de tipo string
    if (!itemId || typeof itemId !== 'string' || itemId.trim() === '') {
      res.status(400).json({
        message:
          'El campo "itemId" es obligatorio y debe ser una cadena de texto válida.',
      });
      return;
    }

    // Si todo es correcto, pasar al siguiente middleware o controlador
    next();
  } catch (error) {
    console.error('Error in validateBuyItemBody:', error);
    res
      .status(500)
      .json({ message: 'Error interno al validar la petición de compra.' });
  }
};

export const validateIdParam = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id = req.params[paramName];

    // Verificar que el parámetro exista
    if (!id) {
      res.status(400).json({
        message: `El parámetro '${paramName}' es obligatorio.`,
      });
      return;
    }

    // Validación de formato (Ejemplo: debe empezar con 'col_' si es collectionId)
    // Esto evita que metan scripts o IDs de otros tipos de recursos
    if (paramName === 'collectionId' && !id.startsWith('col_')) {
      res.status(400).json({
        message:
          'Formato de ID de colección inválido. Debe comenzar con "col_".',
      });
      return;
    } else if (paramName === 'deckId' && !id.startsWith('d_')) {
      res.status(400).json({
        message: 'Formato de ID de mazo inválido. Debe comenzar con "d_".',
      });
      return;
    }

    // Limpieza (Sanitización) básica para evitar ataques de inyección simples
    const alphanumericRegex = /^[a-zA-Z0-9_]+$/;
    if (!alphanumericRegex.test(id)) {
      res.status(400).json({
        message: `El ${paramName} contiene caracteres no permitidos.`,
      });
      return;
    }

    next();
  };
};
