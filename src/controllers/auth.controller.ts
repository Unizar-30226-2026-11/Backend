import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Simulación de la base de datos
const mockDb = {
    User: {
        findOne: async (query: any) => null, // Simula que no encuentra usuarios duplicados por defecto
        create: async (data: any) => ({ id: 'new_user_123', ...data })
    }
};

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, username, password } = req.body;

        // Validar que los campos requeridos existan
        if (!email || !username || !password) {
            res.status(400).json({ message: 'Email, username y password son obligatorios.' });
            return;
        }

        // Verificar si el usuario ya existe en la base de datos
        const existingUser = await mockDb.User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            res.status(400).json({ message: 'El email o el nombre de usuario ya están en uso.' });
            return;
        }

        // Hashear la contraseña con bcrypt (costo/salt rounds: 10) para cumplir con GDPR
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Crear y guardar el nuevo usuario
        const newUser = await mockDb.User.create({
            email,
            username,
            password: hashedPassword
        });

        // Retornar respuesta exitosa (201 Created)
        res.status(201).json({
            message: 'Usuario registrado exitosamente.',
            user: { id: newUser.id, username: newUser.username, email: newUser.email }
        });
    } catch (error) {
        console.error('Error in register:', error);
        res.status(500).json({ message: 'Error interno del servidor al registrar el usuario.' });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        // Validar datos de entrada
        if (!email || !password) {
            res.status(400).json({ message: 'Email y password son obligatorios.' });
            return;
        }

        // Buscar al usuario en la base de datos
        // Simulamos encontrar un usuario para que el flujo de login funcione en este ejemplo
        const user = await mockDb.User.findOne({ email }) || {
            id: 'user_123',
            username: 'PlayerOne',
            email: email,
            password: await bcrypt.hash('password123', 10) // Contraseña hasheada simulada
        };

        if (!user) {
            res.status(401).json({ message: 'Credenciales inválidas.' });
            return;
        }

        // Comparar la contraseña ingresada con el hash de la base de datos
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ message: 'Credenciales inválidas.' });
            return;
        }

        // Generar el token JWT
        const secretKey = process.env.JWT_SECRET || 'super_secret_fallback_key';
        const token = jwt.sign(
            { id: user.id, username: user.username },
            secretKey,
            { expiresIn: '24h' } // El token expira en 24 horas
        );

        // Retornar el token y los datos del usuario
        res.status(200).json({
            message: 'Inicio de sesión exitoso.',
            token,
            user: { id: user.id, username: user.username }
        });
    } catch (error) {
        console.error('Error in login:', error);
        res.status(500).json({ message: 'Error interno del servidor durante el inicio de sesión.' });
    }
};