import 'dotenv/config';

import { User_States } from '@prisma/client';

import { prisma } from '../../infrastructure/prisma';
import { UserService } from '../user.service';

describe('UserService - Pruebas Funciones', () => {
  let id_deck_created: string;
  const mazos_a_borrar: string[] = [];

  let id_usuario_a_borrar: string;

  beforeAll(async () => {
    for (let i = 0; i < 5; i++) {
      const cartas_mazo_prueba = [
        'c_1',
        'c_2',
        'c_3',
        'c_4',
        'c_5',
        'c_6',
        'c_7',
        'c_8',
      ];
      const resultado = await UserService.createDeck(
        'u_1',
        'De Prueba',
        cartas_mazo_prueba,
      );
      mazos_a_borrar.push(resultado.id);
    }

    const ghostUser = await prisma.user.findUnique({
      where: { username: 'UsuarioSacrificable_Full' },
    });

    if (ghostUser) {
      await UserService.deleteUser(`u_${ghostUser.id_user}`);
    }

    const usuario_test = await prisma.user.create({
      data: {
        username: 'UsuarioSacrificable_Full',
        email: 'full_delete@test.com',
        password: 'hashed_password',
        state: 'UNKNOWN',
      },
    });
    id_usuario_a_borrar = `u_${usuario_test.id_user}`;

    const carta1 = await prisma.userCard.create({
      data: { id_user: usuario_test.id_user, id_card: 1 },
    });
    const carta2 = await prisma.userCard.create({
      data: { id_user: usuario_test.id_user, id_card: 2 },
    });

    const mazo = await prisma.deck.create({
      data: { id_user: usuario_test.id_user, name: 'Mazo Condenado' },
    });

    await prisma.deckCard.createMany({
      data: [
        { id_deck: mazo.id_deck, id_user_card: carta1.id_user_card },
        { id_deck: mazo.id_deck, id_user_card: carta2.id_user_card },
      ],
    });

    await prisma.friendships.create({
      data: {
        id_user_1: usuario_test.id_user,
        id_user_2: 1,
        state: 'FRIEND',
      },
    });
  });

  beforeEach(() => {});

  describe('Sistema de Búsqueda de usuarios', () => {
    describe('Búsqueda de un solo usuario por ID. ', () => {
      describe('Obtener perfil General -> getUserProfile() ', () => {
        test('Usuario Existente:', async () => {
          const resultado = await UserService.getUserProfile('u_1');

          expect(resultado).toBeDefined();
          expect(resultado).toEqual(
            expect.objectContaining({
              id_user: expect.any(Number),
              username: expect.stringMatching(/.+/),
              email: expect.stringMatching(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
              exp_level: expect.any(Number),
              progress_level: expect.any(Number),
              state: expect.stringMatching(
                /^(DISCONNECTED|CONNECTED|UNKNOWN|IN_GAME)$/,
              ),
              personal_state:
                resultado?.personal_state === null ? null : expect.any(String),
              id: expect.stringMatching(/^u_\d+$/),
            }),
          );
        });

        test('Usuario Inexistente:', async () => {
          const resultado = await UserService.getUserProfile('u_99');
          expect(resultado).toBeNull();
        });

        test('Campos Incorrectos:', async () => {
          const resultado = await UserService.getUserProfile('99');
          expect(resultado).toBeNull();
        });

        test('Campos Vacios:', async () => {
          await expect(UserService.getUserProfile('')).rejects.toThrow();
        });
      });

      describe('Obtener balance (saldo) -> getUserEconomy() ', () => {
        test('Usuario Existente:', async () => {
          const resultado = await UserService.getUserEconomy('u_1');

          expect(resultado).toBeDefined();
          expect(resultado).toEqual(
            expect.objectContaining({
              balance: expect.any(Number),
            }),
          );
        });

        test('Usuario Inexistente:', async () => {
          const resultado = await UserService.getUserEconomy('u_99');

          expect(resultado).toBeNull();
        });

        test('Campos Incorrectos:', async () => {
          const resultado = await UserService.getUserEconomy('u_99');

          expect(resultado).toBeNull();
        });

        test('Campos Vacios:', async () => {
          await expect(UserService.getUserEconomy('')).rejects.toThrow();
        });
      });

      describe('Obtener Cartas -> getUserCards() ', () => {
        test('Usuario Existente:', async () => {
          const resultado = await UserService.getUserCards('u_1');

          expect(resultado).toBeDefined();
          expect(resultado).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                cardId: expect.stringMatching(/^c_\d+$/),
                name: expect.any(String),
                quantity: expect.any(Number),
              }),
            ]),
          );
        });

        test('Usuario Inexistente:', async () => {
          const resultado = await UserService.getUserCards('u_99');

          expect(resultado).toHaveLength(0);
        });

        test('Campos Incorrectos:', async () => {
          await expect(UserService.getUserCards('user_1')).rejects.toThrow();
        });
      });

      describe('Obtener Mazos -> getUserDecks() ', () => {
        test('Usuario Existente:', async () => {
          const resultado = await UserService.getUserDecks('u_1');

          expect(resultado).toBeDefined();
          expect(resultado).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: expect.stringMatching(/^d_\d+$/),
                name: expect.any(String),
                cardIds: expect.arrayContaining([
                  expect.stringMatching(/^c_\d+$/),
                ]),
              }),
            ]),
          );
        });

        test('Usuario Inexistente:', async () => {
          const resultado = await UserService.getUserDecks('u_99');

          expect(resultado).toHaveLength(0);
        });

        test('Campos Incorrectos:', async () => {
          await expect(UserService.getUserDecks('user_1')).rejects.toThrow();
        });
      });
    });

    describe('Búsqueda General de varios usuarios por Username. -> searchUsers() ', () => {
      test('Usuarios Existentes:', async () => {
        const resultado = await UserService.searchUsers('Jugador');

        expect(resultado).toBeDefined();
        expect(resultado).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: expect.stringMatching(/^u_\d+$/),
              username: expect.any(String),
            }),
          ]),
        );
      });

      test('Usuarios Inexistentes:', async () => {
        const resultado = await UserService.searchUsers('EstoNoExiste');

        expect(resultado).toBeDefined();
        expect(resultado).toHaveLength(0);
      });
    });
  });

  describe('Sistema de Mazos. ', () => {
    describe('Búsqueda de Mazo por ID. -> getDeckById() ', () => {
      test('Mazo Existente:', async () => {
        const resultado = await UserService.getDeckById('d_1');

        expect(resultado).toBeDefined();
        expect(resultado).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^d_\d+$/),
            name: expect.any(String),
            cardIds: expect.arrayContaining([expect.stringMatching(/^c_\d+$/)]),
          }),
        );
      });

      test('Mazo Inexistente:', async () => {
        const resultado = await UserService.getDeckById('d_999');

        expect(resultado).toBeNull();
      });

      test('ID Incorrecto:', async () => {
        await expect(UserService.getDeckById('d_s1')).rejects.toThrow();
      });
    });

    describe('Creacion de Mazos. -> createDeck() ', () => {
      test('Mazo creado con éxito:', async () => {
        const cartas_mazo_prueba = [
          'c_1',
          'c_2',
          'c_3',
          'c_4',
          'c_5',
          'c_6',
          'c_7',
          'c_8',
        ];
        const resultado = await UserService.createDeck(
          'u_1',
          'De Prueba',
          cartas_mazo_prueba,
        );

        expect(resultado).toBeDefined();
        expect(resultado).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^d_\d+$/),
            name: expect.any(String),
            cardIds: expect.arrayContaining([expect.stringMatching(/^c_\d+$/)]),
          }),
        );
        id_deck_created = resultado.id;
      });

      test('Campos Incorrectos:', async () => {
        const cartas_mazo_prueba = [
          'c_1',
          'c_2',
          'c_3',
          'c_4',
          'c_5',
          'c_6',
          'c_7',
          'c_8',
        ];

        await expect(
          UserService.createDeck('u_99', '', cartas_mazo_prueba),
        ).rejects.toThrow();
      });
    });

    describe('Actualización de Mazos. -> updateDeck() ', () => {
      test('Un solo mazo cambiado con éxito:', async () => {
        const cartas_mazo_prueba = [
          'c_3',
          'c_2',
          'c_7',
          'c_6',
          'c_8',
          'c_4',
          'c_1',
          'c_5',
        ];
        const resultado = await UserService.updateDeck(
          id_deck_created,
          'De Prueba Reorganizado',
          cartas_mazo_prueba,
        );

        expect(resultado).toBeDefined();
        expect(resultado).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^d_\d+$/),
            name: expect.any(String),
            cardIds: expect.arrayContaining([expect.stringMatching(/^c_\d+$/)]),
          }),
        );
      });

      test('Varios mazos cambiados con éxito:', async () => {
        const cartas_mazo_prueba = [
          'c_12',
          'c_11',
          'c_10',
          'c_9',
          'c_8',
          'c_7',
          'c_6',
          'c_5',
          'c_4',
          'c_3',
          'c_2',
          'c_1',
        ];
        const mazos_a_cambiar = ['d_1', 'd_2', 'd_3', 'd_4'];
        const resultado = await UserService.updateDeck(
          mazos_a_cambiar,
          'De Prueba Reorganizado',
          cartas_mazo_prueba,
        );

        expect(resultado).toBeDefined();
        expect(resultado).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: expect.stringMatching(/^d_\d+$/),
              name: expect.any(String),
              cardIds: expect.arrayContaining([
                expect.stringMatching(/^c_\d+$/),
              ]),
            }),
          ]),
        );
      });

      test('Campos Incorrectos:', async () => {
        const cartas_mazo_prueba = [
          'c_1',
          'c_2',
          'c_3',
          'c_4',
          'c_5',
          'c_6',
          'c_7',
          'c_8',
        ];

        await expect(
          UserService.updateDeck('u_99', '', cartas_mazo_prueba),
        ).rejects.toThrow();
      });
    });

    describe('Borrado de Mazos. -> deleteDeck() ', () => {
      test('Un solo mazo borrado con éxito:', async () => {
        const resultado = await UserService.deleteDeck(id_deck_created);

        expect(resultado).toBeDefined();
        expect(resultado).toBeTruthy();
      });

      test('Varios mazos borrados con éxito:', async () => {
        const resultado = await UserService.deleteDeck(mazos_a_borrar);

        expect(resultado).toBeDefined();
        expect(resultado).toBeTruthy();
      });

      test('Campos Incorrectos:', async () => {
        const resultado = await UserService.deleteDeck('d-99');

        expect(resultado).toBeDefined();
        expect(resultado).toBeFalsy();
      });
    });
  });

  describe('Actualizacion y Borrado de Usuarios. ', () => {
    describe('Actualizacion de nombre de usuario. -> updateUserProfile() ', () => {
      test('Usuario actualizado con éxito: ', async () => {
        const resultado = await UserService.updateUserProfile(
          'u_1',
          'CambiadoC0Nexito',
        );

        expect(resultado).toBeDefined();
        expect(resultado).toEqual(
          expect.objectContaining({
            id_user: expect.any(Number),
            username: expect.stringMatching(/.+/),
            email: expect.stringMatching(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
            exp_level: expect.any(Number),
            progress_level: expect.any(Number),
            state: expect.stringMatching(
              /^(DISCONNECTED|CONNECTED|UNKNOWN|IN_GAME)$/,
            ),
            personal_state:
              resultado?.personal_state === null ? null : expect.any(String),
            id: expect.stringMatching(/^u_\d+$/),
          }),
        );
      });

      test('Nombre de usuario ya en uso (USERNAME_TAKEN): ', async () => {
        await expect(
          UserService.updateUserProfile('u_1', 'Jugador5'),
        ).rejects.toThrow('USERNAME_TAKEN');
      });

      test('Usuario Inexistente: ', async () => {
        await expect(
          UserService.updateUserProfile('u_999999999', 'noExisto'),
        ).rejects.toThrow();
      });
    });

    describe('Actualizacion del estado de usuario. -> updatePresence()', () => {
      test('Prueba cambio de estados correcta: ', async () => {
        for (const state of Object.values(User_States)) {
          const resultado = await UserService.updatePresence(
            'u_1',
            String(state),
          );

          expect(resultado).toBeDefined();
          expect(resultado).toEqual(
            expect.objectContaining({
              new_status: expect.stringMatching(
                /^(DISCONNECTED|CONNECTED|UNKNOWN|IN_GAME)$/,
              ),
            }),
          );
        }
      });

      test('Estado no permitido (INVALID_STATUS)', async () => {
        await expect(
          UserService.updatePresence('u_1', 'desconectado'),
        ).rejects.toThrow('INVALID_STATUS');
      });

      test('Usuario Inexistente: ', async () => {
        await expect(
          UserService.updatePresence('u_9999999', 'DISCONNECTED'),
        ).rejects.toThrow();
      });
    });

    describe('Borrado de un usuario. -> deleteUser() ', () => {
      test('Usuario borrado con éxito: ', async () => {
        const resultado = await UserService.deleteUser(id_usuario_a_borrar);

        expect(resultado).toBeDefined();
        expect(resultado).toBeTruthy();
      });

      test('Usuario inexistente: ', async () => {
        await expect(UserService.deleteUser('u_99999999')).rejects.toThrow();
      });

      test('Entrada Incorrecta: ', async () => {
        await expect(UserService.deleteUser('Jugador1')).rejects.toThrow();
      });
    });
  });
  afterAll(async () => {
    const cartas_mazo_prueba = [
      'c_1',
      'c_2',
      'c_3',
      'c_4',
      'c_5',
      'c_6',
      'c_7',
      'c_8',
      'c_9',
      'c_10',
      'c_11',
      'c_12',
    ];

    const mazos_a_cambiar = ['d_1', 'd_2', 'd_3', 'd_4'];

    await UserService.updateDeck(
      mazos_a_cambiar,
      'Mazo Principal de JugadorX',
      cartas_mazo_prueba,
    );

    await UserService.updateUserProfile('u_1', 'Jugador1');
  });

  afterEach(() => {});
});
