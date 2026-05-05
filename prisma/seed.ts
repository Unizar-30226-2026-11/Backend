import { Friendship_States, Rarity } from '@prisma/client';
import bcrypt from 'bcrypt';

import { prisma } from '../src/infrastructure/prisma';
//
//  Actualmente con datos de Ejemplo para poder realizar pruebas
//
//

async function main() {
  const SALT_ROUNDS = 10;
  const DEFAULT_PASSWORD = 'password123'; // Contraseña para todos los usuarios de prueba
  const hashedBasePassword = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  console.log('--- Limpiando base de datos ---');
  await prisma.purchaseHistoryCard.deleteMany();
  await prisma.purchaseHistory.deleteMany();
  await prisma.userGameStats.deleteMany();
  await prisma.games_log.deleteMany();
  await prisma.deckCard.deleteMany();
  await prisma.deck.deleteMany();
  await prisma.userCard.deleteMany();
  await prisma.userBoard.deleteMany();
  await prisma.friendships.deleteMany();
  await prisma.cards.deleteMany();
  await prisma.collection.deleteMany();
  await prisma.user.deleteMany();
  await prisma.board.deleteMany();


  console.log('--- Creando Tableros (Boards) ---');
  // Creamos el tablero clásico con ID 1 explícitamente para mayor seguridad
  const classicBoard = await prisma.board.create({
    data: {
      name: 'CLASSIC',
      description: 'El tablero original de madera y estrellas.',
      price: 0,
      url_image: "https://midominio.com/boards/classic.png"
    },
  });

  await prisma.board.create({
    data: {
      name: 'NEON',
      description: 'Un estilo futurista con luces vibrantes y efectos ciberpunk.',
      price: 2000,
      url_image: "https://midominio.com/boards/neon.png"
    },
  });

  await prisma.board.create({
    data: {
      name: 'STELLAR_GALAXY',
      description: 'Viaja a través del cosmos con este tablero espacial.',
      price: 2000,
      url_image: "https://midominio.com/boards/stellar.png"
    },
  });

  const allBoards = await prisma.board.findMany({
    orderBy: { id_board: 'asc' },
  });

  console.log('--- Creando Colecciones y Cartas ---'); // 3 Colecciones x 84 Cartas = 252 cartas en total

  const rarities: Rarity[] = [
    ...Array(5).fill(Rarity.COMMON),
    ...Array(3).fill(Rarity.UNCOMMON),
    ...Array(2).fill(Rarity.SPECIAL),
    Rarity.EPIC,
    Rarity.LEGENDARY,
  ];

  const COLLECTION_COUNT = 3;
  const CARDS_PER_COLLECTION = 84;
  const STARTER_DECK_SIZE = 16;

  const allCards = [];
  for (let i = 1; i <= COLLECTION_COUNT; i++) {
    const collection = await prisma.collection.create({
      data: { name: `Colección ${i}` },
    });

    for (let j = 0; j < CARDS_PER_COLLECTION; j++) {
      const card = await prisma.cards.create({
        data: {
          title: `Carta ${i}-${j + 1}`,
          rarity: rarities[j % rarities.length],
          id_collection: collection.id_collection,
          url_image: 'https://ejemplo.com/placeholder.jpg'
        },
      });
      allCards.push(card);
    }
  }

  // Definir las 48 cartas "base" (las de las primeras 4 colecciones) (2 veces para tener 2 instancias al crear mazos)
  const baseCards = allCards.slice(0, 48);

  const doubleCards = [ ... baseCards ,  ... baseCards]

  console.log('--- Creando Usuarios y sus Colecciones ---');
  const users = [];
  for (let i = 1; i <= 15; i++) {
    const user = await prisma.user.create({
      data: {
        username: `Jugador${i}`,
        email: `jugador${i}@ejemplo.com`,
        password: hashedBasePassword,
        coins: 1000,
        active_board_id: classicBoard.id_board,
      },
    });
    users.push(user);

    // Asignar propiedad del tablero clásico (Gratis por registro)
    await prisma.userBoard.create({
      data: {
        id_user: user.id_user,
        id_board: classicBoard.id_board,
      },
    });

    // Asignar las 48 cartas base a cada usuario
    await prisma.userCard.createMany({
      data: doubleCards.map((card) => ({
        id_user: user.id_user,
        id_card: card.id_card,
      })),
    });

    // Añadir 5 cartas extra aleatorias (instancias únicas adicionales)
    const extraCards = allCards
      .slice(48)
      .sort(() => 0.5 - Math.random())
      .slice(0, 5);
    await prisma.userCard.createMany({
      data: extraCards.map((card) => ({
        id_user: user.id_user,
        id_card: card.id_card,
      })),
    });

    const createdUserCards = await prisma.userCard.findMany({
      where: { id_user: user.id_user },
      select: { id_user_card: true },
      take: STARTER_DECK_SIZE, // Solo necesitamos las cartas del mazo inicial
    });

    // Crear al menos 1 mazo inicial
    const deck = await prisma.deck.create({
      data: {
        name: `Mazo Principal de ${user.username}`,
        id_user: user.id_user,
      },
    });

    const deckSelection = createdUserCards.slice(0, STARTER_DECK_SIZE);
    await prisma.deckCard.createMany({
      data: deckSelection.map((card) => ({
        id_deck: deck.id_deck,
        id_user_card: card.id_user_card,
      })),
    });
  }

  const unlockedUser = await prisma.user.create({
    data: {
      username: 'TesterFullUnlock',
      email: 'tester.full.unlock@ejemplo.com',
      password: hashedBasePassword,
      coins: 999999,
      active_board_id: classicBoard.id_board,
    },
  });
  users.push(unlockedUser);

  await prisma.userBoard.createMany({
    data: allBoards.map((board) => ({
      id_user: unlockedUser.id_user,
      id_board: board.id_board,
    })),
  });

  await prisma.userCard.createMany({
    data: allCards.map((card) => ({
      id_user: unlockedUser.id_user,
      id_card: card.id_card,
    })),
  });

  const unlockedUserCards = await prisma.userCard.findMany({
    where: { id_user: unlockedUser.id_user },
    select: { id_user_card: true },
    orderBy: { id_user_card: 'asc' },
    take: STARTER_DECK_SIZE,
  });

  const unlockedDeck = await prisma.deck.create({
    data: {
      name: `Mazo Principal de ${unlockedUser.username}`,
      id_user: unlockedUser.id_user,
    },
  });

  await prisma.deckCard.createMany({
    data: unlockedUserCards.map((card) => ({
      id_deck: unlockedDeck.id_deck,
      id_user_card: card.id_user_card,
    })),
  });

  console.log('--- Creando Amistades ---');
  for (let i = 0; i < 10; i++) {
    await prisma.friendships.create({
      data: {
        id_user_1: users[i].id_user,
        id_user_2: users[i + 1].id_user,
        state: Friendship_States.FRIEND,
      },
    });
  }

  console.log('--- Generando 15 Partidas Multijugador (4-8 jugadores) ---');
  for (let i = 0; i < 15; i++) {
    // Definir duracion aleatoria entre 60 y 115 minutos
    const duration = Math.floor(Math.random() * 60) + 45;

    // Crear la partida
    const game = await prisma.games_log.create({
      data: {
        duration: duration,
        beggining_date: new Date(Date.now() - Math.random() * 1000000000),
      },
    });

    // Seleccionar entre 4 y 8 jugadores aleatorios de los 15 creados
    const numParticipants = Math.floor(Math.random() * 5) + 4; // 4 a 8
    const shuffledUsers = [...users].sort(() => 0.5 - Math.random());
    const participants = shuffledUsers.slice(0, numParticipants);

    // Crear las estadísticas para cada participante
    // El puesto (place) se asigna del 1 al numParticipants
    for (let j = 0; j < participants.length; j++) {
      await prisma.userGameStats.create({
        data: {
          id_game: game.id_game,
          id_user: participants[j].id_user,
          place: j + 1, // El primero en la lista queda 1º, etc.
          points: (numParticipants - j) * 25 + Math.floor(Math.random() * 25),
        },
      });
    }
  }

  console.log('--- Seed completado con éxito ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
