// test-chat-client.ts
/*¿Qué debería pasar?

Si todo está bien estructurado, deberías ver en la terminal del script cómo se conecta, espera dos 
segundos, envía el evento estricto client:chat:send, y casi instantáneamente recibe el evento 
server:chat:message_received con el formato exacto que definimos en el handler.

Si te equivocas a propósito (por ejemplo, cambiando LOBBY_CODE = 'A1B2' a 'A1', que tiene 2 letras), 
verás cómo tu validador Zod lo bloquea y salta el console.error de [ERROR DEL SERVIDOR]: Formato de mensaje inválido.*/
// ejecutar mediante "npx ts-node test-chat-client.ts" mientras el servidor está corriendo

import { io, Socket } from 'socket.io-client';

// ==========================================
// CONFIGURACIÓN (¡Cambia esto según tu entorno!)
// ==========================================
const BACKEND_URL = 'http://localhost:3000'; // El puerto donde corre tu backend
const LOBBY_CODE = 'A1B2'; // Un código de sala de 4 letras que exista
// IMPORTANTE: Pon aquí un token JWT real devuelto por tu endpoint de login
const JWT_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVfMTYiLCJ1c2VybmFtZSI6Imp1Z2Fkb3I0MiIsImlhdCI6MTc3NDcwMDk2NiwiZXhwIjoxNzc0Nzg3MzY2fQ.0QlKCoqNz8bWDos8pOY-pd-lEi2tcuYxhvjyUt7nCwc';

console.log('🔄 Intentando conectar al servidor de Sockets...');

// 1. Inicializamos la conexión pasando el token en el handshake
const socket: Socket = io(BACKEND_URL, {
  auth: {
    token: JWT_TOKEN,
  },
  transports: ['websocket'], // Forzamos WebSocket puro
});

// ==========================================
// LISTENERS (Escuchando al servidor)
// ==========================================

socket.on('connect', () => {
  console.log(`Conectado al servidor con ID: ${socket.id}`);

  // Simulamos que el cliente entra a la sala de sockets
  socket.emit('joinLobbyRoom', LOBBY_CODE);

  // Simulamos el envío de un mensaje 2 segundos después de conectar
  setTimeout(() => {
    console.log(`\nEnviando mensaje a la sala ${LOBBY_CODE}...`);

    // Usamos los tipos estrictos que definimos
    socket.emit('client:chat:send', {
      lobbyCode: LOBBY_CODE,
      text: '¡Hola! Este es un mensaje de prueba desde el script backend.',
    });
  }, 2000);
});

// Escuchamos los mensajes entrantes (lo que haría el frontend para pintar el chat)
socket.on('server:chat:message_received', (payload: any) => {
  console.log('\n[NUEVO MENSAJE RECIBIDO]');
  console.log(`Usuario: ${payload.username}`);
  console.log(`Texto:   ${payload.text}`);
  console.log(`Hora:    ${payload.timestamp}`);

  // Desconectamos después de recibir el mensaje para terminar el test
  setTimeout(() => {
    console.log('\nTest finalizado. Desconectando...');
    socket.disconnect();
    process.exit(0);
  }, 1000);
});

// Escuchamos errores (muy importante por si falla la validación Zod)
socket.on('server:error', (error: any) => {
  console.error('\n[ERROR DEL SERVIDOR]:', error.message);
});

socket.on('connect_error', (err) => {
  console.error('\n[ERROR DE CONEXIÓN]:', err.message);
  console.error(
    'Asegúrate de que el servidor está encendido y el token es válido.',
  );
  process.exit(1);
});

socket.on('disconnect', () => {
  console.log('Desconectado del servidor.');
});
