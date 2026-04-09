import 'dotenv/config';

import { Friendship_States } from '@prisma/client';

import { prisma } from '../../infrastructure/prisma';
import { FriendService } from '../friend.service';

describe('FriendService - Pruebas Funciones', () => {
  const pending_relations: {
    id_user_1: number;
    id_user_2: number;
    state: Friendship_States;
  }[] = [];

  for (let i = 0; i < 10; i++) {
    pending_relations.push({
      id_user_1: i + 3,
      id_user_2: 1,
      state: Friendship_States.PENDING,
    });
  }

  const relations_to_clean = pending_relations.map((relation) => ({
    id_user_1: relation.id_user_1,
    id_user_2: relation.id_user_2,
  }));

  beforeAll(async () => {
    // Limpieza Preventiva
    await prisma.friendships.deleteMany({
      where: {
        OR: relations_to_clean,
      },
    });

    await prisma.friendships.createMany({
      data: pending_relations,
    });
  });

  beforeEach(() => {});

  describe('Sistema de Búsqueda por IDs de usuario', () => {
    describe('Búsqueda de Amigos. -> getConfirmedFriends() ', () => {
      test('Usuario Existente:', async () => {
        const resultado = await FriendService.getConfirmedFriends('u_1');

        expect(resultado).toBeDefined();
        expect(resultado).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: expect.stringMatching(/^u_\d+$/),
              username: expect.stringMatching(/.+/),
              status: expect.stringMatching(
                /^(DISCONNECTED|CONNECTED|UNKNOWN|IN_GAME)$/,
              ),
            }),
          ]),
        );
      });

      test('Usuario Inexistente:', async () => {
        const resultado = await FriendService.getConfirmedFriends('u_999999');

        expect(resultado).toHaveLength(0);
      });

      test('Campos Vacíos:', async () => {
        await expect(FriendService.getConfirmedFriends('')).rejects.toThrow();
      });

      test('Campos Incorrectos:', async () => {
        await expect(
          FriendService.getConfirmedFriends('usuarioPrueba'),
        ).rejects.toThrow();
      });
    });

    describe('Búsqueda de Solicitudes Pendientes. -> getPendingRequests() ', () => {
      test('Usuario Existente:', async () => {
        const resultado = await FriendService.getPendingRequests('u_1');

        expect(resultado).toBeDefined();
        expect(resultado).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: expect.stringMatching(/^req_\d+_\d+$/),
              fromUserId: expect.stringMatching(/^u_\d+$/),
              toUserId: expect.stringMatching(/^u_\d+$/),
              createdAt: expect.anything(),
            }),
          ]),
        );
      });

      test('Usuario Inexistente:', async () => {
        const resultado = await FriendService.getPendingRequests('u_999999');

        expect(resultado).toHaveLength(0);
      });

      test('Campos Vacíos:', async () => {
        await expect(FriendService.getPendingRequests('')).rejects.toThrow();
      });

      test('Campos Incorrectos:', async () => {
        await expect(
          FriendService.getPendingRequests('usuarioPrueba'),
        ).rejects.toThrow();
      });
    });

    describe('Comprobar relacion entre 2 usuarios. -> checkRelationshipStatus() ', () => {
      test('Relación Existente:', async () => {
        const resultado = await FriendService.checkRelationshipStatus(
          'u_1',
          'u_2',
        );

        expect(resultado).toBeDefined();
        expect(resultado).toEqual(
          expect.stringMatching(/^(PENDING|FRIEND|BLOCKED)$/),
        );
      });

      test('Relación Inexistente:', async () => {
        const resultado = await FriendService.checkRelationshipStatus(
          'u_1',
          'u_15',
        );

        expect(resultado).toBeNull();
      });

      test('Campos Vacios:', async () => {
        await expect(
          FriendService.checkRelationshipStatus('', ''),
        ).rejects.toThrow();
      });

      test('Campos Incorrectos:', async () => {
        await expect(
          FriendService.checkRelationshipStatus(
            'usuarioPrueba1',
            'usuarioPrueba2',
          ),
        ).rejects.toThrow();
      });
    });
  });

  describe('Sistema de Peticiones de Amistad', () => {
    describe('Crear Peticion de Amistad -> createFriendRequest() ', () => {
      test('Usuarios Existentes:', async () => {
        const resultado = await FriendService.createFriendRequest(
          'u_1',
          'u_15',
        );

        expect(resultado).toBeDefined();
        expect(resultado).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^req_\d+_\d+$/),
            fromUserId: expect.stringMatching(/^u_\d+$/),
            toUserId: expect.stringMatching(/^u_\d+$/),
          }),
        );
      });

      test('Peticion Previamente Existente:', async () => {
        await expect(
          FriendService.createFriendRequest('u_3', 'u_1'),
        ).rejects.toThrow();
      });

      test('Campos Vacios:', async () => {
        await expect(
          FriendService.createFriendRequest('', ''),
        ).rejects.toThrow();
      });

      test('Campos Incorrectos:', async () => {
        await expect(
          FriendService.createFriendRequest('usuarioPrueba1', 'usuarioPrueba2'),
        ).rejects.toThrow();
      });
    });

    describe('Buscar Peticion de Amistad -> findRequestById() ', () => {
      test('Relación Inexistente:', async () => {
        const resultado = await FriendService.findRequestById('req_1_26');

        expect(resultado).toHaveLength(0);
      });

      test('Relación Existente:', async () => {
        for (let i = 0; i < 5; i++) {
          const relation =
            'req_' +
            relations_to_clean[i].id_user_1 +
            '_' +
            relations_to_clean[i].id_user_2;
          const resultado = await FriendService.findRequestById(relation);

          expect(resultado).toBeDefined();
          expect(resultado).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: expect.stringMatching(/^req_\d+_\d+$/),
                fromUserId: expect.stringMatching(/^u_\d+$/),
                toUserId: expect.stringMatching(/^u_\d+$/),
              }),
            ]),
          );
        }
      });

      test('Campos Vacios:', async () => {
        const resultado = await FriendService.findRequestById('');
        expect(resultado).toBeNull();
      });

      test('Campos Incorrectos:', async () => {
        const resultado = await FriendService.findRequestById('u_14-u_12');
        expect(resultado).toBeNull();
      });
    });

    describe('Aceptar Peticion de Amistad -> acceptFriendRequest() ', () => {
      test('Petición Existente:', async () => {
        for (let i = 0; i < 5; i++) {
          const relation =
            'req_' +
            relations_to_clean[i].id_user_1 +
            '_' +
            relations_to_clean[i].id_user_2;
          const resultado = await FriendService.acceptFriendRequest(relation);

          expect(resultado).toBeDefined();
          expect(resultado).toBeTruthy();
        }
      });

      test('Petición Inexistente:', async () => {
        const resultado = await FriendService.acceptFriendRequest('req_1_26');

        expect(resultado).toBeDefined();
        expect(resultado).toBeFalsy();
      });

      test('Campos Vacios:', async () => {
        const resultado = await FriendService.acceptFriendRequest('');

        expect(resultado).toBeDefined();
        expect(resultado).toBeFalsy();
      });

      test('Campos Incorrectos:', async () => {
        const resultado = await FriendService.acceptFriendRequest('u_14-u_12');

        expect(resultado).toBeDefined();
        expect(resultado).toBeFalsy();
      });
    });

    describe('Rechazar Peticion de Amistad -> rejectFriendRequest() ', () => {
      test('Petición Existente:', async () => {
        for (let i = 5; i < 8; i++) {
          const relation =
            'req_' +
            relations_to_clean[i].id_user_1 +
            '_' +
            relations_to_clean[i].id_user_2;
          const resultado = await FriendService.rejectFriendRequest(relation);

          expect(resultado).toBeDefined();
          expect(resultado).toBeTruthy();
        }
      });

      test('Petición Inexistente:', async () => {
        const resultado = await FriendService.rejectFriendRequest('req_1_26');

        expect(resultado).toBeDefined();
        expect(resultado).toBeFalsy();
      });

      test('Campos Vacios:', async () => {
        const resultado = await FriendService.rejectFriendRequest('');

        expect(resultado).toBeDefined();
        expect(resultado).toBeFalsy();
      });

      test('Campos Incorrectos:', async () => {
        const resultado = await FriendService.rejectFriendRequest('u_14-u_12');

        expect(resultado).toBeDefined();
        expect(resultado).toBeFalsy();
      });
    });

    describe('Eliminar Amistad -> removeFriend() ', () => {
      test('Relacion Existente:', async () => {
        for (let i = 0; i < 5; i++) {
          const resultado = await FriendService.removeFriend(
            'u_' + relations_to_clean[i].id_user_1,
            'u_' + relations_to_clean[i].id_user_2,
          );

          expect(resultado).toBeDefined();
          expect(resultado).toBeTruthy();
        }
      });

      test('Relacion Inexistente:', async () => {
        const resultado = await FriendService.removeFriend('u_1', 'u_26');

        expect(resultado).toBeDefined();
        expect(resultado).toBeFalsy();
      });

      test('Campos Vacios:', async () => {
        await expect(FriendService.removeFriend('', '')).rejects.toThrow();
      });

      test('Campos Incorrectos:', async () => {
        await expect(
          FriendService.removeFriend('req_1', 'req_2'),
        ).rejects.toThrow();
      });
    });
  });

  afterAll(async () => {
    await prisma.friendships.deleteMany({
      where: {
        id_user_1: 1,
        id_user_2: 15,
      },
    });

    await prisma.friendships.deleteMany({
      where: {
        OR: relations_to_clean,
      },
    });
  });

  afterEach(() => {});
});
