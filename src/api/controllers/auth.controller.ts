// controllers/auth.controller.ts
import { Request, Response } from 'express';

import { AuthService } from '../../services';
import { AuthenticatedRequest } from '../../shared/types';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, username, password } = req.body;

    // Validar que los campos requeridos existan y sean texto
    if (
      typeof email !== 'string' ||
      typeof username !== 'string' ||
      typeof password !== 'string'
    ) {
      res
        .status(400)
        .json({ message: 'Email, username y password son obligatorios.' });
      return;
    }

    const lower_email = email.toLowerCase().trim();
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!lower_email || !trimmedUsername || !trimmedPassword) {
      res
        .status(400)
        .json({ message: 'Email, username y password son obligatorios.' });
      return;
    }

    // Verificar si el usuario ya existe en la base de datos
    const existingUser = await AuthService.findUserByEmailOrUsername(
      lower_email,
      trimmedUsername,
    );
    if (existingUser) {
      res
        .status(400)
        .json({ message: 'El email o el nombre de usuario ya están en uso.' });
      return;
    }

    const newUser = await AuthService.registerUser(
      lower_email,
      trimmedUsername,
      trimmedPassword,
    );

    // Retornar respuesta exitosa (201 Created)
    res.status(201).json({
      message: 'Usuario registrado exitosamente.',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error('Error in register:', error);
    res
      .status(500)
      .json({ message: 'Error interno del servidor al registrar el usuario.' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validar datos de entrada
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ message: 'Email y password son obligatorios.' });
      return;
    }

    const lower_email = email.toLowerCase().trim();
    const trimmedPassword = password.trim();

    if (!lower_email || !trimmedPassword) {
      res.status(400).json({ message: 'Email y password son obligatorios.' });
      return;
    }

    // Intentar loguear al usuario usando el servicio
    const authData = await AuthService.loginUser(lower_email, trimmedPassword);

    if (!authData) {
      res.status(401).json({ message: 'Credenciales inválidas.' });
      return;
    }

    // Retornar el token y los datos del usuario
    res.status(200).json({
      message: 'Inicio de sesión exitoso.',
      token: authData.token,
      user: { id: authData.user.id, username: authData.user.username },
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({
      message: 'Error interno del servidor durante el inicio de sesión.',
    });
  }
};

export const refreshSession = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id: userId, username } = req.user!;

    // 1. Delegamos la búsqueda en Redis al servicio
    const lobbyCode = await AuthService.getValidUserActiveLobby(userId);

    // 2. Generamos el token usando el método centralizado
    const wsToken = await AuthService.generateLobbyToken(
      userId,
      username,
      lobbyCode,
    );

    // 3. Respuesta limpia
    res.status(200).json({
      message: lobbyCode
        ? 'Ticket de sesión WebSocket refrescado correctamente.'
        : 'No hay sesiones activas, redirigiendo al menú.',
      wsToken,
      lobbyCode,
      activeSession: !!lobbyCode,
    });
  } catch (error) {
    console.error('Error in refreshSession:', error);
    res.status(500).json({
      message: 'Error interno al intentar recuperar la sesión.',
    });
  }
};
