// middlewares/validators.middleware.ts
import { NextFunction, Request, Response } from 'express';

import { ID_PREFIXES, ID_SAFE_REGEX } from '../constants';
import { AuthenticatedRequest } from '../types';

// Mapa interno para saber qué prefijo corresponde a cada parámetro
const PARAM_PREFIX_MAP: Record<string, string> = {
  userId: ID_PREFIXES.USER,
  friendId: ID_PREFIXES.USER,
  targetUserId: ID_PREFIXES.USER,
  requestId: ID_PREFIXES.REQUEST,
  collectionId: ID_PREFIXES.COLLECTION,
  deckId: ID_PREFIXES.DECK,
};

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

/**
 * Función base reutilizable (Fábrica)
 */
const validateId = (
  paramName: string,
  source: 'params' | 'body' = 'params',
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const idValue = req[source][paramName];
    const expectedPrefix = PARAM_PREFIX_MAP[paramName];

    if (!idValue || typeof idValue !== 'string') {
      res.status(400).json({
        message: `El campo '${paramName}' es requerido y debe ser un texto.`,
      });
      return;
    }

    if (expectedPrefix && !idValue.startsWith(expectedPrefix)) {
      res.status(400).json({
        message: `Formato inválido. '${paramName}' debe comenzar con '${expectedPrefix}'.`,
      });
      return;
    }

    if (!ID_SAFE_REGEX.test(idValue)) {
      res.status(400).json({
        message: `El campo '${paramName}' contiene caracteres no permitidos.`,
      });
      return;
    }

    next();
  };
};

// Valida parámetros en la URL como :userId, :deckId, etc.
export const validateIdParam = (paramName: string) =>
  validateId(paramName, 'params');

// Valida específicamente el cuerpo al enviar solicitud
export const validateSendRequestBody = validateId('targetUserId', 'body');

/**
 * Valida el cuerpo de la petición al responder a una solicitud de amistad.
 */
export const validateRespondRequestBody = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const { action } = req.body;
    const validActions = ['accept', 'reject'];

    if (!action || !validActions.includes(action)) {
      res.status(400).json({
        message: `La acción debe ser: ${validActions.join(' o ')}.`,
      });
      return;
    }
    next();
  } catch (error) {
    console.error('Error in validateRespondRequestBody:', error);
    res.status(500).json({
      message: 'Error interno al validar la respuesta de la solicitud.',
    });
  }
};
