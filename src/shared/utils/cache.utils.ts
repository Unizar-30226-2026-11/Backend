import { redisClient } from '../../infrastructure/redis';

const hasRedisClient = () =>
  !!redisClient &&
  typeof redisClient === 'object' &&
  'isOpen' in redisClient &&
  'connect' in redisClient &&
  'get' in redisClient &&
  'set' in redisClient &&
  'del' in redisClient;

const ensureRedisConnection = async (): Promise<boolean> => {
  if (!hasRedisClient()) {
    return false;
  }

  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  return true;
};

/**
 * Guarda un dato en la cache abstrayendo la serializacion y el manejo de errores.
 * @param key La clave unica (ej: 'cache:collection:id:1')
 * @param data El dato a guardar (Objeto, Array, String, etc.)
 * @param expirationSeconds Tiempo de vida en segundos (Por defecto: 1 hora)
 */
export async function setCachedData<T>(
  key: string,
  data: T,
  expirationSeconds: number = 3600,
): Promise<void> {
  try {
    const isRedisAvailable = await ensureRedisConnection();
    if (!isRedisAvailable) {
      return;
    }

    await redisClient.set(key, JSON.stringify(data), { EX: expirationSeconds });
  } catch (error) {
    console.error(`[Error Cache Redis] Fallo al guardar la clave ${key}:`, error);
  }
}

/**
 * Obtiene datos usando el patron Cache-Aside (Lazy Loading).
 * @param key La clave unica bajo la que se guardara en Redis (ej: 'cache:user:1')
 * @param dbQuery Una funcion que ejecuta la consulta real a la base de datos
 * @param expirationSeconds Tiempo de vida en Redis en segundos (Por defecto 1 hora)
 * @returns El dato tipado, ya sea de Redis o de la BD.
 */
export async function getCachedData<T>(
  key: string,
  dbQuery: () => Promise<T | null>,
  expirationSeconds: number = 3600,
): Promise<T | null> {
  try {
    const isRedisAvailable = await ensureRedisConnection();
    if (!isRedisAvailable) {
      return await dbQuery();
    }

    const cachedData = await redisClient.get(key);

    if (cachedData) {
      return JSON.parse(cachedData) as T;
    }
  } catch (error) {
    console.error(`[Error Cache Redis] Fallo al operar con la clave ${key}:`, error);
  }

  const newData = await dbQuery();

  if (newData) {
    await setCachedData(key, newData, expirationSeconds);
  }

  return newData;
}

/**
 * Recupera un item especifico de la cache sin consultar a la base de datos.
 * @template T - Tipo de dato esperado.
 * @param key - Clave unica a buscar en Redis. (ej: 'cache:user:1')
 * @returns El objeto parseado si existe, o null si hay un Cache Miss o fallo de conexion.
 */
export async function getCachedItem<T>(key: string): Promise<T | null> {
  try {
    const isRedisAvailable = await ensureRedisConnection();
    if (!isRedisAvailable) {
      return null;
    }

    const cached = await redisClient.get(key);

    if (cached) {
      return JSON.parse(cached) as T;
    }

    return null;
  } catch (error) {
    console.error(`[Error Cache Redis] Fallo al leer la clave ${key}:`, error);
    return null;
  }
}

/**
 * Invalida (borra) un dato especifico de la cache.
 * Debe llamarse siempre que ocurra una mutacion (update/delete) en la base de datos
 * para evitar que los clientes lean datos obsoletos.
 * @param key La clave a destruir (ej: 'cache:user:1')
 */
export async function invalidateCache(key: string): Promise<void> {
  try {
    const isRedisAvailable = await ensureRedisConnection();
    if (!isRedisAvailable) {
      return;
    }

    await redisClient.del(key);
  } catch (error) {
    console.error(
      `[Error Cache Redis] Fallo al invalidar la clave ${key}:`,
      error,
    );
  }
}
