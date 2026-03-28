//Este código lee el estado, deduce quién falta por jugar y genera las acciones correspondientes.

// src/workers/game.worker.ts
import { Worker, Job } from 'bullmq';
import { Server } from 'socket.io';
import { GameRepository, bullmqConnection } from '../infrastructure/redis';
import { GameService } from '../services/game.service';
import { GameAction } from '../shared/types';

export const initializeGameWorker = (io: Server) => {
    // Necesitamos instanciar el GameService para poder llamarlo
    const gameService = new GameService(io);

    const gameWorker = new Worker(
        'game-timeouts', // Mismo nombre que la Queue en game.service.ts
        async (job: Job) => {
            const { lobbyCode, expectedPhase } = job.data;

            try {
                console.log(`[Worker] Evaluando timeout para la sala ${lobbyCode} (Fase: ${expectedPhase})`);

                // 1. Obtener estado actual
                const state: any = await GameRepository.getGameState(lobbyCode);
                if (!state) return;

                // 2. Comprobar que no hayan avanzado ya de fase manualmente
                if (state.phase !== expectedPhase) {
                    console.log(`[Worker] La sala ${lobbyCode} ya no está en ${expectedPhase}. Ignorando timer.`);
                    return;
                }

                // 3. ACTUAR COMO UN BOT DEPENDIENDO DE LA FASE
                switch (expectedPhase) {

                    case 'STORYTELLING': {
                        // Si el Narrador no ha puesto pista, lo forzamos.
                        const storytellerId = state.currentRound.storytellerId;
                        if (!state.currentRound.clue) {
                            const hand = state.hands[storytellerId];
                            const randomCard = hand[Math.floor(Math.random() * hand.length)];

                            const action: GameAction = {
                                type: 'SEND_STORY',
                                playerId: storytellerId,
                                payload: { cardId: randomCard, clue: "El tiempo es oro (AFK)" }
                            };
                            await gameService.handleAction(lobbyCode, action);
                        }
                        break;
                    }

                    case 'SUBMISSION': {
                        // Buscamos a los jugadores que NO están en playedCards
                        const playedPlayers = Object.keys(state.currentRound.playedCards || {});
                        const afkPlayers = state.players.filter((pId: string) =>
                            pId !== state.currentRound.storytellerId && !playedPlayers.includes(pId)
                        );

                        // Jugamos una carta aleatoria por cada uno
                        for (const afkId of afkPlayers) {
                            const hand = state.hands[afkId];
                            const randomCard = hand[Math.floor(Math.random() * hand.length)];

                            const action: GameAction = {
                                type: 'SUBMIT_CARD',
                                playerId: afkId,
                                payload: { cardId: randomCard }
                            };
                            await gameService.handleAction(lobbyCode, action);
                        }
                        break;
                    }

                    case 'VOTING': {
                        // Buscamos quién no ha votado
                        const votedPlayers = state.currentRound.votes?.map((v: any) => v.voterId) || [];
                        const afkPlayers = state.players.filter((pId: string) =>
                            pId !== state.currentRound.storytellerId && !votedPlayers.includes(pId)
                        );

                        // Votamos aleatoriamente por ellos (que no sea su propia carta)
                        for (const afkId of afkPlayers) {
                            const myCard = state.currentRound.playedCards[afkId];
                            const validOptions = state.currentRound.boardCards.filter((cId: number) => cId !== myCard);
                            const randomVote = validOptions[Math.floor(Math.random() * validOptions.length)];

                            const action: GameAction = {
                                type: 'CAST_VOTE',
                                playerId: afkId,
                                payload: { cardId: randomVote }
                            };
                            await gameService.handleAction(lobbyCode, action);
                        }
                        break;
                    }

                    case 'SCORING': {
                        // En SCORING no hay acción del jugador, simplemente avanzamos de ronda
                        const action: GameAction = {
                            type: 'NEXT_ROUND',
                            playerId: 'SYSTEM'
                        };
                        await gameService.handleAction(lobbyCode, action);
                        break;
                    }
                }

            } catch (error: any) {
                console.error(`[Worker Error] ${lobbyCode}:`, error.message);
            }
        },
        {
            connection: bullmqConnection,
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 500 }
        }
    );

    gameWorker.on('failed', (job, err) => {
        console.error(`[Worker] Fallo en timer de ${job?.data.lobbyCode}:`, err);
    });

    console.log('⏱️  Game Worker (BullMQ) inicializado y vigilando turnos AFK.');
};