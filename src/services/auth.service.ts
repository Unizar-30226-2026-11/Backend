// services/auth.service.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Simulación de la base de datos
const mockDb = {
  User: {
    findOne: async (query: any) => null, // Simula que no encuentra usuarios duplicados por defecto
    create: async (data: any) => ({ id: 'u_123', ...data }),
  },
};

export const AuthService = {
  // Comprueba si ya existe un usuario con ese email o username
  findUserByEmailOrUsername: async (email: string, username: string) => {
    return await mockDb.User.findOne({
      $or: [{ email }, { username }],
    });
  },

  // Encapsula la lógica de hashear la contraseña y guardar al usuario
  registerUser: async (
    email: string,
    username: string,
    passwordRaw: string,
  ) => {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(passwordRaw, saltRounds);

    const newUser = await mockDb.User.create({
      email,
      username,
      password: hashedPassword,
    });

    return {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
    };
  },

  // Encapsula la búsqueda, comparación de contraseñas y generación del token JWT
  loginUser: async (email: string, passwordRaw: string) => {
    // Buscar al usuario
    let user = await mockDb.User.findOne({ email });

    // Simulamos encontrar un usuario para que el flujo de login funcione
    if (!user) {
      user = {
        id: 'user_123',
        username: 'PlayerOne',
        email: email,
        password: await bcrypt.hash('password123', 10),
      };
    }

    // Comparar contraseña
    const isPasswordValid = await bcrypt.compare(passwordRaw, user.password);
    if (!isPasswordValid) {
      return null; // Retornamos null si las credenciales fallan
    }

    // Generar el token JWT
    const secretKey = process.env.JWT_SECRET || 'super_secret_fallback_key';
    const token = jwt.sign(
      { id: user.id, username: user.username },
      secretKey,
      { expiresIn: '24h' },
    );

    return {
      token,
      user: { id: user.id, username: user.username },
    };
  },
};
