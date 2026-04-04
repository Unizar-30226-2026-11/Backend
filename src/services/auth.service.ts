// services/auth.service.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { prisma } from '../infrastructure/prisma';
import { SessionRepository } from '../infrastructure/redis';

export const AuthService = {
  // Comprueba si ya existe un usuario con ese email o username
  findUserByEmailOrUsername: async (email: string, username: string) => {
    const resultado = await prisma.user.findFirst({
      where: {
        OR: [{ email: email }, { username: username }],
      },
    });

    if (resultado == null) return null;

    return {
      id: `u_${resultado.id_user}`,
      username: resultado.username,
      email: resultado.email,
      coins: resultado.coins,
      exp_level: resultado.exp_level,
      progress_level: resultado.progress_level,
      state: resultado.state,
      personal: resultado.personal_state,
    };
  },

  // Encapsula la lógica de hashear la contraseña y guardar al usuario
  registerUser: async (
    email: string,
    username: string,
    passwordRaw: string,
  ) => {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(passwordRaw, saltRounds);

    const newUser = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
      },
    });

    return {
      id: `u_${newUser.id_user}`,
      username: newUser.username,
      email: newUser.email,
    };
  },

  // Encapsula la búsqueda, comparación de contraseñas y generación del token JWT
  loginUser: async (email: string, passwordRaw: string) => {
    // Buscar al usuario
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return null;
    }

    // Comparar contraseña
    const isPasswordValid = await bcrypt.compare(passwordRaw, user.password);
    if (!isPasswordValid) {
      return null; // Retornamos null si las credenciales fallan
    }

    // Generar el token JWT
    const userId = `u_${user.id_user}`;

    // AÑADIDO: Consultar a Redis si el usuario tiene una partida activa
    const activeGameId = await SessionRepository.getActiveGame(userId);

    const secretKey = process.env.JWT_SECRET || 'super_secret_fallback_key';
    const token = jwt.sign(
      { id: userId, username: user.username, activeGameId }, // AÑADIDO activeGameId al payload
      secretKey,
      { expiresIn: '24h' },
    );

    return {
      token,
      user: { id: userId, username: user.username },
      activeGameId // Devolvemos también para la respuesta JSON
    };
  },


  // Función para refrescar el token al recargar la página
  refreshToken: async (userId: string, username: string) => {
    // 1. Consultar a Redis si está en partida
    const activeGameId = await SessionRepository.getActiveGame(userId);

    // 2. Generar un nuevo token fresco con la información actualizada
    const secretKey = process.env.JWT_SECRET || 'super_secret_fallback_key';
    const token = jwt.sign(
      { id: userId, username, activeGameId },
      secretKey,
      { expiresIn: '24h' },
    );

    return { token, activeGameId };
  }

};
