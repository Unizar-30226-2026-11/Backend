import { prisma } from '../../infrastructure/prisma';
import { GameService, gameTimeoutsQueue } from '../game.service';
import { GameState } from '../../shared/types';
import { BOARD_CONFIG } from '../../shared/constants/board-config';


jest.mock('bullmq', () => ({
    Queue: jest.fn().mockReturnValue({
        add: jest.fn() 
    })
}));

jest.mock('../../infrastructure/redis', () => ({
    bullmqConnection: {}
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


describe('GameService - Suite Completa de Tablero, Powerups y Minijuegos', () => {

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
    // FLUJO PRINCIPAL: INITIALIZE Y HANDLE ACTION
    // ==========================================
    describe('Flujo Principal: Inicialización y Acciones', () => {

        describe('initializeGame', () => {
            
            test('Debe extraer IDs, buscar cartas, NO usar fallback si hay suficientes, y guardar estado', async () => {
                
                const lobbyData = { engine: 'STANDARD', players: ['u_1', 'u_2', 'u_3'] };
                // 3 jugadores * 16 cartas = 48 cartas requeridas.
                
                // Simulamos que los jugadores traen MUCHAS cartas (ej: 60 cartas en total) para no entrar al fallback
                const mockDecks = [
                    { cards: Array(60).fill({ user_card: { id_card: 100 } }) }
                ];
                (prisma.deck.findMany as jest.Mock).mockResolvedValueOnce(mockDecks);

                const emissions = await gameService.initializeGame('ROOM-INIT', lobbyData);

                expect(prisma.deck.findMany).toHaveBeenCalledWith({
                    where: { id_user: { in: [1, 2, 3] } },
                    include: expect.any(Object)
                });

                // 1. Verifica que NO se llamó al fallback porque tenían 60 cartas (más de las 48 necesarias)
                expect(prisma.cards.findMany).not.toHaveBeenCalled();

                // 2. Verifica guardado en Redis y programación del temporizador
                expect(mockRedisRepo.saveGame).toHaveBeenCalledWith('ROOM-INIT', expect.any(Object));
                expect(gameTimeoutsQueue.add).toHaveBeenCalledWith(
                    'phase-timeout', 
                    expect.objectContaining({ lobbyCode: 'ROOM-INIT', expectedPhase: 'LOBBY' }), 
                    expect.objectContaining({ delay: 60000 })
                );

                // 3. Verifica las emisiones (1 general + 3 privadas)
                const startEmission = emissions.find(e => e.event === 'server:game:started');
                expect(startEmission).toBeDefined();
                expect(startEmission!.data).not.toHaveProperty('state.centralDeck'); // Privacidad
                expect(emissions.filter(e => e.event === 'server:game:private_hand')).toHaveLength(3);
            });

            test('Debe rellenar con cartas fallback (dinámico) si faltan cartas para el mazo objetivo', async () => {
                const lobbyData = { engine: 'STANDARD', players: ['u_1'] }; 
                // 1 jugador * 16 cartas = 16 cartas requeridas.
                
                // Simulamos que el usuario NO tiene cartas en su mazo (0 cartas)
                (prisma.deck.findMany as jest.Mock).mockResolvedValueOnce([]); 
                
                // Simulamos la respuesta del fallback
                (prisma.cards.findMany as jest.Mock).mockResolvedValueOnce(Array(16).fill({ id_card: 99 }));

                await gameService.initializeGame('ROOM-FALLBACK', lobbyData);

                // Verifica que se llamó al fallback pidiendo EXACTAMENTE las 16 cartas que faltan
                expect(prisma.cards.findMany).toHaveBeenCalledWith({ 
                    take: 16, 
                    select: { id_card: true } 
                });
            });
        });

       describe('handleAction', () => {
            
            test('Debe lanzar error si la partida no existe en Redis', async () => {
                mockRedisRepo.getGame.mockResolvedValueOnce(null);
                const action = { type: 'NEXT_ROUND', playerId: 'p1'} as any;
                
                await expect(gameService.handleAction('INVALID_ROOM', action))
                    .rejects.toThrow('Partida no encontrada o expirada.');
            });

            test('Debe actualizar el estado, enmascarar datos privados y generar emisiones', async () => {
                const mockState = {
                    lobbyCode: 'ROOM-ACTION',
                    players: ['p1'],
                    scores: { p1: 0 },
                    hands: { p1: [5, 6] },
                    centralDeck: [1, 2, 3],
                    phase: 'LOBBY'
                };
                mockRedisRepo.getGame.mockResolvedValueOnce(mockState);

                const action = { type: 'NEXT_ROUND', playerId: 'p1' } as any;
                const emissions = await gameService.handleAction('ROOM-ACTION', action);

                // Verifica que machaca el estado anterior en Redis
                expect(mockRedisRepo.saveGame).toHaveBeenCalledWith('ROOM-ACTION', expect.any(Object));

                // Verifica el enmascaramiento en la sala general
                const updateEmission = emissions.find(e => e.event === 'server:game:state_updated');
                expect(updateEmission?.data).not.toHaveProperty('state.centralDeck');
                expect(updateEmission?.data).not.toHaveProperty('state.hands');

                // Verifica que se emite la mano privada solo a p1
                const handEmission = emissions.find(e => e.event === 'server:game:private_hand');
                expect(handEmission).toBeDefined();
            });

            test('Debe programar un nuevo Timeout en BullMQ si hay un cambio de fase', async () => {
                const mockState = {
                    lobbyCode: 'ROOM-PHASE',
                    players: ['p1'],
                    scores: { p1: 0 },
                    hands: { p1: [] },
                    phase: 'LOBBY'
                };
                mockRedisRepo.getGame.mockResolvedValueOnce(mockState);

                // Forzamos al mock del Motor a devolver un estado en fase STORYTELLING
                const dixitEngineMock = require('../../core/engines').DixitEngine;
                dixitEngineMock.transition.mockReturnValueOnce({ ...mockState, phase: 'STORYTELLING' });

                const action = { type: 'NEXT_ROUND', playerId: 'SYS' } as any;
                await gameService.handleAction('ROOM-PHASE', action);
                
                // Verifica que BullMQ recibe la tarea con el retraso correcto (60000ms para STORYTELLING)
                expect(gameTimeoutsQueue.add).toHaveBeenCalledWith(
                    'phase-timeout',
                    { lobbyCode: 'ROOM-PHASE', expectedPhase: 'STORYTELLING' },
                    expect.objectContaining({ delay: 60000 })
                );
            });
        });

    });
  
    // ==========================================
    // CASILLAS DE DESIGUALDAD (Pares/Impares)
    // ==========================================

    describe('Casillas de Desigualdad (Pares/Impares)', () => {

        test('PAR: 1ero en pasar, 4o en pasar, 5o en pasar', async () => {
            const square = BOARD_CONFIG.SPECIAL_SQUARES.EVEN_SQUARE_1;
            const prevScores = { p1: 0, p4: 0, p5: 0 };

            // 1er Jugador (Impar -> Negativo en casilla Par)
            const state1 = { players: ['p1'], scores: { p1: square }, boardRegistry: { [square]: [] }, lobbyCode: 'L' } as any;
            await gameService['checkSpecialSquares'](state1, prevScores);
            expect(state1.scores['p1']).toBe(square - 1);

            // 4º Jugador (> Par -> Positivo en casilla Par)
            const state4 = { players: ['p4'], scores: { p4: square }, boardRegistry: { [square]: ['a', 'b', 'c'] }, lobbyCode: 'L' } as any;
            await gameService['checkSpecialSquares'](state4, prevScores);
            expect(state4.scores['p4']).toBe(square + 2); 

            // 5º Jugador (Impar -> Negativo en casilla Par)
            const state5 = { players: ['p5'], scores: { p5: square }, boardRegistry: { [square]: ['a', 'b', 'c', 'd'] }, lobbyCode: 'L' } as any;
            await gameService['checkSpecialSquares'](state5, prevScores);
            expect(state5.scores['p5']).toBe(square - 3); 
        });

        test('IMPAR: 1ero en pasar, 4o en pasar, 5o en pasar', async () => {
            const square = BOARD_CONFIG.SPECIAL_SQUARES.ODD_SQUARE_1;
            const prevScores = { p1: 0, p4: 0, p5: 0 };

            // 1er Jugador (Impar -> Positivo en casilla Impar)
            const state1 = { players: ['p1'], scores: { p1: square }, boardRegistry: { [square]: [] }, lobbyCode: 'L' } as any;
            await gameService['checkSpecialSquares'](state1, prevScores);
            expect(state1.scores['p1']).toBe(square + 1);

            // 4º Jugador (Par -> Negativo en casilla Impar)
            const state4 = { players: ['p4'], scores: { p4: square }, boardRegistry: { [square]: ['a', 'b', 'c'] }, lobbyCode: 'L' } as any;
            await gameService['checkSpecialSquares'](state4, prevScores);
            expect(state4.scores['p4']).toBe(square - 2);

            // 5º Jugador (Impar -> Positivo en casilla Impar)
            const state5 = { players: ['p5'], scores: { p5: square }, boardRegistry: { [square]: ['a', 'b', 'c', 'd'] }, lobbyCode: 'L' } as any;
            await gameService['checkSpecialSquares'](state5, prevScores);
            expect(state5.scores['p5']).toBe(square + 3);
        });

    });

    // ==========================================
    // CASILLA DE SHUFFLE E INTERCAMBIO (STELLA)
    // ==========================================
    describe('Casilla de Shuffle / Intercambio', () => {

        test('Debe cambiar la mano del jugador y emitir los avisos en STANDARD', async () => {
            const mockState = {
                lobbyCode: 'LOBBY-1',
                mode: 'STANDARD',
                players: ['p1'],
                scores: { p1: BOARD_CONFIG.SPECIAL_SQUARES.SHUFFLE_1 },
                hands: { p1: [10, 11] }, 
                centralDeck: [99, 100],  
                discardPile: [],
                isMinigameActive: false
            } as unknown as GameState;

            const previousScores = { p1: 0 };
            await gameService['checkSpecialSquares'](mockState, previousScores);

            expect(mockState.discardPile).toEqual([10, 11]); 
            expect(mockState.hands['p1'].length).toBe(2);    
            expect(mockState.centralDeck.length).toBe(0);    
        });

        test('Debe emitir reshuffled si el mazo central se queda a cero en STANDARD', () => {
            const mockState = {
                lobbyCode: 'LOBBY-1',
                mode: 'STANDARD',
                players: ['p1'],
                hands: { p1: [10, 11, 12] }, 
                centralDeck: [99],           
                discardPile: [50, 51, 52], 
                isMinigameActive: false
            } as unknown as GameState;

            const emissions = gameService['applyShuffleEffect'](mockState, 'p1');

            expect(mockState.discardPile).toHaveLength(0); 
            expect(mockState.hands['p1']).toHaveLength(3); 
            
            const reshuffleEmission = emissions.find(e => e.event === 'server:game:deck_reshuffled');
            expect(reshuffleEmission).toBeDefined();
        });

        test('Debe intercambiar puntos con otro jugador al azar en modo STELLA', async () => {
            const square = BOARD_CONFIG.SPECIAL_SQUARES.SHUFFLE_1;
            const mockState = {
                lobbyCode: 'LOBBY-1',
                mode: 'STELLA',
                players: ['p1', 'p2', 'p3'],
                scores: { p1: square, p2: 50, p3: 15 }, 
                boardRegistry: {},
                isMinigameActive: false
            } as unknown as GameState;

            const previousScores = { p1: 0, p2: 50, p3: 15 };

            // Forzamos Math.random para que elija al índice 1 del array de rivales (['p2', 'p3'][1] -> 'p3')
            jest.spyOn(global.Math, 'random').mockReturnValueOnce(0.9);

            const emissions = await gameService['checkSpecialSquares'](mockState, previousScores);

            // Verificamos el intercambio (p1 se queda con los 15 de p3, y p3 se queda con la casilla actual de p1)
            expect(mockState.scores['p1']).toBe(15);
            expect(mockState.scores['p3']).toBe(square);

            const swapEmission = emissions.find(e => e.data && (e.data as any).effect === 'STELLA_SCORE_SWAP');
            expect(swapEmission).toBeDefined();
            expect((swapEmission!.data as any).targetId).toBe('p3');

            jest.spyOn(global.Math, 'random').mockRestore();
        });
    });

    // ==========================================
    // CASILLA DE BONUS ALEATORIO
    // ==========================================
    describe('Casilla de Bonus Aleatorio', () => {

        test('Debe aplicar el modificador HAND_LIMIT en modo STANDARD', async () => {
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

        test('Debe sumar puntos directos (1 a 3) en modo STELLA', async () => {
            const mockState = {
                lobbyCode: 'LOBBY-1',
                mode: 'STELLA',
                players: ['p1'],
                scores: { p1: BOARD_CONFIG.SPECIAL_SQUARES.BONUS_RANDOM_1 },
                isMinigameActive: false
            } as unknown as GameState;

            const previousScores = { p1: 0 };
            jest.spyOn(global.Math, 'random').mockReturnValueOnce(0.5); // Fuerzamos +2 puntos

            const emissions = await gameService['checkSpecialSquares'](mockState, previousScores);

            expect(mockState.scores['p1']).toBe(BOARD_CONFIG.SPECIAL_SQUARES.BONUS_RANDOM_1 + 2);
            expect(emissions[0].data).toHaveProperty('effect', 'STELLA_BONUS_POINTS');
            
            jest.spyOn(global.Math, 'random').mockRestore();
        });

    });

    // ==========================================
    // CASILLA DE EQUILIBRIO
    // ==========================================
    describe('Casilla de Equilibrio', () => {

        test('Debe sumar puntos según la clasificación actual (+1 al primero, +2 al segundo...)', () => {
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
    // CASILLA DE DUELO (APUESTA PUNTOS, NO EL MINIJUEGO DE DESEMPATE)
    // ==========================================
    describe('Duelo:', () => {
            test('Debe emitir disponibilidad de duelo al caer en casilla de apuesta', async () => {
                const square = BOARD_CONFIG.SPECIAL_SQUARES.BET_DUEL_1;
                const mockState = {
                    lobbyCode: 'LOBBY-1',
                    players: ['p1'],
                    scores: { p1: square },
                } as unknown as GameState;

                const emissions = await gameService['checkSpecialSquares'](mockState, { p1: 0 });

                expect(emissions).toContainEqual({
                    room: 'p1',
                    event: 'server:game:duel_available',
                    data: { challengerId: 'p1' }
                });
            });
        });

    // ==========================================
    // SISTEMA DE ESTRELLA FUGAZ
    // ==========================================
    describe('Sistema de Estrella Fugaz', () => {

        test('triggerStarEvent debe activar la estrella, guardar en Redis y programar en BullMQ', async () => {
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

        test('claimStar debe dar 3 puntos y apagar la estrella si se pulsa a tiempo', async () => {
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

        test('claimStar no debe dar puntos ni emitir nada si el tiempo ya expiró', async () => {
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

    // ==========================================
    // SISTEMA DE CONFLICTOS: DUELOS Y EMPATES
    // ==========================================
    describe('Sistema de Conflictos y Minijuegos', () => {

        test('Debe bloquear acciones normales si hay un minijuego activo', async () => {
            mockRedisRepo.getGame.mockResolvedValueOnce({
                lobbyCode: 'ROOM-1',
                isMinigameActive: true // Partida bloqueada
            });

            const action = { type: 'NEXT_ROUND', playerId: 'p1' } as any;

            await expect(gameService.handleAction('ROOM-1', action))
                .rejects.toThrow('Hay un conflicto en curso. Espera a que termine el minijuego.');
        });

        test('Debe iniciar un Duelo y bloquear la partida al recibir RESOLVE_DUEL', async () => {
            const mockState = {
                lobbyCode: 'ROOM-1',
                isMinigameActive: false,
                phase: 'LOBBY',
                scores: {}
            };
            mockRedisRepo.getGame.mockResolvedValueOnce(mockState);

            const action = { type: 'RESOLVE_DUEL', playerId: 'p1', payload: { targetId: 'p2' } } as any;
            
            // Forzamos el tipo de minijuego (0)
            jest.spyOn(global.Math, 'random').mockReturnValueOnce(0.1); 

            const emissions = await gameService.handleAction('ROOM-1', action);

            // Verificamos que se bloqueó la partida
            expect(mockState.isMinigameActive).toBe(true);
            expect(mockRedisRepo.saveGame).toHaveBeenCalledWith('ROOM-1', mockState);

            // Verificamos la emisión del duelo
            const minigameEmission = emissions.find(e => e.event === 'server:game:minigame_start');
            expect(minigameEmission).toBeDefined();
            expect(minigameEmission?.data).toEqual({
                player1: 'p1',
                player2: 'p2',
                type: 0,
                duration: 15000,
                isDuel: true
            });

            jest.spyOn(global.Math, 'random').mockRestore();
        });

        test('Debe iniciar un Empate si dos jugadores caen en la misma casilla', async () => {
            const mockState = {
                lobbyCode: 'ROOM-1',
                mode: 'STANDARD',
                players: ['p1', 'p2'],
                scores: { p1: 10, p2: 10 }, // Ambos en la casilla 10
                boardRegistry: {}
            } as unknown as GameState;

            // Simulamos que p1 acaba de moverse a la casilla 10, pero p2 ya estaba ahí
            const previousScores = { p1: 5, p2: 10 };

            const emissions = await gameService['checkSpecialSquares'](mockState, previousScores);

            // Verificamos que se detecta el empate y se bloquea la partida
            expect(mockState.isMinigameActive).toBe(true);
            const minigameEmission = emissions.find(e => e.event === 'server:game:minigame_start');
            expect(minigameEmission).toBeDefined();
            expect((minigameEmission?.data as any).isDuel).toBe(false); // Es empate, no duelo
        });

        describe('Resolución de Resultados (submitConflictResult)', () => {
            
            test('Debe aplicar puntuación de Duelo (+2 / -2) y desbloquear partida', async () => {
                const mockState = {
                    lobbyCode: 'ROOM-1',
                    isMinigameActive: true,
                    scores: { p1: 10, p2: 5 }
                } as unknown as GameState;
                mockRedisRepo.getGame.mockResolvedValueOnce(mockState);

                // p1 gana, p2 pierde, ES un duelo
                const emissions = await gameService.submitConflictResult('ROOM-1', 'p1', 'p2', true);

                expect(mockState.scores['p1']).toBe(12); // 10 + 2
                expect(mockState.scores['p2']).toBe(3);  // 5 - 2
                expect(mockState.isMinigameActive).toBe(false); // Desbloqueado

                const specialEvent = emissions.find(e => e.event === 'server:game:special_event');
                expect((specialEvent?.data as any).effect).toBe('CONFLICT_RESOLVED');
            });

            test('Debe aplicar puntuación de Empate (+1 / 0) y desbloquear partida', async () => {
                const mockState = {
                    lobbyCode: 'ROOM-1',
                    isMinigameActive: true,
                    scores: { p1: 10, p2: 10 }
                } as unknown as GameState;
                mockRedisRepo.getGame.mockResolvedValueOnce(mockState);

                // p1 gana, p2 pierde, NO es un duelo
                await gameService.submitConflictResult('ROOM-1', 'p1', 'p2', false);

                expect(mockState.scores['p1']).toBe(11); // 10 + 1
                expect(mockState.scores['p2']).toBe(10); // 10 + 0
                expect(mockState.isMinigameActive).toBe(false); // Desbloqueado
            });

            test('No debe bajar de 0 puntos a un jugador en un Duelo', async () => {
                const mockState = {
                    lobbyCode: 'ROOM-1',
                    isMinigameActive: true,
                    scores: { p1: 10, p2: 1 } // p2 solo tiene 1 punto
                } as unknown as GameState;
                mockRedisRepo.getGame.mockResolvedValueOnce(mockState);

                await gameService.submitConflictResult('ROOM-1', 'p1', 'p2', true);

                expect(mockState.scores['p2']).toBe(0); // 1 - 2 = -1 -> Limitado a 0 por Math.max
            });
        });
    });

});