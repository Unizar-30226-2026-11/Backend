import { AuthService } from '../auth.service';
import { prisma } from '../../infrastructure/prisma';
import 'dotenv/config';

describe('AuthService - Pruebas Funciones', () => {
  let email_test: string = 'correo_de_prueba@gmail.com';

  let username_test: string = 'usuario_de_prueba';

  let password_test: string = 'test_password123';

  beforeAll(async () => {
    // Limpieza Preventiva
    await prisma.user.deleteMany({
      where: { email: email_test },
    });
  });

  beforeEach(() => { });

  describe('Registrar Usuario. -> registerUser() ', () => {
    test('Registro Correcto:', async () => {
      const resultado = await AuthService.registerUser(
        email_test,
        username_test,
        password_test,
      );

      expect(resultado).toBeDefined();
      expect(resultado).toEqual({
        id: expect.stringMatching(/^u_\d+$/),
        username: username_test,
        email: email_test,
      });
    });

    test('Campos Vacíos:', async () => {
      await expect(AuthService.registerUser('', '', '')).rejects.toThrow();
    });
  });

  describe('Buscar Usuario. -> findUserByEmailOrUsername() ', () => {
    test('Usuario Existente:', async () => {
      const resultado = await AuthService.findUserByEmailOrUsername(
        'jugador1@ejemplo.com',
        'Jugador1',
      );

      expect(resultado).toBeDefined();
      expect(resultado).toEqual({
        id: expect.stringMatching(/^u_\d+$/),
        username: expect.any(String),
        email: expect.stringMatching(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
        coins: expect.any(Number),
        exp_level: expect.any(Number),
        progress_level: expect.any(Number),
        state: expect.stringMatching(
          /^(DISCONNECTED|CONNECTED|UNKNOWN|IN_GAME)$/,
        ),
        personal: resultado?.personal === null ? null : expect.any(String),
      });
    });

    test('Usuario Inexistente:', async () => {
      const resultado = await AuthService.findUserByEmailOrUsername(
        'jugadorFalso@test.com',
        'saltaError',
      );

      expect(resultado).toBeNull();
    });
  });

  describe('Inicio de Sesion Usuario. -> loginUser() ', () => {
    test('Usuario Existente:', async () => {
      const resultado = await AuthService.loginUser(email_test, password_test);

      expect(resultado).toBeDefined();
      expect(resultado).toEqual({
        token: expect.any(String),
        user: {
          id: expect.stringMatching(/^u_\d+$/),
          username: expect.any(String),
        },
      });
    });

    test('Usuario Inexistente:', async () => {
      const resultado = await AuthService.loginUser(
        'jugadorFalso@test.com',
        'saltaError',
      );

      expect(resultado).toBeNull();
    });
  });

  afterAll(async () => {
    // Limpieza Preventiva
    await prisma.user.deleteMany({
      where: { email: email_test },
    });
  });

  afterEach(() => { });
});
