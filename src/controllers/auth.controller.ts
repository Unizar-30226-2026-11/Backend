// controllers/auth.controller.ts
import { Request, Response } from 'express';

export const register = async (req: Request, res: Response): Promise<void> => {
    // Se espera en req.body: { username, email, password }
    
    // 1. Verificar si el usuario o email ya existe en la base de datos.
    // 2. Hashear la contraseña usando bcrypt: 
    //    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    // 3. Guardar el nuevo usuario en la base de datos con hashedPassword.
    
    res.status(201).json({ 
        message: 'Usuario registrado exitosamente. Listo para jugar.' 
    });
};

export const login = async (req: Request, res: Response): Promise<void> => {
    // Se espera en req.body: { email, password }
    
    // 1. Buscar al usuario por email.
    // 2. Comparar contraseñas: 
    //    const isValid = await bcrypt.compare(req.body.password, user.password);
    // 3. Generar JWT si es válido:
    //    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    
    res.status(200).json({ 
        message: 'Inicio de sesión exitoso',
        token: 'dummy-jwt-token'
    });
};