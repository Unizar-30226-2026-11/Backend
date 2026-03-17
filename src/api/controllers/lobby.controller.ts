// controllers/lobby.controller.ts
import { Response } from 'express';

import { LobbyService } from '../../services';
import { AuthenticatedRequest } from '../../shared/types';

export const createLobby = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const hostId = req.user!.id;
    const { name, maxPlayers, engine, isPrivate } = req.body;

    // Llamada al servicio para crear la sala
    const createdLobby = await LobbyService.create({
      hostId,
      name,
      maxPlayers,
      engine,
      isPrivate,
    });

    res.status(201).json({
      message: 'Sala creada exitosamente. Listo para conexión WebSocket.',
      lobby: createdLobby,
    });
  } catch (error) {
    console.error('Error in createLobby:', error);
    res.status(500).json({ message: 'Error interno al crear la sala.' });
  }
};

export const getPublicLobbies = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const searchQuery = req.query.search as string | undefined;

    // Búsqueda delegada al servicio
    const publicLobbies = await LobbyService.getPublicLobbies(searchQuery);

    // Retornar la lista
    res.status(200).json({
      lobbies: publicLobbies,
    });
  } catch (error) {
    console.error('Error in getPublicLobbies:', error);
    res.status(500).json({ message: 'Error al buscar salas públicas.' });
  }
};

export const getLobbyByCode = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { lobbyCode } = req.params;

    const lobby = await LobbyService.getLobbyByCode(lobbyCode);

    // Validaciones de negocio en el controlador (o podrían ir al servicio)
    if (!lobby) {
      res
        .status(404)
        .json({ message: 'La sala solicitada no existe o ya ha terminado.' });
      return;
    }

    // Verificar si la sala ya está llena
    if (lobby.players.length >= lobby.maxPlayers) {
      res.status(403).json({
        message: 'La sala está llena. No se pueden unir más jugadores.',
        lobbyCode: lobby.lobbyCode,
      });
      return;
    }

    // Retornar los detalles para permitir la conexión en el frontend
    res.status(200).json({
      message: 'Sala encontrada.',
      lobby,
    });
  } catch (error) {
    console.error('Error in getLobbyByCode:', error);
    res
      .status(500)
      .json({ message: 'Error al buscar la información de la sala.' });
  }
};
