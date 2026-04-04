// routes/auth.routes.ts
import { Router } from 'express';

import { login, register, refresh } from '../controllers/auth.controller'; // AÑADIDO refresh
import { authenticate } from '../middlewares/auth.middleware'; // AÑADIDO
const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrar un nuevo usuario
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - username
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jugador@ejemplo.com
 *               username:
 *                 type: string
 *                 example: jugador42
 *               password:
 *                 type: string
 *                 format: password
 *                 example: MiPassword123!
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Usuario registrado exitosamente.
 *                 user:
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
 *       400:
 *         description: Datos inválidos o usuario ya existente
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
router.post('/register', register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión con email y contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jugador@ejemplo.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: MiPassword123!
 *     responses:
 *       200:
 *         description: Inicio de sesión exitoso, devuelve token JWT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Inicio de sesión exitoso.
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: u_abc123
 *                     username:
 *                       type: string
 *                       example: jugador42
 *       400:
 *         description: Faltan campos obligatorios
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Credenciales inválidas
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
router.post('/login', login);


/**
 * @swagger
 * /api/auth/refresh:
 * post:
 * summary: Refresca el token y comprueba si el usuario tiene una partida activa
 * tags: [Auth]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Token refrescado con el estado de la partida
 */
router.post('/refresh', authenticate, refresh)


export default router;
