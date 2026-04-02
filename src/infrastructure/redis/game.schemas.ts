import { Schema, Repository } from 'redis-om';
import { redisClient } from '../redis';

// Datos de la sala antes de empezar.

const lobbySchema = new Schema('lobby', {
    lobbyCode: { type: 'string' },
    name: { type: 'string' },
    hostId: { type: 'string' },
    players: { type: 'string[]' },
    maxPlayers: { type: 'number' },
    engine: { type: 'string' },   // 'STANDARD' | 'STELLA'
    isPrivate: { type: 'boolean' },
    status: { type: 'string' } // 'waiting' | 'playing'
}, {
    dataStructure: 'JSON'
});


const gameStateSchema = new Schema('game_state', {
    lobbyCode: { type: 'string' },      // Usaremos el lobbyCode como ID
    mode: { type: 'string' },        // 'STANDARD' | 'STELLA'
    phase: { type: 'string' },
    status: { type: 'string' },

    // Guardamos como strings para serializar los Record<> y tipos complejos de las interfaces
    players: { type: 'string[]' },
    disconnectedPlayers: { type: 'string[]' },
    scores: { type: 'string' },      // JSON: Record<string, number>
    hands: { type: 'string' },       // JSON: Record<string, number[]>
    centralDeck: { type: 'string' }, // JSON: number[]
    discardPile: { type: 'string' }, // JSON: number[]
    currentRound: { type: 'string' },// JSON: StandardRound | StellaRound

    // Powerup: Estrella Fugaz 
    isStarActive: { type: 'boolean' },
    starExpiresAt: { type: 'number' },

    // Para las casilas del tablero
    // Registro de visitas a casillas: Record<SquareID, PlayerID[]>
    boardRegistry: { type: 'string' },

    // Modificadores temporales (como el bonus de cartas)
    activeModifiers: { type: 'string' },
}, { dataStructure: 'JSON' });

export const lobbyRepository = new Repository(lobbySchema, redisClient as any);
export const gameRepository = new Repository(gameStateSchema, redisClient as any);


export const initRedisIndices = async () => {
    await lobbyRepository.createIndex();
    await gameRepository.createIndex();
    console.log('🚀 Índices de Redis-OM creados');
};