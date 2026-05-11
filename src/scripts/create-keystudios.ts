import 'dotenv/config';

import bcrypt from 'bcrypt';

import { prisma } from '../infrastructure/prisma';
import { AuthService } from '../services';

const USERNAME = 'Keystudios';
const EMAIL = 'contact@keystudios.app';
const PASSWORD = 'megustaEmbutidosTripleB';
const STARTING_COINS = 999999999;
const DISCONNECT_TIMEOUT_MS = 1500;

function isMissingRelationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return message.includes('cannot find') || message.includes('does not exist');
}

async function createUserWithWallet(): Promise<number> {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: EMAIL }, { username: USERNAME }],
    },
    select: { id_user: true },
  });

  if (existingUser) {
    // El saltrounds es 10, pero podría fallar si no pone eso en el hash de los servicios.
    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    await prisma.user.update({
      where: { id_user: existingUser.id_user },
      data: {
        username: USERNAME,
        email: EMAIL,
        password: passwordHash,
        coins: STARTING_COINS,
        state: 'DISCONNECTED',
      },
    });

    console.log(`El usuario ${USERNAME} ya existe. Se actualiza el registro.`);
    return existingUser.id_user;
  }

  const createdUser = await AuthService.registerUser(EMAIL, USERNAME, PASSWORD);

  const createdUserRecord = await prisma.user.findUnique({
    where: { email: createdUser.email },
    select: { id_user: true },
  });

  if (!createdUserRecord) {
    throw new Error('No se pudo recuperar el usuario recién creado.');
  }

  await prisma.user.update({
    where: { id_user: createdUserRecord.id_user },
    data: { coins: STARTING_COINS },
  });

  return createdUserRecord.id_user;
}

async function grantAllBoards(userId: number): Promise<number> {
  const boards = await prisma.board.findMany({
    select: { id_board: true },
  });

  let inserted = 0;

  for (const board of boards) {
    await prisma.userBoard.upsert({
      where: {
        id_user_id_board: {
          id_user: userId,
          id_board: board.id_board,
        },
      },
      update: {},
      create: {
        id_user: userId,
        id_board: board.id_board,
      },
    });

    inserted += 1;
  }

  const activeBoard = boards[0]?.id_board ?? null;

  if (activeBoard !== null) {
    await prisma.user.update({
      where: { id_user: userId },
      data: { active_board_id: activeBoard },
    });
  }

  return inserted;
}

async function grantAllCards(userId: number): Promise<number> {
  const existingUserCards = await prisma.userCard.findMany({
    where: { id_user: userId },
    select: { id_user_card: true },
  });

  if (existingUserCards.length > 0) {
    await prisma.deckCard.deleteMany({
      where: {
        id_user_card: {
          in: existingUserCards.map((userCard) => userCard.id_user_card),
        },
      },
    });

    await prisma.userCard.deleteMany({
      where: { id_user: userId },
    });
  }

  const cards = await prisma.cards.findMany({
    select: { id_card: true },
  });

  let inserted = 0;

  for (const card of cards) {
    await prisma.userCard.create({
      data: {
        id_user: userId,
        id_card: card.id_card,
      },
    });

    inserted += 1;
  }

  const decks = await prisma.deck.findMany({
    where: { id_user: userId },
    select: { id_deck: true },
  });

  if (decks.length === 0 && cards.length > 0) {
    const deck = await prisma.deck.create({
      data: {
        id_user: userId,
        name: 'Completa',
      },
      select: { id_deck: true },
    });

    for (const card of cards) {
      const userCard = await prisma.userCard.findFirst({
        where: { id_user: userId, id_card: card.id_card },
        select: { id_user_card: true },
      });

      if (!userCard) {
        continue;
      }

      await prisma.deckCard.create({
        data: {
          id_deck: deck.id_deck,
          id_user_card: userCard.id_user_card,
        },
      });
    }
  }

  return inserted;
}

async function main() {
  await prisma.$connect();

  try {
    const userId = await createUserWithWallet();

    const [boardCount, cardCount] = await Promise.all([
      grantAllBoards(userId),
      grantAllCards(userId),
    ]);

    console.log('Usuario preparado correctamente:');
    console.log(`- Username: ${USERNAME}`);
    console.log(`- Email: ${EMAIL}`);
    console.log(`- Monedas: ${STARTING_COINS}`);
    console.log(`- Tableros asignados: ${boardCount}`);
    console.log(`- Cartas asignadas: ${cardCount}`);
  } catch (error) {
    if (isMissingRelationError(error)) {
      console.error(
        'No se pudo completar el alta porque falta alguna relación o registro base en la base de datos.',
      );
    }

    throw error;
  } finally {
    const disconnectPromise = prisma.$disconnect();
    await Promise.race([
      disconnectPromise,
      new Promise<void>((resolve) => {
        setTimeout(resolve, DISCONNECT_TIMEOUT_MS);
      }),
    ]);

    process.exit(0);
  }
}

void main().catch((error) => {
  console.error('Error en create-keystudios:', error);
  process.exitCode = 1;
});
