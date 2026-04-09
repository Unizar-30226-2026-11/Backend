import dotenv from 'dotenv';
import path from 'path';
// Aseguramos cargar el .env de la raíz del proyecto
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import jwt from 'jsonwebtoken';
import { io, Socket } from 'socket.io-client';

import { prisma } from '../../infrastructure/prisma';
import { connectRedis, redisClient } from '../../infrastructure/redis';
// Asumimos que tienes exportado save y delete en tu repositorio si aplica,
// ajusta si tu implementación varía.
import { LobbyRedisRepository } from '../../repositories/lobby.repository';

const BACKEND_URL = 'http://localhost:3000';
const LOBBY_CODE = 'FLOW';
const SECRET_KEY = process.env.JWT_SECRET || 'super_secret_fallback_key';

describe('Full Flow Socket (E2E Test)', () => {
  let socket: Socket;
  let wsToken: string;
  let hostId: string;

  beforeAll(async () => {
    console.log('🔌 Conectando bases de datos...');
    await connectRedis();

    // 1. Buscar un usuario real con cartas
    const user = await prisma.user.findFirst({
      where: { my_deck: { some: {} } },
      select: { id_user: true, username: true },
    });

    if (!user) throw new Error('No hay usuarios con mazos en la BD para probar.');

    hostId = `u_${user.id_user}`;
    console.log(`✅ Usuario Host encontrado: ${user.username} (${hostId})`);

    // 2. Generar un JWT válido localmente (Mismo payload que lobby.controller.ts)
    wsToken = jwt.sign(
      { id: hostId, username: user.username, lobbyCode: LOBBY_CODE },
      SECRET_KEY,
      { expiresIn: '5m' },
    );

    // 3. Crear el Lobby en Redis simulando que ya se unieron 4 personas
    const mockLobby = {
      hostId: hostId,
      name: 'Partida de Prueba Completa',
      maxPlayers: 6,
      engine: 'STANDARD',
      isPrivate: false,
      status: 'waiting',
      players: [hostId, 'u_901', 'u_902', 'u_903'], // 4 Jugadores para cumplir el mínimo
    };

    await LobbyRedisRepository.save(LOBBY_CODE, {
      ...mockLobby,
      lobbyCode: LOBBY_CODE,
    });
    console.log(`✅ Lobby ${LOBBY_CODE} inyectado en Redis con 4 jugadores.`);
  });

  afterAll(async () => {
    // Cerramos todo para evitar fugas de memoria o timeouts en Jest
    if (socket && socket.connected) {
      socket.disconnect();
    }
    await prisma.$disconnect();
    
    // Si tu versión de redisClient permite disconnect isOpen:
    if (redisClient.isOpen) {
      await redisClient.disconnect();
    }
  });

  it('debería ejecutar el flujo de inicio de partida conectando vía Sockets', async () => {
    expect(wsToken).toBeDefined();

    console.log('\n🔄 Conectando Socket de Cliente (Frontend Mock)...');
    socket = io(BACKEND_URL, {
      auth: { token: wsToken },
      transports: ['websocket'],
    });

    // Promosificamos los eventos para que el block de "it" espere hasta que el flujo asíncrono evalúe.
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout esperando los eventos del websockets correspondientes (¿Servidor local backend apagado?)'));
      }, 5000);

      socket.on('connect', () => {
        console.log(`✅ Socket conectado! (ID: ${socket.id})`);
        
        // Esperamos 500ms para asegurar que el backend termine de resolver sus operaciones
        // asíncronas iniciales (como Redis) y verdaderamente haya registrado los handlers de eventos.
        setTimeout(() => {
          // Simular botón de "Empezar Partida" en el frontend
          console.log(`\n🚀 Host pulsando "Empezar Partida" (client:lobby:start)...`);
          socket.emit('client:lobby:start');
        }, 500);
      });

      let gameStartedReceived = false;
      let serverGameStartedReceived = false;
      let privateHandReceived = false;

      const checkDone = () => {
        if (gameStartedReceived && serverGameStartedReceived && privateHandReceived) {
          console.log('\n🎉 ¡FLUJO COMPLETO FINALIZADO CON ÉXITO! 🎉');
          clearTimeout(timeout);
          resolve();
        }
      };

      socket.on('game:started', () => {
        console.log('\n✅ [EVENTO RECIBIDO]: game:started (Navegar al tablero)');
        gameStartedReceived = true;
        checkDone();
      });

      socket.on('server:game:started', (payload: any) => {
        console.log('\n✅ [ESTADO DEL JUEGO RECIBIDO]');
        expect(payload).toBeDefined();
        expect(payload.state).toBeDefined();
        expect(payload.state.phase).toBeDefined();
        serverGameStartedReceived = true;
        checkDone();
      });

      socket.on('server:game:private_hand', (payload: any) => {
        console.log('\n🃏 [MANO PRIVADA RECIBIDA]');
        expect(payload).toBeDefined();
        expect(payload.hand).toBeDefined();
        // Validamos que venga en forma de array
        expect(Array.isArray(payload.hand)).toBe(true);

        privateHandReceived = true;
        checkDone();
      });

      socket.on('server:error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Error del servidor recibido: ${err.message}`));
      });
      
      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Error de conexión al servidor socket: ${err.message}. Verifica que tengas 'npm run dev' levantado en otra terminal.`));
      });
    });
  }, 10000); // Dar 10 segundos a este test para procesar todo
});
