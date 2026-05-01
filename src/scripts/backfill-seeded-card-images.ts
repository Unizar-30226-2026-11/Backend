import 'dotenv/config';

import { Rarity } from '@prisma/client';

import { prisma } from '../infrastructure/prisma';

type StorageListEntry = {
  name: string;
  id: string | null;
};

type StorageCardInfo = {
  publicUrl: string;
  rarity: Rarity;
};

const BUCKET_NAME = 'game-assets';
const STORAGE_BASE_PATH = 'cards';
const PLACEHOLDER_URL = 'https://ejemplo.com/placeholder.jpg';
const SEEDED_CARDS_TO_BACKFILL = 168;

const RARITY_TOKENS: Array<{ token: string; rarity: Rarity }> = [
  { token: 'legendary', rarity: Rarity.LEGENDARY },
  { token: 'epic', rarity: Rarity.EPIC },
  { token: 'special', rarity: Rarity.SPECIAL },
  { token: 'uncommon', rarity: Rarity.UNCOMMON },
  { token: 'rare', rarity: Rarity.UNCOMMON },
  { token: 'common', rarity: Rarity.COMMON },
];

function inferRarity(rawNameWithoutExt: string): Rarity {
  const normalized = rawNameWithoutExt.toLowerCase();

  for (const { token, rarity } of RARITY_TOKENS) {
    const pattern = new RegExp(`(?:_|-|\\s)${token}(?:_|-|\\s|$)`, 'i');
    if (pattern.test(normalized)) return rarity;
  }

  return Rarity.COMMON;
}

async function listStorageFilesRecursively(
  currentPath: string,
): Promise<string[]> {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/storage/v1/object/list/${BUCKET_NAME}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prefix: currentPath,
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `No se pudo listar '${currentPath}' en Supabase Storage (${response.status}).`,
    );
  }

  const entries = (await response.json()) as StorageListEntry[];
  const collected: string[] = [];

  for (const entry of entries) {
    const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

    if (entry.id === null) {
      collected.push(...(await listStorageFilesRecursively(entryPath)));
      continue;
    }

    collected.push(entryPath);
  }

  return collected;
}

function getPublicUrl(storagePath: string): string {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}`;
}

function parseStorageCard(storagePath: string): StorageCardInfo | null {
  const segments = storagePath.split('/');
  if (segments.length < 4) return null;

  const [, , , filename] = segments;
  const filenameWithoutExt = filename.replace(/\.[^.]+$/, '');

  return {
    publicUrl: getPublicUrl(storagePath),
    rarity: inferRarity(filenameWithoutExt),
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no esta configurada.');
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorias para el script.',
    );
  }

  console.log('Consultando cartas disponibles en Supabase Storage...');
  const storagePaths = await listStorageFilesRecursively(STORAGE_BASE_PATH);
  const storageCards = storagePaths
    .map(parseStorageCard)
    .filter((card): card is StorageCardInfo => card !== null)
    .sort((a, b) => a.publicUrl.localeCompare(b.publicUrl));

  console.log(`Cartas detectadas en Storage: ${storageCards.length}`);

  const existingRealCards = await prisma.cards.findMany({
    where: { NOT: { url_image: PLACEHOLDER_URL } },
    select: { url_image: true },
  });

  const usedUrls = new Set(existingRealCards.map((card) => card.url_image));
  const availableStorageCards = storageCards.filter(
    (card) => !usedUrls.has(card.publicUrl),
  );

  const placeholderCards = await prisma.cards.findMany({
    where: { url_image: PLACEHOLDER_URL },
    orderBy: { id_card: 'asc' },
    take: SEEDED_CARDS_TO_BACKFILL,
    select: { id_card: true },
  });

  console.log(
    `Cartas placeholder detectadas en DB: ${placeholderCards.length}`,
  );
  console.log(
    `Cartas disponibles para backfill en esta ejecucion: ${availableStorageCards.length}`,
  );

  if (storageCards.length === 0) {
    throw new Error('No hay cartas en el bucket para hacer backfill.');
  }

  if (availableStorageCards.length === 0) {
    console.log('No quedan imagenes nuevas en el bucket para sincronizar.');
    return;
  }

  const cardsToUpdate = Math.min(
    availableStorageCards.length,
    placeholderCards.length,
    SEEDED_CARDS_TO_BACKFILL,
  );

  for (let i = 0; i < cardsToUpdate; i += 1) {
    const dbCard = placeholderCards[i];
    const storageCard = availableStorageCards[i];

    await prisma.cards.update({
      where: { id_card: dbCard.id_card },
      data: {
        rarity: storageCard.rarity,
        url_image: storageCard.publicUrl,
      },
    });
  }

  console.log('\nBackfill completado');
  console.log(`- Cartas actualizadas: ${cardsToUpdate}`);
  console.log('- Cartas insertadas: 0');
  console.log('- Colecciones creadas: 0');

  if (availableStorageCards.length < placeholderCards.length) {
    console.log(
      `- Aviso: han quedado ${placeholderCards.length - availableStorageCards.length} cartas con placeholder porque no hay mas imagenes nuevas disponibles en el bucket.`,
    );
  }

  if (availableStorageCards.length > placeholderCards.length) {
    console.log(
      `- Aviso: se han ignorado ${availableStorageCards.length - placeholderCards.length} imagenes extra porque este script solo rellena las primeras ${SEEDED_CARDS_TO_BACKFILL} cartas del seed.`,
    );
  }
}

void main()
  .catch((error) => {
    console.error('Error en backfill-seeded-card-images:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
