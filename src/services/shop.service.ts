// src/services/shop.service.ts
import { prisma } from '../infrastructure/prisma';
import { Purchase_Type, Board_Type } from '@prisma/client'; 
import { ShopRedisRepository } from '../repositories/shop.repository';
import { DailyShopState } from '../infrastructure/redis/shop.schema';

// ==========================================
// DICCIONARIOS DE PRECIOS
// ==========================================

const RARITY_PRICES = {
  COMMON: 100,
  UNCOMMON: 300,
  SPECIAL: 800,
  EPIC: 1500,
  LEGENDARY: 3000,
};

const BOARD_PRICES: Record<Board_Type, number> = {
  CLASSIC: 0,
  NEON: 1200,
  STELLAR_GALAXY: 1500,
};

/**
 * Redondea los precios para que terminen siempre en 0 o 5 (Economía limpia)
 */
const calculateCleanPrice = (basePrice: number, multiplier: number): number => {
  const rawPrice = basePrice * multiplier;
  return Math.floor(rawPrice / 5) * 5;
};

// ==========================================
// SERVICIO DE TIENDA
// ==========================================

class ShopServiceClass {

  /**
   * Obtiene la tienda diaria privada de un usuario.
   * Utiliza Redis para cachear la tienda durante 24 horas.
   */
  public async getAvailableItems(userId: number): Promise<DailyShopState> {

    // Preguntamos al Repositorio si ya existe la tienda generada hoy
    const cachedShop = await ShopRedisRepository.getDailyShop(userId);
    if (cachedShop) return cachedShop;

    // Cálculo de reinicio del servidor
    const now = new Date();
    // Creamos una fecha que apunte exactamente a las 00:00:00 del día siguiente (en horario universal UTC)
    const nextMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    
    // Calculamos los segundos exactos que faltan para llegar a esa medianoche
    const secondsUntilMidnight = Math.floor((nextMidnight.getTime() - now.getTime()) / 1000);

    // Obtener las cartas y tableros que el usuario ya posee
    const userInventory = await prisma.user.findUnique({
      where: { id_user: userId },
      include: { 
        my_cards: { select: { id_card: true } }
      }
    });

    const ownedCardIds = new Set(userInventory?.my_cards.map(c => c.id_card) || []);
    const ownedBoards = userInventory?.tableros || [];

    // Filtrar cartas que NO tenga para las ofertas individuales
    const allCards = await prisma.cards.findMany();
    const availableForSingles = allCards.filter(c => !ownedCardIds.has(c.id_card));
    const singles = availableForSingles.sort(() => 0.5 - Math.random()).slice(0, 3);

    // Filtrar colecciones que no tenga COMPLETAS
    const allColls = await prisma.collection.findMany({ include: { cards: true } });
    const availableColls = allColls.filter(coll => 
      coll.cards.some(card => !ownedCardIds.has(card.id_card))
    );
    const randomColl = availableColls.length > 0 ? availableColls[Math.floor(Math.random() * availableColls.length)] : null;

    // Tablero que no tenga
    const availableBoards = (Object.keys(BOARD_PRICES) as Board_Type[]).filter(b => !ownedBoards.includes(b));
    const boardName = availableBoards.length > 0 ? availableBoards[Math.floor(Math.random() * availableBoards.length)] : null;
    
    const pack = availableForSingles.sort(() => 0.5 - Math.random()).slice(0,5);

    const state: DailyShopState = {
      singleCards: singles.map(c => ({ id_card: c.id_card, title: c.title, rarity: c.rarity, price: RARITY_PRICES[c.rarity] })),
      cardPackOffer: {
        name: "Sobre Diario",
        card_ids: pack.map(c => c.id_card),
        description: "5 cartas con 25% de descuento",
        price: calculateCleanPrice(pack.reduce((sum, c) => sum + RARITY_PRICES[c.rarity], 0), 0.75)
      },
      collectionOffer: randomColl ? {
        id_collection: randomColl.id_collection,
        name: randomColl.name,
        price: calculateCleanPrice(randomColl.cards.reduce((sum, c) => sum + RARITY_PRICES[c.rarity], 0), 0.80)
      } : null,
      boardOffer: boardName ? { name: boardName, price: BOARD_PRICES[boardName] } : null,
      expiresAt: nextMidnight.toISOString()
    };

    await ShopRedisRepository.saveDailyShop(userId, state, secondsUntilMidnight);
    return state;
  }

