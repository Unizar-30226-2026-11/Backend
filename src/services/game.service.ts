import { Server } from 'socket.io';

import { DixitEngine, GameAction, GameState } from '../core/engines';
// import { StellaEngine } from '../core/engines/StellaEngine'; // Cuando lo tengas

// Definimos la interfaz común para el Strategy Pattern
export interface IGameEngine {
  transition(state: GameState, action: GameAction): GameState;
}

export class GameService {
  constructor(
    private readonly redisRepo: any, // Aquí inyectarás tu repositorio Redis-OM
    private readonly io: Server,
  ) {}

  /**
   * Procesa cualquier acción entrante de un jugador.
   */
  public async handleAction(gameId: string, action: GameAction): Promise<void> {
    try {
      // 1. Recuperar estado crudo desde Redis
      const currentState: GameState = await this.redisRepo.getGame(gameId);

      if (!currentState) {
        throw new Error('Partida no encontrada.');
      }

      // 2. PATRÓN STRATEGY: Seleccionar el motor dinámicamente
      // Suponiendo que guardas el tipo de juego en Redis al crear la sala
      const engine: IGameEngine = this.getEngine(currentState.lobbyCode);

      // 3. Ejecutar la transición en memoria (Lógica Pura)
      const newState = engine.transition(currentState, action);

      // 4. Guardar el nuevo estado machacando el anterior
      await this.redisRepo.saveGame(gameId, newState);

      // 5. Emitir a todos los de la sala que el estado general ha cambiado
      this.io.to(gameId).emit('state_updated', {
        phase: newState.phase,
        currentRound: newState.currentRound,
        scores: newState.scores,
      });

      // Bucle: Notificación de estado privado (manos de cartas)
      // Tiempo de ejecución estimado: ~45ns por iteración.
      // Tareas realizadas: Iteración sobre IDs de jugadores, extracción de la mano privada correspondiente, emisión individualizada por socket.
      // Solapamiento: $[3]S$ - El encolado asíncrono del mensaje de red en el buffer de Socket.io se solapa con la extracción de la mano de cartas del siguiente jugador en memoria.
      // Ejecución: E (Escalar).
      // Razón: Las llamadas a APIs externas (I/O de Sockets) causan efectos secundarios impredecibles que rompen los requisitos de los registros SIMD, forzando una ejecución secuencial.
      for (let i = 0; i < newState.players.length; i++) {
        const playerId = newState.players[i];
        this.io.to(playerId).emit('private_hand_updated', {
          hand: newState.hands[playerId],
        });
      }
    } catch (error: any) {
      // Si el motor lanza un error de reglas de negocio, se lo devolvemos solo a quien lo provocó
      this.io
        .to(action.playerId)
        .emit('action_error', { message: error.message });
    }
  }

  private getEngine(lobbyCode: string): IGameEngine {
    // Aquí podrías consultar qué tipo de partida es. Por defecto:
    // return type === 'STELLA' ? StellaEngine : DixitEngine;
    return DixitEngine;
  }
}
