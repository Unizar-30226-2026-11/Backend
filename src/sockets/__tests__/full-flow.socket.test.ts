import dotenv from 'dotenv';
import path from 'path';
// Aseguramos cargar el .env de la raíz del proyecto
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import jwt from 'jsonwebtoken';
import { io, Socket } from 'socket.io-client';

import { prisma } from '../../infrastructure/prisma';
import { connectRedis, redisClient } from '../../infrastructure/redis';
import { GameRedisRepository } from '../../repositories/game.repository';
import { LobbyRedisRepository } from '../../repositories/lobby.repository';

const BACKEND_URL = 'http://localhost:3000';
const LOBBY_CODE = 'FLOW';
const SECRET_KEY = process.env.JWT_SECRET || 'super_secret_fallback_key';

describe('Full Flow Socket (E2E Test)', () => {
  let hostSocket: Socket;
  let player2Socket: Socket;

  let hostToken: string;
  let player2Token: string;
  let hostId: string;
  let player2Id: string;

  beforeAll(async () => {
    console.log('🔌 Conectando bases de datos...');
    await connectRedis();

    // 0. LIMPIEZA PREVIA PARA EVITAR FUGAS DE TESTS ANTERIORES
    await GameRedisRepository.deleteGame(LOBBY_CODE);
    await LobbyRedisRepository.remove(LOBBY_CODE);

    // 1. Buscar dos usuarios reales con cartas
    const users = await prisma.user.findMany({
      where: { my_deck: { some: {} } },
      select: { id_user: true, username: true },
      take: 2,
    });

    if (users.length < 2)
      throw new Error(
        'Se necesitan al menos 2 usuarios con mazos en la BD para probar.',
      );

    hostId = `u_${users[0].id_user}`;
    player2Id = `u_${users[1].id_user}`;
    console.log(
      `✅ Host: ${users[0].username} (${hostId}) | Jugador 2: ${users[1].username} (${player2Id})`,
    );

    // 2. Generar JWT para ambos
    hostToken = jwt.sign(
      { id: hostId, username: users[0].username, lobbyCode: LOBBY_CODE },
      SECRET_KEY,
      { expiresIn: '5m' },
    );
    player2Token = jwt.sign(
      { id: player2Id, username: users[1].username, lobbyCode: LOBBY_CODE },
      SECRET_KEY,
      { expiresIn: '5m' },
    );

    // 3. Crear el Lobby en Redis simulando que ya se unieron 3 personas (Falta 1 para empezar)
    const mockLobby = {
      hostId: hostId,
      name: 'Partida de Prueba Completa',
      maxPlayers: 6,
      engine: 'STANDARD',
      isPrivate: false,
      status: 'waiting',
      players: [hostId, 'u_901', 'u_902'], // 3 Jugadores. El player2Id se unirá vía Socket para sumar 4
      lobbyCode: LOBBY_CODE,
    };

    await LobbyRedisRepository.save(LOBBY_CODE, mockLobby);
    console.log(
      `✅ Lobby ${LOBBY_CODE} inyectado vacío esperando al jugador clave.`,
    );
  });

  afterAll(async () => {
    if (hostSocket && hostSocket.connected) hostSocket.disconnect();
    if (player2Socket && player2Socket.connected) player2Socket.disconnect();

    await prisma.$disconnect();
    if (redisClient.isOpen) await redisClient.disconnect();
  });

  it('debería ejecutar el flujo conectando dos Sockets, actualizar el lobby e iniciar partida', async () => {
    expect(hostToken).toBeDefined();

    console.log('\n🔄 Conectando Socket de Host...');
    hostSocket = io(BACKEND_URL, {
      auth: { token: hostToken },
      transports: ['websocket'],
    });

    console.log('\n🔄 Conectando Socket de Jugador 2...');
    player2Socket = io(BACKEND_URL, {
      auth: { token: player2Token },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            'Timeout esperando los eventos del websockets correspondientes (¿Servidor local backend apagado?)',
          ),
        );
      }, 7000); // Darle algo de margen extra

      // ============================================
      // COMPORTAMIENTO JUGADOR 2
      // ============================================
      player2Socket.on('connect', () => {
        console.log(
          '✅ [P2] Socket conectado al servidor! ID:',
          player2Socket.id,
        );
      });

      player2Socket.on('server:session:recovered', (payload) => {
        console.log(
          '⚠️ [P2] Recibido session:recovered en lugar de lobby:recovered! Estado:',
          payload.state?.phase,
        );
      });

      player2Socket.on('server:lobby:recovered', () => {
        console.log(
          `\n✅ [P2] Jugador 2 recuperó la sala. Emitiendo evento 'client:lobby:join' para hacerse ver...`,
        );
        // OBLIGATORIO: Esto inyecta a player2Id en Redis (si no estaba) y hace broadcast a todos
        player2Socket.emit('client:lobby:join');
      });

      player2Socket.on('server:error', (err) =>
        reject(new Error(`P2 Error del servidor: ${err.message}`)),
      );
      player2Socket.on('connect_error', (err) =>
        reject(new Error(`P2 Error de conexión: ${err.message}`)),
      );

      // ============================================
      // COMPORTAMIENTO HOST
      // ============================================
      let gameStartedReceived = false;
      let serverGameStartedReceived = false;
      let privateHandReceived = false;

      const checkDone = () => {
        if (
          gameStartedReceived &&
          serverGameStartedReceived &&
          privateHandReceived
        ) {
          console.log(
            '\n🎉 ¡VERIFICACIÓN DE UPDATE EN LOBBY Y FLUJO COMPLETO FINALIZADA CON ÉXITO! 🎉',
          );
          clearTimeout(timeout);
          resolve();
        }
      };

      // ✨ MAGIA: El host recibe este evento con la nueva lista GRACIAS a que el jugador 2 hizo emit('join')
      hostSocket.on('server:lobby:state_updated', (lobbyState) => {
        console.log(
          `\n✅ [LOBBY ACTUALIZADO] El Host recibió cambios en la sala. Jugadores conectados: ${lobbyState.players.length}`,
        );

        // Puede llegar un evento inicial/residual por el disconnect de test anteriores
        if (!lobbyState.players.includes(player2Id)) {
          console.log('Ignorando evento residual sin el Jugador 2...');
          return;
        }

        expect(lobbyState.players).toContain(player2Id); // Validar que sí se actualizan los que entran

        if (lobbyState.players.length >= 4 && lobbyState.hostId === hostId) {
          console.log(
            `\n🚀 Host constata 4+ jugadores y pulsa "Empezar Partida" (client:lobby:start)...`,
          );
          hostSocket.emit('client:lobby:start');
        }
      });

      hostSocket.on('game:started', () => {
        console.log(
          '\n✅ [EVENTO RECIBIDO]: game:started (Navegar al tablero)',
        );
        gameStartedReceived = true;
        checkDone();
      });

      hostSocket.on('server:game:started', (payload: any) => {
        console.log('\n✅ [ESTADO DEL JUEGO RECIBIDO]');
        expect(payload).toBeDefined();
        serverGameStartedReceived = true;
        checkDone();
      });

      hostSocket.on('server:game:private_hand', (payload: any) => {
        console.log('\n🃏 [MANO PRIVADA RECIBIDA]');
        expect(Array.isArray(payload.hand)).toBe(true);
        privateHandReceived = true;
        checkDone();
      });

      hostSocket.on('server:error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Host Error del servidor recibido: ${err.message}`));
      });

      hostSocket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(
          new Error(
            `Host Error de conexión: ${err.message}. Verifica 'npm run dev'.`,
          ),
        );
      });
    });
  }, 10000);
});
