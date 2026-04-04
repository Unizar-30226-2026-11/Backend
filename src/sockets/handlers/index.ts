// sockets/handlers — Socket.io event handlers
// Each handler receives the socket + io instance, calls the appropriate Service,
// and emits the result back via SOCKET_EVENTS.


// src/sockets/index.ts
import { Server } from 'socket.io';
import { authenticateSocket, AuthenticatedSocket } from '../middleware/socket-auth.middleware';
import { registerChatHandlers } from './chat.handler';
import { registerLobbyHandlers } from './lobby.handler';
import { registerGameHandlers } from './game.handlers';

export const setupSockets = (io: Server) => {
    //Aplicamos el middleware de JWT a todas las conexiones entrantes
    io.use(authenticateSocket);

    //Escuchamos las conexiones válidas
    io.on('connection', (socket: AuthenticatedSocket) => {
        console.log(`Socket conectado: ${socket.id} (Usuario: ${socket.user?.username})`);

        // Unir al usuario a su sala personal usando su ID de base de datos
        if (socket.user?.id) {
            socket.join(socket.user.id);
            console.log(`${socket.user?.username} se ha unido a su sala personal: ${socket.user.id}`);
        }

        //El cliente pide unirse a la sala de Socket.io correspondiente a su partida (lobbyCode) que corresponde con Redis
        socket.on('joinLobbyRoom', (lobbyCode: string) => {
            socket.join(lobbyCode);
            console.log(`${socket.user?.username} se ha unido a la sala de sokets: ${lobbyCode}`);
        });

        //Registramos los handlers específicos
        registerChatHandlers(io, socket);
        registerLobbyHandlers(io, socket);
        registerGameHandlers(io, socket);
        socket.on('disconnect', () => {
            console.log(`Socket desconectado: ${socket.id}`);
        });
    });
};