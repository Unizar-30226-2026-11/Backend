const searchPublicMock = jest.fn();
const removeMock = jest.fn();

jest.mock('../../repositories/lobby.repository', () => ({
  LobbyRedisRepository: {
    searchPublic: (...args: unknown[]) => searchPublicMock(...args),
    remove: (...args: unknown[]) => removeMock(...args),
    findByCode: jest.fn(),
    save: jest.fn(),
  },
}));

const hasAnyConnectedUserMock = jest.fn();

jest.mock('../../sockets/presence.registry', () => ({
  socketPresenceRegistry: {
    hasAnyConnectedUser: (...args: unknown[]) => hasAnyConnectedUserMock(...args),
  },
}));

import { LobbyService } from '../lobby.service';

describe('LobbyService.getPublicLobbies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('oculta y poda salas publicas sin sockets conectados', async () => {
    searchPublicMock.mockResolvedValue([
      {
        lobbyCode: 'LIVE',
        players: ['u_1'],
        status: 'waiting',
      },
      {
        lobbyCode: 'GHOST',
        players: ['u_2'],
        status: 'waiting',
      },
    ]);

    hasAnyConnectedUserMock
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    const result = await LobbyService.getPublicLobbies();

    expect(result).toHaveLength(1);
    expect(result[0].lobbyCode).toBe('LIVE');
    expect(removeMock).toHaveBeenCalledWith('GHOST');
  });
});
