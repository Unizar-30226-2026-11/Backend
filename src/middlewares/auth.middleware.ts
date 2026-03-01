// middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';

// Extendemos la interfaz Request para inyectar los datos del usuario autenticado
export interface AuthenticatedRequest extends Request {
    user?: { id: string; username: string };
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Aquí verificaríamos el token JWT de los headers (ej. Authorization: Bearer <token>)
    // Si el token es válido, decodificamos el payload y lo asignamos a req.user
    // Si no es válido, retornamos un 401 Unauthorized

    // Placeholder para la lógica real:
    req.user = { id: 'dummy-user-id', username: 'dummy-username' };
    next();
};