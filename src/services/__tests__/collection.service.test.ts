import 'dotenv/config';

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

    id_colection_test = colection_test.id_collection;
  });

  beforeEach(() => {});

  test('Obtener todas las colecciones. -> getAllCollections() ', async () => {
    const resultado = await CollectionService.getAllCollections();

    expect(resultado).toBeDefined();
    expect(resultado?.collections).toBeInstanceOf(Array);

    resultado?.collections.forEach((card) => {
      expect(card).toEqual({
        id: expect.stringMatching(/^col_\d+$/),
        name: expect.stringMatching(/.+/),
        description: card.description === null ? null : expect.any(String),
        release_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/), // Formato ISOString
        total_cards: expect.any(Number),
      });
    });
  });

  describe('Obtener coleccion por ID. -> getCollectionById() ', () => {
    test('Colección única (debe devolver objeto directo por lógica de length)', async () => {
      const id_col = 'col_' + id_colection_test;

      // Al pasar solo uno (aunque sea en array de 1), tu lógica de .length devolverá el objeto
      const resultado = await CollectionService.getCollectionById([id_col]);

      expect(resultado).toBeDefined();
      expect(resultado.id).toBe(id_col);
      expect(resultado.name).toBe('Coleccion_Test');
      expect(resultado.totalCards).toBeDefined(); // Verificamos camelCase según tu service
    });

    test('Múltiples colecciones (debe devolver objeto con array por lógica de length)', async () => {
      // Usamos el mismo ID dos veces solo para forzar el length > 1
      const id_col = 'col_' + id_colection_test;
      const resultado = await CollectionService.getCollectionById([id_col, id_col]);

      expect(resultado.collections).toBeDefined();
      expect(resultado.collections).toBeInstanceOf(Array);
      expect(resultado.collections.length).toBeGreaterThan(0);
    });

    test('Colección inexistente.', async () => {
      const id_col = 'col_9999999';

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

      const catalog = Array.isArray(resultado) ? resultado[0] : resultado;
     expect(catalog).toEqual(
        expect.objectContaining({
          collection: expect.objectContaining({ id: id_col }),
          cards: expect.any(Array)
        })
      );

      if (catalog.cards.length > 0) {
        expect(catalog.cards[0]).toEqual({
          id: expect.stringMatching(/^c_\d+$/), 
          name: expect.any(String),
          rarity: expect.stringMatching(/^(COMMON|UNCOMMON|SPECIAL|EPIC|LEGENDARY)$/),
        });
      }
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
