import { createLobby } from '../lobby.controller';

const createMock = jest.fn();
const saveUserSessionMock = jest.fn();

jest.mock('../../../services', () => ({
  LobbyService: {
    create: (...args: unknown[]) => createMock(...args),
  },
  AuthService: {
    saveUserSession: (...args: unknown[]) => saveUserSessionMock(...args),
  },
}));

describe('lobby.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createLobby persiste la sesion del host con el lobby recien creado', async () => {
    const req = {
      user: { id: 'u_1', username: 'host' },
      body: {
        name: 'Sala de prueba',
        maxPlayers: 6,
        engine: 'STANDARD',
        isPrivate: false,
      },
    } as any;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    const createdLobby = {
      hostId: 'u_1',
      name: 'Sala de prueba',
      maxPlayers: 6,
      engine: 'STANDARD',
      isPrivate: false,
      status: 'waiting',
      players: ['u_1'],
      lobbyCode: 'ABCD',
    };

    createMock.mockResolvedValue(createdLobby);
    saveUserSessionMock.mockResolvedValue(undefined);

    await createLobby(req, res);

    expect(saveUserSessionMock).toHaveBeenCalledWith('u_1', 'ABCD');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('WebSocket'),
        lobby: createdLobby,
      }),
    );
  });
});
