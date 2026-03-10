import { Rarity, Friendship_States } from '@prisma/client';
import bcrypt from 'bcrypt';
import { prisma } from "../src/lib/prisma";
//
//  Actualmente con datos de Ejemplo para poder realizar pruebas
//
//

async function main() {

  const SALT_ROUNDS = 10;
  const DEFAULT_PASSWORD = 'password123';     // Contraseña para todos los usuarios de prueba
  const hashedBasePassword = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  console.log('--- Limpiando base de datos ---');
  await prisma.userGameStats.deleteMany();
  await prisma.games_log.deleteMany();
  await prisma.deckCard.deleteMany();
  await prisma.deck.deleteMany();
  await prisma.userCard.deleteMany();
  await prisma.friendships.deleteMany();
  await prisma.cards.deleteMany();
  await prisma.collection.deleteMany();
  await prisma.user.deleteMany();

  console.log('--- Creando Colecciones y Cartas ---');  // 12 Colecciones x 12 Cartas = 144 cartas en total
  
  const rarities: Rarity[] = [
    ...Array(5).fill(Rarity.COMMON),
    ...Array(3).fill(Rarity.UNCOMMON),
    ...Array(2).fill(Rarity.SPECIAL),
    Rarity.EPIC,
    Rarity.LEGENDARY,
  ];

  const allCards = [];
  for (let i = 1; i <= 12; i++) {
    const collection = await prisma.collection.create({
      data: { name: `Colección ${i}` },
    });

    for (let j = 0; j < 12; j++) {
      const card = await prisma.cards.create({
        data: {
          title: `Carta ${i}-${j + 1}`,
          rarity: rarities[j],
          id_collection: collection.id_collection,
        },
      });
      allCards.push(card);
    }
  }

  // Definir las 48 cartas "base" (las de las primeras 4 colecciones)
  const baseCards = allCards.slice(0, 48);

  console.log('--- Creando Usuarios y sus Colecciones ---');
  const users = [];
  for (let i = 1; i <= 15; i++) {
    const user = await prisma.user.create({
      data: {
        username: `Jugador${i}`,
        email: `jugador${i}@ejemplo.com`,
        password: hashedBasePassword,                           
      },
    });
    users.push(user);

    // Asignar las 48 cartas base a cada usuario
    await prisma.userCard.createMany({
      data: baseCards.map((card) => ({
        id_user: user.id_user,
        id_card: card.id_card,
      })),
    });

    // Añadir 5 cartas extra aleatorias (instancias únicas adicionales)
    const extraCards = allCards.slice(48).sort(() => 0.5 - Math.random()).slice(0, 5);
    await prisma.userCard.createMany({
      data: extraCards.map((card) => ({
        id_user: user.id_user,
        id_card: card.id_card,
      })),
    });

    // Crear al menos 1 Mazo de 12 cartas (usando las base)
    const deck = await prisma.deck.create({
      data: {
        name: `Mazo Principal de ${user.username}`,
        id_user: user.id_user,
      },
    });

    const deckSelection = baseCards.slice(0, 12);
    await prisma.deckCard.createMany({
      data: deckSelection.map((card) => ({
        id_deck: deck.id_deck,
        id_user_card: card.id_card,
      })),
    });
  }

  console.log('--- Creando Amistades ---');
  for (let i = 0; i < 10; i++) {
    await prisma.friendships.create({
      data: {
        id_user_1: users[i].id_user,
        id_user_2: users[i + 1].id_user,
        state: Friendship_States.FRIEND
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