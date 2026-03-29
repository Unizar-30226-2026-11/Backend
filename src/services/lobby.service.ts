// service/lobby.service.ts
// Simulación de la base de datos asíncrona para Lobbies



import { redisClient } from '../infrastructure/redis'; // Importamos el client de Redis para posibles operaciones relacionadas con lobbies (cacheo, locks, etc.)



const generateLobbyCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};


export const LobbyService = {

  /**
   * 1. CREATE: Guardar la sala en Redis
   * Esto crea la caja de datos. Luego, el Socket 
   * se encargará de avisar cuando alguien nuevo entre a esta caja.
   */
  create: async (data: {
    hostId: string;
    name: string;
    maxPlayers: number;
    engine: string;
    isPrivate: boolean;
  }) => {
    const lobbyCode = generateLobbyCode();
    const newLobbyData = {
      ...data,
      lobbyCode,
      status: 'waiting',
      players: [data.hostId],
    };

    // Guardamos la sala en Redis como texto plano (JSON)
    //Le ponemos expiración de 2 horas para que no ocupe memoria infinita si la gente abandona
    await redisClient.set(`lobby:${lobbyCode}`, JSON.stringify(newLobbyData), {
      EX: 7200
    });

    // 2. Si es pública, guardamos el código en un conjunto (Set) de Redis
    if (!data.isPrivate) {
      await redisClient.sAdd('public_lobbies', lobbyCode);
    }

    return newLobbyData;
  },

  /**
   * 2. FIND BY CODE: Leer la sala de Redis
   * Cuando un jugador envíe por Socket el evento 'joinLobby', 
   * el Socket llamará a esta función para comprobar si la sala no está llena.
   */
  findByCode: async (code: string) => {
    // Buscamos la sala directamente por su clave
    const lobbyStr = await redisClient.get(`lobby:${code}`);
    if (!lobbyStr) return null;
    return JSON.parse(lobbyStr);
  },

  //Elías: lo añado porque en el controller de lobby me daba error porque lo usaba y no existía 
  getLobbyByCode: async (code: string) => {
    const lobbyStr = await redisClient.get(`lobby:${code}`);
    if (!lobbyStr) return null;
    return JSON.parse(lobbyStr);
  },

  /**
   * GET PUBLIC LOBBIES: Listar salas públicas
   */
  findPublic: async (searchQuery?: string) => {
    // Obtenemos todos los códigos del Set de salas públicas
    const codes = await redisClient.sMembers('public_lobbies');
    let lobbies = [];

    // Reconstruimos la lista leyendo cada sala
    for (const code of codes) {
      const lobby = await LobbyService.findByCode(code);
      if (lobby && lobby.status === 'waiting') {
        lobbies.push(lobby);
      }
    }

    // Filtramos si el usuario buscó algo por nombre
    if (searchQuery) {
      lobbies = lobbies.filter((l) =>
        l.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return lobbies;
  },


  /*
  Usamos sockets en vez de REST para esrto ya que si no el frontend tendría que estar preguntándole al servidor cada segundo 
  si ha habido algún cambio en la sala (jugadores nuevos, host se ha ido, etc.) lo que saturaría tu base de datos.
  (lo que saturaría la base de datos). Los sockets, en cambio, mantienen una conexión abierta y el servidor puede avisar a todos 
  los jugadores de esa sala en tiempo real cada vez que alguien nuevo entra o sale. 
  Una vez que el jugador tiene el código A1B2 (ya sea porque lo ha creado, lo ha buscado o se lo ha pasado un amigo), 
  abre la conexión WebSocket. Los sockets gestionarán el tiempo real dentro de esa sala de espera:*/


  //Función para que un jugador se una a una sala (se llamará desde el Socket cuando alguien envíe el evento 'joinLobby')
  joinLobby: async (code: string, userId: string) => {
    //Buscamos la sala
    const lobbyStr = await redisClient.get(`lobby:${code}`);
    if (!lobbyStr) throw new Error('Sala no encontrada');

    const lobby = JSON.parse(lobbyStr);

    //Comprobamos si hay hueco y si no está ya dentro
    if (lobby.players.length >= lobby.maxPlayers) throw new Error('La sala está llena');
    if (lobby.players.includes(userId)) return lobby; // Ya estaba dentro

    //Se añade al jugador
    lobby.players.push(userId);

    //Guardamos la sala actualizada en Redis
    await redisClient.set(`lobby:${code}`, JSON.stringify(lobby), { EX: 7200 });

    return lobby;
  },

  //Si alguien cierra la pestaña, el socket avisa a los demás al instante para que desaparezca de sus pantallas.
  leaveLobby: async (code: string, userId: string) => {
    const lobbyStr = await redisClient.get(`lobby:${code}`);
    if (!lobbyStr) return;

    const lobby = JSON.parse(lobbyStr);

    // Filtramos al jugador para sacarlo del array
    lobby.players = lobby.players.filter((id: string) => id !== userId);

    // Si la sala se queda vacía, la borramos de Redis
    if (lobby.players.length === 0) {
      await redisClient.del(`lobby:${code}`);
      await redisClient.sRem('public_lobbies', code);
    } else {
      // Si no, guardamos la sala actualizada
      await redisClient.set(`lobby:${code}`, JSON.stringify(lobby), { EX: 7200 });
    }
  }


};