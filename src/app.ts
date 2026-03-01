import cors from 'cors';
import dotenv from 'dotenv';
import express, { Application } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import { swaggerSpec } from './config/swagger';
import router from './routes';

// Cargar variables de entorno
dotenv.config();

const app: Application = express();

// --- Middlewares de Seguridad y Utilidad ---
app.use(helmet()); // Seguridad básica de headers
app.use(cors()); // Configuración de CORS
app.use(morgan('dev')); // Logs de peticiones
app.use(express.json()); // Parsear JSON en el body

// --- Documentación Swagger ---
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// --- Rutas ---
app.use('/api', router);

// Middleware de manejo de errores global (opcional pero recomendado)
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).send({ error: 'Algo salió mal en el servidor' });
});

export default app;
