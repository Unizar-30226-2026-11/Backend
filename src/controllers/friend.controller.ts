// controllers/friend.controller.ts
import { Response } from 'express';

import { AuthenticatedRequest } from '../types';

// Simulación de la base de datos asíncrona para el sistema de Amigos
const mockDb = {
  Friends: {
    getConfirmedFriends: async (userId: string) => [
      { id: 'u_456', username: 'PlayerDos', status: 'online' },
      { id: 'u_789', username: 'GamerX', status: 'offline' },
    ],
    getPendingRequests: async (userId: string) => [
      {
        id: 'req_001',
        fromUserId: 'u_999',
        fromUsername: 'Ninja',
        createdAt: '2026-03-01T10:00:00Z',
      },
    ],
    checkRelationshipStatus: async (userA: string, userB: string) => {
      // Retorna 'friends', 'pending', o 'none'
      return 'none';
    },
    createRequest: async (fromUserId: string, toUserId: string) => ({
      id: `req_${Date.now()}`,
      fromUserId,
      toUserId,
      status: 'pending',
    }),
    findRequestById: async (requestId: string) => {
      if (requestId === 'req_001') {
        return {
          id: 'req_001',
          fromUserId: 'u_999',
          toUserId: 'u_123',
          status: 'pending',
        };
      }
      return null;
    },
    updateRequestStatus: async (
      requestId: string,
      status: 'accepted' | 'rejected',
    ) => true,
    createBidirectionalFriendship: async (userA: string, userB: string) => true,
    removeBidirectionalFriendship: async (userA: string, userB: string) => true,
  },
};

export const getFriends = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Obtener la lista de amigos confirmados
    const friends = await mockDb.Friends.getConfirmedFriends(userId);

    res.status(200).json({ friends });
  } catch (error) {
    console.error('Error in getFriends:', error);
    res.status(500).json({ message: 'Error al obtener la lista de amigos.' });
  }
};

export const getPendingRequests = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Obtener solicitudes entrantes pendientes
    const pendingRequests = await mockDb.Friends.getPendingRequests(userId);

    res.status(200).json({ pendingRequests });
  } catch (error) {
    console.error('Error in getPendingRequests:', error);
    res
      .status(500)
      .json({ message: 'Error al obtener las solicitudes pendientes.' });
  }
};

export const sendRequest = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { targetUserId } = req.body;

    // Evitar que el usuario se envíe una solicitud a sí mismo
    if (userId === targetUserId) {
      res.status(400).json({
        message: 'No puedes enviarte una solicitud de amistad a ti mismo.',
      });
      return;
    }

    // Comprobar si ya son amigos o si ya existe una solicitud pendiente
    const relationshipStatus = await mockDb.Friends.checkRelationshipStatus(
      userId,
      targetUserId,
    );

    if (relationshipStatus === 'friends') {
      res
        .status(400)
        .json({ message: 'Este usuario ya está en tu lista de amigos.' });
      return;
    }

    if (relationshipStatus === 'pending') {
      res.status(400).json({
        message:
          'Ya existe una solicitud de amistad pendiente con este usuario.',
      });
      return;
    }

    // Crear y guardar la solicitud en la base de datos
    const newRequest = await mockDb.Friends.createRequest(userId, targetUserId);

    res.status(201).json({
      message: 'Solicitud de amistad enviada con éxito.',
      request: newRequest,
    });
  } catch (error) {
    console.error('Error in sendRequest:', error);
    res
      .status(500)
      .json({ message: 'Error al enviar la solicitud de amistad.' });
  }
};

export const respondToRequest = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { requestId } = req.params;
    const { action } = req.body;

    // Buscar la solicitud en la base de datos
    const request = await mockDb.Friends.findRequestById(requestId);

    if (!request) {
      res.status(404).json({ message: 'La solicitud de amistad no existe.' });
      return;
    }

    // Verificar que la solicitud pertenece al usuario autenticado (él es el receptor)
    if (request.toUserId !== userId) {
      res.status(403).json({
        message: 'No tienes permiso para responder a esta solicitud.',
      });
      return;
    }

    // Procesar la acción (Aceptar o Rechazar)
    if (action === 'accept') {
      // Actualizar estado de la solicitud y crear la relación bidireccional
      await mockDb.Friends.updateRequestStatus(requestId, 'accepted');
      await mockDb.Friends.createBidirectionalFriendship(
        request.fromUserId,
        request.toUserId,
      );

      res
        .status(200)
        .json({ message: 'Solicitud de amistad aceptada. Ahora son amigos.' });
      return;
    }

    if (action === 'reject') {
      // Solo actualizar el estado a rechazado (o eliminar el registro, dependiendo del diseño de la BD)
      await mockDb.Friends.updateRequestStatus(requestId, 'rejected');

      res.status(200).json({ message: 'Solicitud de amistad rechazada.' });
      return;
    }
  } catch (error) {
    console.error('Error in respondToRequest:', error);
    res
      .status(500)
      .json({ message: 'Error al procesar la respuesta a la solicitud.' });
  }
};

export const removeFriend = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { friendId } = req.params;

    // Eliminar la relación bidireccional de amistad en la base de datos
    const success = await mockDb.Friends.removeBidirectionalFriendship(
      userId,
      friendId,
    );

    if (!success) {
      res.status(400).json({
        message:
          'No se pudo eliminar al amigo. Es posible que no estén en tu lista.',
      });
      return;
    }

    res
      .status(200)
      .json({ message: 'Amigo eliminado correctamente de tu lista.' });
  } catch (error) {
    console.error('Error in removeFriend:', error);
    res.status(500).json({ message: 'Error al eliminar al amigo.' });
  }
};
