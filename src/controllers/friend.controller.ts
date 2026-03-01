// controllers/friend.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export const getFriends = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Listar todos los amigos confirmados del usuario actual
    res.status(200).json({ friends: [] });
};

export const getPendingRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Obtener solicitudes de amistad entrantes que están pendientes
    res.status(200).json({ pendingRequests: [] });
};

export const sendRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Se espera en req.body: { targetUserId: string }
    // Crear un registro de solicitud pendiente en la base de datos
    res.status(201).json({ message: 'Solicitud de amistad enviada' });
};

export const respondToRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Se espera en req.params: { requestId: string }
    // Se espera en req.body: { action: 'accept' | 'reject' }
    // Actualizar el estado de la solicitud en la base de datos
    res.status(200).json({ message: 'Solicitud actualizada correctamente' });
};

export const removeFriend = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Se espera en req.params: { friendId: string }
    // Eliminar la relación de amistad de la base de datos
    res.status(200).json({ message: 'Amigo eliminado de la lista' });
};