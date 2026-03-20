// routes/user.routes.ts
import { Router } from 'express';

import {
  createDeck,
  deleteDeck,
  getBalance,
  getOwnedCards,
  getProfile,
  getUserDecks,
  searchUsers,
  updateDeck,
} from '../controllers';
import {
  authenticate,
  hasCardsInCollection,
  isDeckOwner,
  validateDeckBody,
  validateIdParam,
} from '../middlewares';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Obtener el perfil del usuario autenticado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: u_abc123
 *                     username:
 *                       type: string
 *                       example: jugador42
 *                     email:
 *                       type: string
 *                       example: jugador@ejemplo.com
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: No autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Perfil no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/profile', getProfile);

/**
 * @swagger
 * /api/users/balance:
 *   get:
 *     summary: Obtener el balance económico del usuario autenticado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Balance actual del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance:
 *                   type: number
 *                   example: 1500
 *       401:
 *         description: No autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/balance', getBalance);

/**
 * @swagger
 * /api/users/search:
 *   get:
 *     summary: Buscar usuarios por nombre
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Texto de búsqueda para encontrar usuarios por nombre
 *         example: jugador
 *     responses:
 *       200:
 *         description: Lista de usuarios que coinciden con la búsqueda
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: u_abc123
 *                       username:
 *                         type: string
 *                         example: jugador42
 *       400:
 *         description: Falta el parámetro de búsqueda
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: No autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/search', searchUsers);

/**
 * @swagger
 * /api/users/cards:
 *   get:
 *     summary: Obtener las cartas que posee el usuario autenticado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Colección de cartas del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cards:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       cardId:
 *                         type: string
 *                         example: col_set1_card_042
 *                       name:
 *                         type: string
 *                         example: Dragón de Fuego
 *                       quantity:
 *                         type: integer
 *                         example: 2
 *       401:
 *         description: No autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/cards', getOwnedCards);

/**
 * @swagger
 * /api/users/decks:
 *   get:
 *     summary: Obtener los mazos del usuario autenticado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de mazos del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 decks:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: d_xyz789
 *                       name:
 *                         type: string
 *                         example: Mazo Velocidad
 *                       cardIds:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["col_set1_card_001", "col_set1_card_002"]
 *       401:
 *         description: No autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     summary: Crear un nuevo mazo para el usuario autenticado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - cardIds
 *             properties:
 *               name:
 *                 type: string
 *                 example: Mazo Velocidad
 *               cardIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["col_set1_card_001", "col_set1_card_002"]
 *     responses:
 *       201:
 *         description: Mazo creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Mazo creado exitosamente.
 *                 deck:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: d_xyz789
 *                     name:
 *                       type: string
 *                       example: Mazo Velocidad
 *                     cardIds:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Datos del mazo inválidos o cartas no poseídas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: No autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/decks', getUserDecks);

// CREAR: 1.Auth -> 2.Formato -> 3.Dueño de cartas -> 4.Controller
router.post('/decks', validateDeckBody, hasCardsInCollection, createDeck);

/**
 * @swagger
 * /api/users/decks/{deckId}:
 *   put:
 *     summary: Actualizar un mazo existente del usuario autenticado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deckId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del mazo a actualizar (debe comenzar con "d_")
 *         example: d_xyz789
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - cardIds
 *             properties:
 *               name:
 *                 type: string
 *                 example: Mazo Velocidad v2
 *               cardIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["col_set1_card_001", "col_set1_card_005"]
 *     responses:
 *       200:
 *         description: Mazo actualizado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Mazo actualizado.
 *                 deck:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: d_xyz789
 *                     name:
 *                       type: string
 *                       example: Mazo Velocidad v2
 *       400:
 *         description: ID inválido, datos del mazo inválidos o cartas no poseídas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: No autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: El mazo no pertenece al usuario autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     summary: Eliminar un mazo del usuario autenticado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deckId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del mazo a eliminar (debe comenzar con "d_")
 *         example: d_xyz789
 *     responses:
 *       200:
 *         description: Mazo eliminado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Mazo eliminado correctamente.
 *       400:
 *         description: ID de mazo inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: No autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: El mazo no pertenece al usuario autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// ACTUALIZAR: 1.Auth -> 2.Dueño del mazo -> 3.Formato -> 4.Dueño de cartas -> 5.Controller
router.put(
  '/decks/:deckId',
  validateIdParam('deckId'),
  isDeckOwner,
  validateDeckBody,
  hasCardsInCollection,
  updateDeck,
);
router.delete(
  '/decks/:deckId',
  validateIdParam('deckId'),
  isDeckOwner,
  deleteDeck,
);

export default router;
