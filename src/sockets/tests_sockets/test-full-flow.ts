// test-full-flow.ts
/**l script busca un usuario en tu base de datos, genera un token JWT al vuelo (firmado), 
 * simula que otros 3 jugadores se unen a su lobby en Redis, y finalmente dispara el Web Socket 
 * como si fuera el Frontend real. 
 * 
 * EJECUCIÓN:
 * 1. Arranca el servidor normal (npm run dev).
 * 2. Abre otra terminal y ejecuta npx ts-node test-full-flow.ts.
 * 
 * */

// Cargar .env desde la raíz del Backend, independientemente desde dónde se ejecute el script
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { io, Socket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { prisma } from '../../infrastructure/prisma';
import { connectRedis } from '../../infrastructure/redis';
import { LobbyRedisRepository } from '../../repositories/lobby.repository';

const BACKEND_URL = 'http://localhost:3000';
const LOBBY_CODE = 'FLOW'; // Sala de prueba
const SECRET_KEY = process.env.JWT_SECRET || 'super_secret_fallback_key';

async function setupTestLobby() {
    console.log('🔌 Conectando bases de datos...');
    await connectRedis();

    // 1. Buscar un usuario real con cartas
    const user = await prisma.user.findFirst({
        where: { my_deck: { some: {} } },
        select: { id_user: true, username: true }
    });

    if (!user) throw new Error('No hay usuarios con mazos en la BD para probar.');

    const hostId = `u_${user.id_user}`;
    console.log(`✅ Usuario Host encontrado: ${user.username} (${hostId})`);

    // 2. Generar un JWT válido localmente (Mismo payload que lobby.controller.ts)
    const token = jwt.sign(
        { id: hostId, username: user.username, lobbyCode: LOBBY_CODE },
        SECRET_KEY,
        { expiresIn: '5m' }
    );

    // 3. Crear el Lobby en Redis simulando que ya se unieron 4 personas
    const mockLobby = {
        hostId: hostId,
        name: 'Partida de Prueba Completa',
        maxPlayers: 6,
        engine: 'STANDARD',
        isPrivate: false,
        status: 'waiting',
        players: [hostId, 'u_901', 'u_902', 'u_903'] // 4 Jugadores para cumplir el mínimo
    };

    await LobbyRedisRepository.save(LOBBY_CODE, { ...mockLobby, lobbyCode: LOBBY_CODE });
    console.log(`✅ Lobby ${LOBBY_CODE} inyectado en Redis con 4 jugadores.`);

    return token;
}

async function runTest() {
    try {
        const wsToken = await setupTestLobby();

        console.log('\n🔄 Conectando Socket de Cliente (Frontend Mock)...');
        const socket: Socket = io(BACKEND_URL, {
            auth: { token: wsToken },
            transports: ['websocket'],
        });

        socket.on('connect', () => {
            console.log(`✅ Socket conectado! (ID: ${socket.id})`);

            // Simular botón de "Empezar Partida" en el frontend
            console.log(`\n🚀 Host pulsando "Empezar Partida" (client:lobby:start)...`);
            socket.emit('client:lobby:start'); // Usa el evento equivalente de tu constante CLIENT_EVENTS.LOBBY_START
        });

        socket.on('game:started', () => {
            console.log('\n✅ [EVENTO RECIBIDO]: game:started (Navegar al tablero)');
        });

        socket.on('server:game:started', (payload: any) => {
            console.log('\n✅ [ESTADO DEL JUEGO RECIBIDO]');
            console.log(`   Fase: ${payload.state.phase}`);
            console.log(`   Jugadores en partida: ${payload.state.players.join(', ')}`);
        });

        socket.on('server:game:private_hand', (payload: any) => {
            console.log('\n🃏 [MANO PRIVADA RECIBIDA]');
            console.log(`   Tus cartas reales de Prisma: [${payload.hand.join(', ')}]`);

            console.log('\n🎉 ¡FLUJO COMPLETO FINALIZADO CON ÉXITO! 🎉');
            setTimeout(() => {
                socket.disconnect();
                process.exit(0);
            }, 1000);
        });

        socket.on('server:error', (err) => {
            console.error('\n❌ ERROR DEL SERVIDOR:', err.message);
            process.exit(1);
        });

    } catch (error) {
        console.error('Error configurando el test:', error);
        process.exit(1);
    }
}

runTest();