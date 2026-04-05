import { lobbyRepository } from '../infrastructure/redis/lobby.schema';

export const LobbyRedisRepository = {

  /**
  * Guarda o actualiza un lobby usando el lobbyCode como ID único.
  */
  async save(lobbyCode: string, data: any): Promise<void> {
    await lobbyRepository.save(lobbyCode, data);
  },

  /**
  * Recupera un lobby por su código.
  */
  async findByCode(lobbyCode: string) {
    const lobby = await lobbyRepository.fetch(lobbyCode);
    return lobby.lobbyCode ? lobby : null;
  },

  /**
  * Buscador para la lista de salas públicas.
  */
  async searchPublic(query?: string) {
    let search = lobbyRepository.search()
      .where('isPrivate').equals(false)
      .and('status').equals('waiting');
    if (query) {
      search = search.and('name').matches(query);
    }

    return await search.return.all();
  }

};