// middlewares/validators.middleware.ts
import { NextFunction, Request, Response } from 'express';

import {
  ID_PREFIXES,
  ID_SAFE_REGEX,
  LOBBY_CODE_REGEX,
  LOBBY_MAX_PLAYERS,
  LOBBY_MIN_PLAYERS,
} from '../../shared/constants';
import { AuthenticatedRequest } from '../../shared/types';
import {
  EDITABLE_USER_STATUSES,
  isEditableUserStatus,
  normalizeGameMode,
} from '../../shared/utils';

// Mapa interno para saber que prefijo corresponde a cada parametro
const PARAM_PREFIX_MAP: Record<string, string> = {
  userId: ID_PREFIXES.USER,
  friendId: ID_PREFIXES.USER,
  targetUserId: ID_PREFIXES.USER,
  requestId: ID_PREFIXES.REQ,
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

    if (!itemId || typeof itemId !== 'string' || itemId.trim() === '') {
      res.status(400).json({
        message:
          'El campo "itemId" es obligatorio y debe ser una cadena de texto valida.',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Error in validateBuyItemBody:', error);
    res
      .status(500)
      .json({ message: 'Error interno al validar la peticion de compra.' });
  }
};

// Funcion base reutilizable
const validateId = (
  paramName: string,
  source: 'params' | 'body' = 'params',
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const idValue = req[source][paramName];

    if (!idValue || typeof idValue !== 'string') {
      res.status(400).json({
        message: `El campo '${paramName}' es requerido y debe ser un texto.`,
      });
      return;
    }

    if (paramName === 'lobbyCode') {
      if (!LOBBY_CODE_REGEX.test(idValue)) {
        res.status(400).json({
          message:
            'El codigo de sala debe tener entre 4 y 6 caracteres alfanumericos en mayusculas.',
        });
        return;
      }
      return next();
    }

    const expectedPrefix = PARAM_PREFIX_MAP[paramName];
    if (expectedPrefix && !idValue.startsWith(expectedPrefix)) {
      res.status(400).json({
        message: `Formato invalido. '${paramName}' debe comenzar con '${expectedPrefix}'.`,
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

// Valida parametros en la URL como :userId, :deckId, etc.
export const validateIdParam = (paramName: string) =>
  validateId(paramName, 'params');
export const validateIdBody = (paramName: string) =>
  validateId(paramName, 'body');

// Valida especificamente el cuerpo al enviar solicitud
export const validateSendRequestBody = validateId('targetUserId', 'body');

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
        message: `La accion debe ser: ${validActions.join(' o ')}.`,
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

export const validateCreateLobbyBody = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const { name, maxPlayers, engine, isPrivate } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ message: 'El nombre de la sala es obligatorio.' });
    return;
  }

  if (
    typeof maxPlayers !== 'number' ||
    maxPlayers < LOBBY_MIN_PLAYERS ||
    maxPlayers > LOBBY_MAX_PLAYERS
  ) {
    res.status(400).json({
      message: `El numero de jugadores debe ser entre ${LOBBY_MIN_PLAYERS} y ${LOBBY_MAX_PLAYERS}.`,
    });
    return;
  }

  if (!normalizeGameMode(engine)) {
    res.status(400).json({
      message:
        'El motor debe ser uno de estos valores: "Classic", "Stella", "STANDARD" o "STELLA".',
    });
    return;
  }

  if (typeof isPrivate !== 'boolean') {
    res.status(400).json({ message: 'El campo isPrivate debe ser booleano.' });
    return;
  }

  next();
};

export const validateUsernameBody = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const { username } = req.body;
  const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

  if (!username || typeof username !== 'string') {
    res.status(400).json({
      message: 'El nombre de usuario es obligatorio y debe ser un texto.',
    });
    return;
  }

  const trimmedUsername = username.trim();

  if (!USERNAME_REGEX.test(trimmedUsername)) {
    res.status(400).json({
      message:
        'El nombre de usuario debe tener entre 3 y 20 caracteres y solo contener letras, numeros o guiones bajos.',
    });
    return;
  }

  req.body.username = trimmedUsername;
  next();
};

export const validateStatusBody = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const { status } = req.body;

  if (!isEditableUserStatus(status)) {
    res.status(400).json({
      message: `Estado no valido. Opciones: ${EDITABLE_USER_STATUSES.join(', ')}`,
    });
    return;
  }

  next();
};
