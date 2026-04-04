import { GameService, gameTimeoutsQueue } from '../game.service';
import { GameState } from '../../shared/types';
import { BOARD_CONFIG } from '../../shared/constants/board-config';


jest.mock('bullmq', () => ({
    Queue: jest.fn().mockReturnValue({
        add: jest.fn()
    })
}));

jest.mock('../../infrastructure/prisma', () => ({
    prisma: {
        deck: { findMany: jest.fn() },
        cards: { findMany: jest.fn() }
    }
}));

jest.mock('../../core/engines', () => ({
    DixitEngine: { transition: jest.fn((state) => state) }
}));


describe('GameService - Suite Completa de Tablero y Powerups', () => {

    let gameService: GameService;
    let mockRedisRepo: any;

    beforeAll(() => {
        // 2. Espiamos la cola REAL de BullMQ para interceptar la llamada sin ejecutarla
        jest.spyOn(gameTimeoutsQueue, 'add').mockResolvedValue(undefined as any);
    });

    beforeEach(() => {
        mockRedisRepo = {
            getGame: jest.fn(),
            saveGame: jest.fn(),
        };
        gameService = new GameService(mockRedisRepo);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ==========================================
    // CASILLAS DE DESIGUALDAD (Pares/Impares)
    // ==========================================
    describe('Casillas de Desigualdad (Pares/Impares)', () => {

    });

    // ==========================================
    // CASILLA DE SHUFFLE
    // ==========================================
    describe('Casilla de Shuffle', () => {

        it('Debe cambiar la mano del jugador, añadir descarte y emitir los avisos', async () => {
            const mockState = {
                lobbyCode: 'LOBBY-1',
                players: ['p1'],
                scores: { p1: BOARD_CONFIG.SPECIAL_SQUARES.SHUFFLE_1 },
                hands: { p1: [10, 11] },
                centralDeck: [99, 100],
                discardPile: [],
            } as unknown as GameState;

            const previousScores = { p1: 0 };
            await gameService['checkSpecialSquares'](mockState, previousScores);

            expect(mockState.discardPile).toEqual([10, 11]);
            expect(mockState.hands['p1'].length).toBe(2);
            expect(mockState.centralDeck.length).toBe(0);
        });

        it('Debe emitir reshuffled si el mazo central se queda a cero', () => {
            const mockState = {
                lobbyCode: 'LOBBY-1',
                players: ['p1'],
                hands: { p1: [10, 11, 12] },
                centralDeck: [99],
                discardPile: [50, 51, 52],
            } as unknown as GameState;

            const emissions = gameService['applyShuffleEffect'](mockState, 'p1');

            expect(mockState.discardPile).toHaveLength(0);
            expect(mockState.hands['p1']).toHaveLength(3);

            const reshuffleEmission = emissions.find(e => e.event === 'server:game:deck_reshuffled');
            expect(reshuffleEmission).toBeDefined();
        });

    });

    // ==========================================
    // CASILLA DE BONUS ALEATORIO
    // ==========================================
    describe('Casilla de Bonus Aleatorio', () => {

        it('Debe aplicar el modificador HAND_LIMIT en modo STANDARD', async () => {
            const mockState = {
                lobbyCode: 'LOBBY-1',
                mode: 'STANDARD',
                players: ['p1'],
                scores: { p1: BOARD_CONFIG.SPECIAL_SQUARES.BONUS_RANDOM_1 },
            } as unknown as GameState;

            const previousScores = { p1: 0 };
            const emissions = await gameService['checkSpecialSquares'](mockState, previousScores);

            expect(mockState.activeModifiers).toBeDefined();
            expect(mockState.activeModifiers!['p1'].type).toBe('HAND_LIMIT');
            expect(emissions[0].data).toHaveProperty('effect', 'CARD_BONUS');
        });

        it('Debe usar el Placeholder en modo STELLA', async () => {
            const mockState = {
                lobbyCode: 'LOBBY-1',
                mode: 'STELLA',
                players: ['p1'],
                scores: { p1: BOARD_CONFIG.SPECIAL_SQUARES.BONUS_RANDOM_1 },
            } as unknown as GameState;

            const previousScores = { p1: 0 };
            const emissions = await gameService['checkSpecialSquares'](mockState, previousScores);

            expect(mockState.activeModifiers).toBeUndefined();
            expect(emissions[0].data).toHaveProperty('effect', 'STELLA_BONUS_PLACEHOLDER');
        });

    });

    // ==========================================
    // CASILLA DE EQUILIBRIO
    // ==========================================
    describe('Casilla de Equilibrio', () => {

        it('Debe sumar puntos según la clasificación actual (+1 al primero, +2 al segundo...)', () => {
            const mockState = {
                lobbyCode: 'LOBBY-1',
                scores: {
                    p1: 65, // 1º
                    p2: 50, // 2º
                    p3: 40  // 3º
                },
            } as unknown as GameState;

            // Probamos la lógica matemática aislada
            const emissions = gameService['applyEquilibriumEffect'](mockState);

            expect(mockState.scores['p1']).toBe(66); // 65 + 1
            expect(mockState.scores['p2']).toBe(52); // 50 + 2
            expect(mockState.scores['p3']).toBe(43); // 40 + 3

            expect(emissions[0].data).toHaveProperty('effect', 'EQUILIBRIUM');
        });

    });

    // ==========================================
    // SISTEMA DE ESTRELLA FUGAZ
    // ==========================================
    describe('Sistema de Estrella Fugaz', () => {

        it('triggerStarEvent debe activar la estrella, guardar en Redis y programar en BullMQ', async () => {
            const mockState = { lobbyCode: 'LOBBY1', isStarActive: false, scores: {} };
            mockRedisRepo.getGame.mockResolvedValue(mockState);

            const emissions = await gameService.triggerStarEvent('LOBBY1');

            expect(mockState.isStarActive).toBe(true);
            expect(mockRedisRepo.saveGame).toHaveBeenCalled();
            expect(emissions[0].event).toBe('star_spawned');

            // Ahora que hemos "espiado" la cola correctamente, pasará sin problema
            expect(gameTimeoutsQueue.add).toHaveBeenCalledWith(
                'star-expiration',
                { gameId: 'LOBBY1' },
                expect.objectContaining({ removeOnComplete: true })
            );
        });

        it('claimStar debe dar 3 puntos y apagar la estrella si se pulsa a tiempo', async () => {
            const mockState = {
                lobbyCode: 'LOBBY1',
                isStarActive: true,
                starExpiresAt: Date.now() + 5000,
                scores: { 'player1': 10 }
            };
            mockRedisRepo.getGame.mockResolvedValue(mockState);

            await gameService.claimStar('LOBBY1', 'player1');

            expect(mockState.isStarActive).toBe(false);
            expect(mockState.scores['player1']).toBe(13);
        });

        it('claimStar no debe dar puntos ni emitir nada si el tiempo ya expiró', async () => {
            const mockState = {
                lobbyCode: 'LOBBY1',
                isStarActive: true,
                starExpiresAt: Date.now() - 1000,
                scores: { 'player1': 10 }
            };
            mockRedisRepo.getGame.mockResolvedValue(mockState);

            const emissions = await gameService.claimStar('LOBBY1', 'player1');

            expect(mockState.scores['player1']).toBe(10);
            expect(emissions).toHaveLength(0);
        });

    });

});