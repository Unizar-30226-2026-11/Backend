import { prisma } from '../infrastructure/prisma';

export const UserService = {
  // --- Perfil y Búsqueda ---
  getUserProfile: async (u_id: string) => {
    const id_user = parseInt(u_id.replace('u_', ''));
    const user = await prisma.user.findUnique({
      where: { id_user },
      select: {
        id_user: true,
        username: true,
        email: true,
        exp_level: true,
        progress_level: true,
        state: true,
        personal_state: true,
      },
    });

    if (!user) return null;

    return {
      ...user,
      id: `u_${user.id_user}`,
    };
  },

  searchUsers: async (query: string) => {
    const users = await prisma.user.findMany({
      where: {
        username: { contains: query, mode: 'insensitive' },
      },
      select: {
        id_user: true,
        username: true,
        email: true,
      },
    });

    return users.map((user) => ({
      id: `u_${user.id_user}`,
      username: user.username,
    }));
  },

  // --- Economía e Inventario ---

  getUserEconomy: async (u_id: string) => {
    const id_user = parseInt(u_id.replace('u_', ''));
    const user = await prisma.user.findUnique({
      where: { id_user },
      select: { coins: true },
    });

    if (!user) {
      return null;
    }

    return { balance: user.coins };
  },

  getUserInventory: async (u_id: string) => {
    return { inventory: [] }; // No se a que se refiere esto ahora mismo la verdad, creo que pertenece a redis al ser durante partidas
  },

  getUserCards: async (u_id: string) => {
    const id_user = parseInt(u_id.replace('u_', ''));

    const userCards = await prisma.userCard.findMany({
      where: { id_user },
      include: { card: true }, // Traemos los detalles de la carta
    });

    // Contamos las instancias de cada carta
    const cardCounts: Record<number, { name: string; quantity: number }> = {};

    userCards.forEach((u_card) => {
      if (!cardCounts[u_card.id_card]) {
        cardCounts[u_card.id_card] = { name: u_card.card.title, quantity: 0 };
      }
      cardCounts[u_card.id_card].quantity += 1;
    });

    return Object.entries(cardCounts).map(([cardId, data]) => ({
      cardId: `c_${cardId}`,
      name: data.name,
      quantity: data.quantity,
    }));
  },

  // --- Mazos (Decks) ---

  getUserDecks: async (u_id: string) => {
    const id_user = parseInt(u_id.replace('u_', ''));

    const decks = await prisma.deck.findMany({
      where: { id_user },
      include: {
        cards: {
          include: { user_card: true },
        },
      },
    });

    return decks.map((deck) => ({
      id: `d_${deck.id_deck}`,
      name: deck.name,
      cardIds: deck.cards.map(
        (deck_card) => `c_${deck_card.user_card.id_card}`,
      ),
    })); // Extraemos el id_card genérico a partir del id_user_card
  },

  getDeckById: async (d_id: string) => {
    const id_deck = parseInt(d_id.replace('u_', ''));

    const deck = await prisma.deck.findUnique({
      where: { id_deck },
      include: {
        cards: {
          include: { user_card: true },
        },
      },
    });

    if (!deck) return null;

    return {
      id: `d_${deck.id_deck}`,
      name: deck.name,
      cardIds: deck.cards.map(
        (deck_card) => `c_${deck_card.user_card.id_card}`,
      ),
    }; // Extraemos el id_card genérico a partir del id_user_card
  },

  createDeck: async (u_id: string, name: string, cardsIds: string[]) => {
    const id_user = parseInt(u_id.replace('u_', ''));
    const numericCardsIds = cardsIds.map((c_id) =>
      parseInt(c_id.replace('c_', '')),
    );

    const deckCardsData = await getPhysicalCardsForDeck(
      id_user,
      numericCardsIds,
    );

    const newDeck = await prisma.deck.create({
      data: {
        name: name,
        id_user: id_user,
        cards: {
          create: deckCardsData,
        },
      },
    });

    return {
      id: `d_${newDeck.id_deck}`,
      name: newDeck.name,
      cardIds: cardsIds,
    };
  },

  updateDeck: async (d_id: string, name: string, cardsIds: string[]) => {
    const id_deck = parseInt(d_id.replace('d_', ''));
    const numericCardsIds = cardsIds.map((id) =>
      parseInt(id.replace('c_', '')),
    );

    const existingDeck = await prisma.deck.findUnique({ where: { id_deck } });
    if (!existingDeck) throw new Error('Mazo no encontrado.');

    const deckCardsData = await getPhysicalCardsForDeck(
      existingDeck.id_user,
      numericCardsIds,
    );

    const [_, updatedDeck] = await prisma.$transaction([
      prisma.deckCard.deleteMany({ where: { id_deck } }),
      prisma.deck.update({
        where: { id_deck },
        data: { name: name, cards: { create: deckCardsData } },
      }),
    ]);

    return { id: d_id, name: updatedDeck.name, cardIds: cardsIds };
  },

  deleteDeck: async (d_id: string) => {
    const id_deck = parseInt(d_id.replace('d_', ''));

    await prisma.$transaction([
      prisma.deckCard.deleteMany({
        where: { id_deck },
      }),
      prisma.deck.delete({
        where: { id_deck },
      }),
    ]);

    return true;
  },
};

// Funcion Auxiliar

// Busca todas las instancias que el usuario u_id posee de cada carta c_id
const getPhysicalCardsForDeck = async (
  id_user: number,
  numericCardsIds: number[],
) => {
  const userOwnedCards = await prisma.userCard.findMany({
    where: { id_user, id_card: { in: numericCardsIds } },
  });

  const usedPhysicalCards = new Set<number>();
  const deckCardsData = [];

  for (const targetCardId of numericCardsIds) {
    const physicalCard = userOwnedCards.find(
      (uc) =>
        uc.id_card === targetCardId && !usedPhysicalCards.has(uc.id_user_card),
    );

    if (!physicalCard) {
      throw new Error(
        `No tienes suficientes copias de la carta genérica con ID ${targetCardId}`,
      );
    }

    usedPhysicalCards.add(physicalCard.id_user_card);
    deckCardsData.push({ id_user_card: physicalCard.id_user_card });
  }

  return deckCardsData;
};
