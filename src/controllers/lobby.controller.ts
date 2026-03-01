// controllers/lobby.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export const createLobby = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Se espera en req.body: { name: string, maxPlayers: number, engine: string, isPrivate: boolean }
    // 1. Generar un código único corto para la sala (ej. "X7B9").
    // 2. Guardar el lobby en la base de datos o Redis.
    
    res.status(201).json({ 
        message: 'Sala creada con éxito',
        lobbyCode: 'X7B9' // El código que el anfitrión compartirá con sus amigos
    });
};

export const getPublicLobbies = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Se espera Opcionalmente en req.query: { search: string }
    // 1. Buscar en BD/Redis salas donde isPrivate == false y status == 'waiting'.
    // 2. Si existe req.query.search, filtrar por el nombre de la sala (LIKE %search%).
    
    res.status(200).json({ 
        lobbies: [
            { lobbyCode: 'A1B2', name: 'Sala de Novatos', players: 2, maxPlayers: 4 }
        ] 
    });
};

export const getLobbyByCode = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Se espera en req.params: { lobbyCode: string }
    // 1. Buscar la sala exacta por su código (sin importar si es pública o privada).
    // 2. Validar que la sala exista y tenga espacio disponible.
    // 3. Devolver los detalles para que el frontend pueda iniciar la conexión WebSocket.
    
    res.status(200).json({
        lobbyCode: req.params.lobbyCode,
        hostId: 'user_123',
        engine: 'Classic',
        status: 'waiting'
    });
};