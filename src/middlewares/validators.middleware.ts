// middlewares/validators.middleware.ts
import { NextFunction, Request, Response } from 'express';

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
