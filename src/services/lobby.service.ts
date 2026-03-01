// service/lobby.service.ts
// Simulación de la base de datos asíncrona para Lobbies
const mockDb = {
  Lobby: {
    create: async (lobbyData: any) => {
      return {
        _id: 'db_id_12345',
        ...lobbyData,
        createdAt: new Date().toISOString(),
      };
    },
    findPublic: async (searchQuery?: string) => {
      const lobbies = [
        {
          lobbyCode: 'A1B2',
          name: 'Sala de Novatos',
          hostId: 'u_111',
          players: ['u_111', 'u_222'],
          maxPlayers: 4,
          engine: 'Classic',
          status: 'waiting',
        },
        {
          lobbyCode: 'C3D4',
          name: 'Torneo Stella',
          hostId: 'u_333',
          players: ['u_333'],
          maxPlayers: 6,
          engine: 'Stella',
          status: 'waiting',
        },
      ];

      if (searchQuery) {
        return lobbies.filter((lobby) =>
          lobby.name.toLowerCase().includes(searchQuery.toLowerCase()),
        );
      }
      return lobbies;
    },
    findByCode: async (code: string) => {
      if (code === 'X7B9') {
        return {
          lobbyCode: 'X7B9',
          name: 'Partida Privada',
          hostId: 'u_999',
          players: ['u_999', 'u_888', 'u_777', 'u_666'],
          maxPlayers: 4,
          engine: 'Classic',
          isPrivate: true,
          status: 'waiting',
        };
      }
      if (code === 'A1B2') {
        return {
          lobbyCode: 'A1B2',
          name: 'Sala de Novatos',
          hostId: 'u_111',
          players: ['u_111', 'u_222'],
          maxPlayers: 4,
          engine: 'Classic',
          isPrivate: false,
          status: 'waiting',
        };
      }
      return null;
    },
  },
};

/**
 * Helper privado para generar códigos de sala.
 */
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
   * Crea una nueva sala de juego.
   */
  create: async (data: {
    hostId: string;
    name: string;
    maxPlayers: number;
    engine: string;
    isPrivate: boolean;
  }) => {
    const lobbyCode = generateLobbyCode();

    const newLobbyData = {
      ...data,
      lobbyCode,
      status: 'waiting',
      players: [data.hostId],
    };

    return await mockDb.Lobby.create(newLobbyData);
  },

  /**
   * Obtiene la lista de salas públicas.
   */
  getPublicLobbies: async (searchQuery?: string) => {
    return await mockDb.Lobby.findPublic(searchQuery);
  },

  /**
   * Busca una sala específica por su código alfanumérico.
   */
  getLobbyByCode: async (code: string) => {
    return await mockDb.Lobby.findByCode(code);
  },
};
