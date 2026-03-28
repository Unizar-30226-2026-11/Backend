import { CollectionService } from '../collection.service';
import { prisma } from '../../infrastructure/prisma';
import 'dotenv/config';

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
      const id_col = 'col_1';

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
    await prisma.collection.deleteMany({
      where: {
        id_collection: id_colection_test,
      },
    });
  });

  afterEach(() => {});
});
