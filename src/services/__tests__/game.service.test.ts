import { GameService } from '../game.service';

describe('GameService', () => {
  test('se instancia con un repositorio Redis compatible', () => {
    const mockRedisRepo = {
      getGame: jest.fn(),
      saveGame: jest.fn(),
    };

    const service = new GameService(mockRedisRepo as any);

    expect(service).toBeInstanceOf(GameService);
    expect(typeof service.initializeGame).toBe('function');
    expect(typeof service.handleAction).toBe('function');
  });
});