  /**
   * Procesa la compra de forma segura mediante Transacción.
   * Recibe un string `itemId` que debe tener formato: "card_5", "board_NEON_CYBERPUNK", "collection_2" o "pack_daily"
   */
  public async processPurchase(rawUserId: string | number, itemId: string) {

    const userId = Number(rawUserId);

    return await prisma.$transaction(async (tx) => {

      let totalCost = 0;
      let cardsToAdd: number[] = [];
      let purchaseType: Purchase_Type;
      let referenceIds: number[] = [];
      let referenceName: string | undefined = undefined;
      let itemNameForResponse = ''; // Para devolverlo en el success al controlador

      // --- VALIDACIÓN DE PROPIEDAD SEGÚN TIPO ---
      if (itemId.startsWith('board_')) {
        purchaseType = 'BOARD';
        referenceName = itemId.replace('board_', '');
        if (!BOARD_PRICES[referenceName as Board_Type]) throw { status: 404, message: 'Tablero inválido.' };
        
        totalCost = BOARD_PRICES[referenceName as Board_Type];
        itemNameForResponse = `Tablero ${referenceName}`;

        const userCheck = await tx.user.findUnique({ where: { id_user: userId }, select: { tableros: true } });
        if (userCheck?.tableros.includes(referenceName as Board_Type)) {
          throw { status: 400, message: 'Ya posees este tablero.' }; 
        }

      } else if (itemId.startsWith('card_')) {
        purchaseType = 'SINGLE_CARD';
        const cardId = parseInt(itemId.replace('card_', ''));

        const alreadyOwned = await tx.userCard.findFirst({ where: { id_user: userId, id_card: cardId } });
        if (alreadyOwned) throw { status: 400, message: 'Ya posees esta carta en tu colección.' };

        const card = await tx.cards.findUnique({ where: { id_card: cardId } });
        if (!card) throw { status: 404, message: 'Carta no encontrada.' };
        
        totalCost = RARITY_PRICES[card.rarity];
        cardsToAdd.push(card.id_card);
        referenceIds.push(card.id_card);
        itemNameForResponse = `Carta: ${card.title}`;

      } else if (itemId.startsWith('collection_')) {
        purchaseType = 'COLLECTION';
        const collId = parseInt(itemId.replace('collection_', ''));

        const collection = await tx.collection.findUnique({
          where: { id_collection: collId }, include: { cards: true } 
        });
        if (!collection) throw { status: 404, message: 'Colección no encontrada.' };
        
        const ownedInColl = await tx.userCard.findMany({
          where: { id_user: userId, id_card: { in: collection.cards.map(c => c.id_card) } }
        });
        if (ownedInColl.length === collection.cards.length) {
          throw { status: 400, message: 'Ya posees todas las cartas de esta colección.' };
        }

        totalCost = calculateCleanPrice(collection.cards.reduce((sum, c) => sum + RARITY_PRICES[c.rarity], 0), 0.80);
        cardsToAdd = collection.cards.map(c => c.id_card);
        referenceIds.push(collection.id_collection);
        itemNameForResponse = `Colección: ${collection.name}`;

      } else if (itemId === 'pack_daily') {
        purchaseType = 'CARD_PACK';
        // Leemos Redis para saber qué cartas traía el pack de hoy
        const dailyShop = await ShopRedisRepository.getDailyShop(userId);
        if (!dailyShop || !dailyShop.cardPackOffer) throw { status: 404, message: 'Oferta no encontrada' };
  
        totalCost = dailyShop.cardPackOffer.price;
        cardsToAdd = dailyShop.cardPackOffer.card_ids;
        referenceIds = cardsToAdd;
        itemNameForResponse = dailyShop.cardPackOffer.name;

      } else {
        throw { status: 400, message: 'Formato de artículo desconocido.' };
      }

      // --- PROCESO DE PAGO ---
      const user = await tx.user.findUnique({ where: { id_user: userId }, select: { coins: true } });
      if (!user) throw { status: 404, message: 'Usuario no encontrado.' };
      
      if (user.coins < totalCost) {
        throw { 
          status: 403, 
          message: 'Fondos insuficientes.',
          required: totalCost,
          currentBalance: user.coins
        };
      }

      await tx.user.update({
        where: { id_user: userId },
        data: { 
          coins: { decrement: totalCost },
          ...(purchaseType === 'BOARD' && { tableros: { push: referenceName as Board_Type } })
        }
      });

      if (cardsToAdd.length > 0) {
        await tx.userCard.createMany({ data: cardsToAdd.map(id => ({ id_user: userId, id_card: id })) });
      }

      await tx.purchaseHistory.create({
        data: { id_user: userId, purchase_type: purchaseType, reference_ids: referenceIds, reference_name: referenceName || null, coins_spent: totalCost }
      });

      const updatedUser = await tx.user.findUnique({ where: { id_user: userId }, select: { coins: true } });
      return { itemName: itemNameForResponse, updatedEconomy: { userId, coins: updatedUser?.coins } };

    });
  }

  /**
   * Obtiene el historial de compras del usuario.
   * @param amount Cantidad de registros a devolver (Por defecto 25. Pasa 0 para obtener TODOS).
   */
  public async getPurchaseHistory(userId: number, amount: number = 25) {
    return await prisma.purchaseHistory.findMany({
      where: { id_user: userId },
      orderBy: { purchased_at: 'desc' },
      take: amount === 0 ? undefined : amount
    });
  }
}

export const ShopService = new ShopServiceClass();