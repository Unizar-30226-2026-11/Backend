// service/lobby.service.ts
// Simulacion de la base de datos asincrona para Lobbies

import { LobbyRedisRepository } from '../repositories/lobby.repository';
import { socketPresenceRegistry } from '../sockets/presence.registry';
import { normalizeGameMode } from '../shared/utils';

const generateLobbyCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const LobbyService = {
  /**
   * 1. CREATE: Guardar la sala en Redis
   * Esto crea la caja de datos. Luego, el Socket
   * se encargara de avisar cuando alguien nuevo entre a esta caja.
   */
  create: async (data: {
    hostId: string;
    name: string;
    maxPlayers: number;
    engine: string;
    isPrivate: boolean;
  }) => {
    const lobbyCode = generateLobbyCode();
    const normalizedEngine = normalizeGameMode(data.engine);

    if (!normalizedEngine) {
      throw new Error('INVALID_GAME_MODE');
    }

    const newLobbyData = {
      ...data,
      engine: normalizedEngine,
      lobbyCode,
      status: 'waiting',
      players: [data.hostId],
    };

    await LobbyRedisRepository.save(lobbyCode, newLobbyData);

    return newLobbyData;
  },

  /**
   * 2. FIND BY CODE: Leer la sala de Redis
   * Cuando un jugador envie por Socket el evento 'joinLobby',
   * el Socket llamara a esta funcion para comprobar si la sala no esta llena.
   */
  getLobbyByCode: async (code: string) => {
    return await LobbyRedisRepository.findByCode(code);
  },

  /**
   * GET PUBLIC LOBBIES: Listar salas publicas
   */
  getPublicLobbies: async (searchQuery?: string) => {
    const publicLobbies = await LobbyRedisRepository.searchPublic(searchQuery);
    const visibleLobbies = [];

    for (const lobby of publicLobbies) {
      const players = Array.isArray(lobby.players)
        ? (lobby.players as string[])
        : [];

      if (players.length === 0) {
        await LobbyRedisRepository.remove(lobby.lobbyCode as string);
        continue;
      }

      // El buscador publico solo debe mostrar salas con al menos un socket vivo.
      if (!socketPresenceRegistry.hasAnyConnectedUser(players)) {
        await LobbyRedisRepository.remove(lobby.lobbyCode as string);
        continue;
      }

      visibleLobbies.push(lobby);
    }

    return visibleLobbies;
  },

  /*
  Usamos sockets en vez de REST para esto ya que si no el frontend tendria que estar preguntandole al servidor cada segundo
  si ha habido algun cambio en la sala (jugadores nuevos, host se ha ido, etc.) lo que saturaria tu base de datos.
  Los sockets, en cambio, mantienen una conexion abierta y el servidor puede avisar a todos
  los jugadores de esa sala en tiempo real cada vez que alguien nuevo entra o sale.
  */

  // Funcion para que un jugador se una a una sala
  joinLobby: async (code: string, userId: string) => {
    const lobby = await LobbyRedisRepository.findByCode(code);
    if (!lobby) throw new Error('LOBBY_NOT_FOUND');

    if (lobby.players.includes(userId)) return lobby;
    if (lobby.players.length >= lobby.maxPlayers) throw new Error('LOBBY_FULL');

    lobby.players.push(userId);

    await LobbyRedisRepository.save(code, lobby);
    return lobby;
  },

  /**
   * Elimina un jugador de la sala (cuando abandona antes de empezar).
   */
  leaveLobby: async (code: string, userId: string) => {
    const lobby = await LobbyRedisRepository.findByCode(code);
    if (!lobby) return;

    lobby.players = (lobby.players as string[]).filter(
      (id: string) => id !== userId,
    );

    if (lobby.players.length === 0) {
      await LobbyRedisRepository.remove(code);
    } else {
      // Si se va el host, elegimos uno nuevo para no dejar la sala huerfana.
      if (lobby.hostId === userId) {
        lobby.hostId = lobby.players[0];
      }

      await LobbyRedisRepository.save(code, lobby);
    }
  },

  /**
   * Cambia el estado de la sala.
   */
  updateStatus: async (code: string, status: 'playing' | 'finished') => {
    const lobby = await LobbyRedisRepository.findByCode(code);
    if (!lobby) throw new Error('LOBBY_NOT_FOUND');

    lobby.status = status;
    await LobbyRedisRepository.save(code, lobby);
    return lobby;
  },
};
