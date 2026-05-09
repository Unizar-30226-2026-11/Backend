import { lobbyRepository } from '../infrastructure/redis/lobby.schema';

export const LobbyRedisRepository = {
  /**
   * Guarda o actualiza un lobby usando el lobbyCode como ID único.
   */
  async save(lobbyCode: string, data: any): Promise<void> {
    const dataToSave = {
      ...data,
      playerNames: JSON.stringify(data.playerNames || {}),
    };

    await lobbyRepository.save(lobbyCode, dataToSave);
  },

  /**
   * Recupera un lobby por su código.
   */
  async findByCode(lobbyCode: string) {
    const lobby = await lobbyRepository.fetch(lobbyCode);
    if (!lobby || !lobby.lobbyCode) {
      return null;
    }

    lobby.playerNames = JSON.parse((lobby.playerNames as string) || '{}');
    return lobby;
  },

  /**
   * Buscador para la lista de salas públicas.
   */
  async searchPublic(query?: string) {
    let search = lobbyRepository
      .search()
      .where('isPrivate')
      .equals(false)
      .and('status')
      .equals('waiting');

    if (query) {
      search = search.and('name').matches(query);
    }

    const lobbies = await search.return.all();

    return lobbies.map((lobby) => {
      lobby.playerNames = JSON.parse((lobby.playerNames as string) || '{}');
      return lobby;
    });
  },

  /**
   * Elimina un lobby de la base de datos por su código.
   * Ideal para limpiar la sala cuando no quedan jugadores.
   */
  async remove(lobbyCode: string): Promise<void> {
    await lobbyRepository.remove(lobbyCode);
  },
};
