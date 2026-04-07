import 'dotenv/config';
import { prisma } from '../../infrastructure/prisma';
import { ShopService } from '../../services/shop.service';
import { ShopRedisRepository } from '../../repositories/shop.repository';
import { Board_Type } from '@prisma/client';

describe('ShopService - Sistema de ', () => {

    let id_usuario_rico: number;
    let id_usuario_pobre: number;
    let test_card_id: number;
    let test_collection_id: number;
    let cards_of_collection: number[] = [];

    beforeAll(async () => {

        // Limpieza de usuarios de pruebas anteriores para evitar colisiones
        const ghostUsers = await prisma.user.findMany({
        where: { username: { in: ['ShopTester_Rico', 'ShopTester_Pobre'] } },
        });
        
        for (const ghost of ghostUsers) {
        await prisma.purchaseHistory.deleteMany({ where: { id_user: ghost.id_user } });
        await prisma.userCard.deleteMany({ where: { id_user: ghost.id_user } });
        await prisma.user.delete({ where: { id_user: ghost.id_user } });
        }

        // Crear sujetos de prueba
        const rico = await prisma.user.create({
        data: {
            username: 'ShopTester_Rico',
            email: 'rico@test.com',
            password: 'password123',
            coins: 10000,
        },
        });
        id_usuario_rico = rico.id_user;

        const pobre = await prisma.user.create({
        data: {
            username: 'ShopTester_Pobre',
            email: 'pobre@test.com',
            password: 'password123',
            coins: 10,
        },
        });
        id_usuario_pobre = pobre.id_user;

        // Obtener datos reales de la BD (creados por el seed) para las pruebas
        const card = await prisma.cards.findFirst();
        const coll = await prisma.collection.findFirst();
        
        if (!card || !coll) throw new Error("La base de datos debe estar poblada (seed) antes de los tests.");
        
        test_card_id = card.id_card;
        test_collection_id = coll.id_collection;
    });

    afterAll(async () => {
        const ids = [id_usuario_rico, id_usuario_pobre];
        await prisma.purchaseHistory.deleteMany({ where: { id_user: { in: ids } } });
        await prisma.userCard.deleteMany({ where: { id_user: { in: ids } } });
        await prisma.user.deleteMany({ where: { id_user: { in: ids } } });
        
        // Limpiar rastro en Redis
        await ShopRedisRepository.deleteDailyShop(id_usuario_rico);
        await ShopRedisRepository.deleteDailyShop(id_usuario_pobre);
    });

    describe('Obtención de Tienda -> getAvailableItems()', () => {
        test('Debe generar una tienda válida con el formato correcto', async () => {
            const shop = await ShopService.getAvailableItems(id_usuario_rico);

            expect(shop).toBeDefined();
            expect(shop.singleCards).toHaveLength(3);
            expect(shop.cardPackOffer).toBeDefined();
            expect(shop.boardOffer).not.toBeNull();
            expect(shop.boardOffer).toEqual(expect.objectContaining({
                name: expect.any(String),
                price: expect.any(Number)
            }));
            expect(new Date(shop.expiresAt).getTime()).toBeGreaterThan(Date.now());
        });

        test('Debe recuperar la tienda de Redis si ya existe (Caché)', async () => {
            // Forzamos guardado
            const firstCall = await ShopService.getAvailableItems(id_usuario_pobre);
            
            // Espiamos a Prisma: no debería llamarse a cards.findMany en la segunda vuelta
            const prismaSpy = jest.spyOn(prisma.cards, 'findMany');
            
            // Segunda llamada: debería obtener los datos de Redis sin consultar la BD
            const secondCall = await ShopService.getAvailableItems(id_usuario_pobre);
            
            expect(secondCall).toEqual(firstCall);
            expect(prismaSpy).not.toHaveBeenCalled();
            
            prismaSpy.mockRestore();
        });

        test('No debe ofrecer un tablero que el usuario ya posee', async () => {
            // Obtenemos la tienda actual y guardamos el nombre del tablero ofertado
            const shopOriginal = await ShopService.getAvailableItems(id_usuario_rico);
            const tableroOfertado = shopOriginal.boardOffer!.name;

            // Simulamos que el usuario ya lo posee añadiéndolo a su perfil en la BD
            await prisma.user.update({
                where: { id_user: id_usuario_rico },
                data: { 
                tableros: { 
                    push: tableroOfertado as Board_Type 
                } 
                }
            });

            // Borramos la caché de Redis para obligar al servicio a generar una tienda nueva 
            await ShopRedisRepository.deleteDailyShop(id_usuario_rico);
            
            const nuevaShop = await ShopService.getAvailableItems(id_usuario_rico);

            if (nuevaShop.boardOffer) {
                // Si hay un nuevo tablero, no debe ser el que acabamos de "comprar"
                expect(nuevaShop.boardOffer.name).not.toBe(tableroOfertado);
            } else {
                // Si es null, es correcto (significa que no quedan más tableros disponibles en el diccionario)
                expect(nuevaShop.boardOffer).toBeNull();
            }
        });

        test('No debe ofrecer una colección que el usuario ya tiene completa', async () => {
            // Forzamos que el usuario tenga TODAS las cartas de la colección de prueba
            await prisma.userCard.createMany({
                data: cards_of_collection.map(cardId => ({
                id_user: id_usuario_rico,
                id_card: cardId
                }))
            });

            // Borramos caché para obligar a regenerar la tienda
            await ShopRedisRepository.deleteDailyShop(id_usuario_rico);
            
            const shop = await ShopService.getAvailableItems(id_usuario_rico);

            if (shop.collectionOffer) {
                // Si hay una oferta, el ID no puede ser el de la colección que acabamos de completar
                expect(shop.collectionOffer.id_collection).not.toBe(test_collection_id);
            } else {
                // Si es null, también es correcto (no quedan más colecciones incompletas para este usuario)
                expect(shop.collectionOffer).toBeNull();
            }
        });
    });

    describe('Proceso de Compra -> processPurchase()', () => {
        
        describe('Flujos de Éxito', () => {
            test('Compra de carta individual exitosa', async () => {
                const res = await ShopService.processPurchase(id_usuario_rico, `card_${test_card_id}`);
                
                expect(res.itemName).toContain('Carta');
                expect(res.updatedEconomy.coins).toBeLessThan(10000);
                
                // Verificar persistencia
                const check = await prisma.userCard.findFirst({
                where: { id_user: id_usuario_rico, id_card: test_card_id }
                });
                expect(check).toBeDefined();
            });

            test('Compra de tablero exitosa', async () => {
                await prisma.user.update({
                    where: { id_user: id_usuario_rico },
                    data: { tableros: [] } // Vaciamos su array de tableros
                });

                const res = await ShopService.processPurchase(id_usuario_rico, 'board_NEON');
                
                expect(res.itemName).toBe('Tablero NEON');
                expect(res.updatedEconomy.coins).toBeLessThan(10000);

                const user = await prisma.user.findUnique({ where: { id_user: id_usuario_rico } });
                expect(user?.tableros).toContain('NEON');
            });
        });

        describe('Validaciones y Errores', () => {
            test('Error 403: Fondos insuficientes', async () => {
                try {
                await ShopService.processPurchase(id_usuario_pobre, `card_${test_card_id}`);
                fail('Debería haber lanzado un error');
                } catch (error: any) {
                expect(error.status).toBe(403);
                expect(error.message).toBe('Fondos insuficientes.');
                expect(error).toHaveProperty('required');
                }
            });

            test('Error 400: Artículo ya poseído (Carta)', async () => {
                // El rico ya tiene la test_card_id del test anterior
                try {
                await ShopService.processPurchase(id_usuario_rico, `card_${test_card_id}`);
                fail('Debería haber lanzado un error');
                } catch (error: any) {
                expect(error.status).toBe(400);
                expect(error.message).toBe('Ya posees esta carta en tu colección.');
                }
            });

            test('Error 404: Artículo no encontrado', async () => {
                try {
                await ShopService.processPurchase(id_usuario_rico, 'card_999999');
                fail('Debería haber lanzado un error');
                } catch (error: any) {
                expect(error.status).toBe(404);
                }
            });
        });
    });

    describe('Historial de Compras -> getPurchaseHistory()', () => {
        test('Debe listar las compras realizadas por el usuario', async () => {
            const history = await ShopService.getPurchaseHistory(id_usuario_rico, 0);
            
            // El rico ha comprado 1 carta y 1 tablero con éxito arriba
            expect(history.length).toBeGreaterThanOrEqual(2);
            expect(history[0]).toEqual(expect.objectContaining({
                id_user: id_usuario_rico,
                coins_spent: expect.any(Number)
            }));
        });
    });
});