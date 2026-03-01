import { Request } from 'express';

// Interfaz para extender el Request de Express e inyectar los datos del usuario
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
  };
}
