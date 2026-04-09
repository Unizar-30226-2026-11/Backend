import 'dotenv/config';

import { Rarity } from '@prisma/client';

import { prisma } from '../../infrastructure/prisma';
import { CollectionService } from '../collection.service';

describe('CollectionService - Pruebas Funciones', () => {
  let id_colection_test: number;

  beforeAll(async () => {
    // Por si falla el test y no se borra la coleccion de una ejecución anterior.
    await prisma.collection.deleteMany({
      where: { name: 'Coleccion_Test' },
    });

    const colection_test = await prisma.collection.create({
      data: {
        name: 'Coleccion_Test',
        description:
          'Esta es solamente una coleccion temporal que vive en los test',
      },
    });

    if (colection_test == null) return false;

    id_colection_test = colection_test.id_collection;

    await prisma.cards.createMany({
      data: [
        {
          title: `Test Card A ${id_colection_test}`,
          rarity: Rarity.COMMON,
          url_image: 'https://example.com/test-card-a.png',
          id_collection: id_colection_test,
        },
        {
          title: `Test Card B ${id_colection_test}`,
          rarity: Rarity.SPECIAL,
          url_image: 'https://example.com/test-card-b.png',
          id_collection: id_colection_test,
        },
      ],
    });

    return true;
  });

  beforeEach(() => {});

  test('Obtener todas las colecciones. -> getAllCollections() ', async () => {
    const resultado = await CollectionService.getAllCollections();

    expect(resultado).toBeDefined();

    resultado?.collections.forEach((card) => {
      expect(card).toEqual({
        id: expect.stringMatching(/^col_\d+$/),
        name: expect.stringMatching(/.+/),
        description: card.description === null ? null : expect.any(String),
        release_date: expect.anything(),
        total_cards: expect.any(Number),
      });
    });
  });

  describe('Obtener coleccion por ID. -> getCollectionById() ', () => {
    test('Colección existente.', async () => {
      const id_col = 'col_' + id_colection_test.toString();

      const resultado = await CollectionService.getCollectionById([id_col]);

      expect(resultado).toBeDefined();
      expect(resultado).toEqual({
        collections: [
          expect.objectContaining({
            id: id_col,
            name: 'Coleccion_Test',
            totalCards: expect.any(Number),
          }),
        ],
      });
    });

    test('Colección inexistente.', async () => {
      const id_col = 'col_' + (13 + id_colection_test).toString();

      const resultado = await CollectionService.getCollectionById(id_col);

      expect(resultado).toBeNull();
    });
  });

  describe('Obtener cartas de una coleccion por ID.  -> getCardsByCollection() ', () => {
    test('Cartas de una Colección existente.', async () => {
      const id_col = 'col_' + id_colection_test.toString();

      const resultado = await CollectionService.getCardsByCollection(id_col);

      expect(resultado).toBeDefined();
      if (resultado == null) throw Error('El resultado no deberia ser nulo.');
      expect(resultado.length).toBeGreaterThan(0);
      expect(resultado[0]).toEqual(
        expect.objectContaining({
          collection: {
            id: id_col,
            name: expect.any(String),
          },
          cards: expect.arrayContaining([
            expect.objectContaining({
              id: expect.stringMatching(/^col_\d+_card_\d+$/),
              name: expect.stringMatching(/.+/),
              type: expect.stringMatching(/.+/),
              rarity: expect.stringMatching(
                /^(COMMON|UNCOMMON|SPECIAL|EPIC|LEGENDARY)$/,
              ),
            }),
          ]),
        }),
      );
    });

    test('Cartas de una Colección inexistente.', async () => {
      const id_card = 'col_' + (13 + id_colection_test).toString();

      const resultado = await CollectionService.getCardsByCollection(id_card);

      expect(resultado).toBeNull();
    });
  });

  afterAll(async () => {
    await prisma.cards.deleteMany({
      where: {
        id_collection: id_colection_test,
      },
    });

    await prisma.collection.deleteMany({
      where: {
        id_collection: id_colection_test,
      },
    });
  });

  afterEach(() => {});
});
