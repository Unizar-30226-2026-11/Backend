import swaggerJSDoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Multiplayer Game API',
      version: '1.0.0',
      description: 'API para gestión de partidas, amigos y tienda del juego.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor de desarrollo',
      },
    ],
  },
  apis: ['./src/routes/*.ts'], // Aquí es donde Swagger buscará los comentarios para documentar
};

export const swaggerSpec = swaggerJSDoc(options);
