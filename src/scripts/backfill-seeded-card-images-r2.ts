import 'dotenv/config';

import crypto from 'node:crypto';

import { Rarity } from '@prisma/client';

import { prisma } from '../infrastructure/prisma';

type StorageCardInfo = {
  publicUrl: string;
  rarity: Rarity;
};

const BUCKET_NAME = 'game-assets';
const STORAGE_BASE_PATH = 'cards';
const PLACEHOLDER_URL = 'https://ejemplo.com/placeholder.jpg';
const SEEDED_CARDS_TO_BACKFILL = 168;
const AWS_REGION = 'auto';
const AWS_SERVICE = 's3';

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

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodePathPreservingSlashes(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeRfc3986(segment))
    .join('/');
}

function createSha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createHmac(key: Buffer | string, value: string): Buffer {
  return crypto.createHmac('sha256', key).update(value).digest();
}

function buildCanonicalQueryString(query: Record<string, string>): string {
  return Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`,
    )
    .join('&');
}

function buildSignedHeaders(host: string, amzDate: string) {
  return {
    host,
    'x-amz-content-sha256': createSha256Hex(''),
    'x-amz-date': amzDate,
  };
}

function signRequest(
  method: string,
  url: URL,
  query: Record<string, string>,
  accessKeyId: string,
  secretAccessKey: string,
) {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const canonicalUri = encodePathPreservingSlashes(url.pathname);
  const canonicalQueryString = buildCanonicalQueryString(query);
  const signedHeadersRecord = buildSignedHeaders(url.host, amzDate);
  const signedHeaders = Object.keys(signedHeadersRecord).sort().join(';');
  const canonicalHeaders = Object.entries(signedHeadersRecord)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}\n`)
    .join('');

  const payloadHash = signedHeadersRecord['x-amz-content-sha256'];
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${AWS_REGION}/${AWS_SERVICE}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    createSha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = createHmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = createHmac(kDate, AWS_REGION);
  const kService = createHmac(kRegion, AWS_SERVICE);
  const kSigning = createHmac(kService, 'aws4_request');
  const signature = crypto
    .createHmac('sha256', kSigning)
    .update(stringToSign)
    .digest('hex');

  return {
    headers: {
      ...signedHeadersRecord,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    queryString: canonicalQueryString,
  };
}

function getXmlTagValue(xml: string, tagName: string): string | null {
  const match = xml.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`));
  return match?.[1] ?? null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractObjectKeys(xml: string): string[] {
  const matches = xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g);
  return Array.from(matches, (match) => decodeXmlEntities(match[1]));
}

async function listR2FilesRecursively(
  endpoint: string,
  accessKeyId: string,
  secretAccessKey: string,
  currentPath: string,
): Promise<string[]> {
  const normalizedEndpoint = endpoint.replace(/\/+$/, '');
  let continuationToken: string | null = null;
  const collected: string[] = [];

  do {
    const url = new URL(`${normalizedEndpoint}/${BUCKET_NAME}`);
    const query: Record<string, string> = {
      'list-type': '2',
      'max-keys': '1000',
      prefix: currentPath,
    };

    if (continuationToken) {
      query['continuation-token'] = continuationToken;
    }

    const signedRequest = signRequest(
      'GET',
      url,
      query,
      accessKeyId,
      secretAccessKey,
    );

    const response = await fetch(`${url.toString()}?${signedRequest.queryString}`, {
      method: 'GET',
      headers: signedRequest.headers,
    });

    if (!response.ok) {
      throw new Error(
        `No se pudo listar '${currentPath}' en Cloudflare R2 (${response.status}).`,
      );
    }

    const responseXml = await response.text();
    collected.push(...extractObjectKeys(responseXml));

    const isTruncated = getXmlTagValue(responseXml, 'IsTruncated') === 'true';
    continuationToken = isTruncated
      ? decodeXmlEntities(
          getXmlTagValue(responseXml, 'NextContinuationToken') ?? '',
        )
      : null;
  } while (continuationToken);

  return collected;
}

function getPublicUrl(publicDomain: string, storagePath: string): string {
  const normalizedDomain = publicDomain.replace(/\/+$/, '');
  const encodedPath = encodePathPreservingSlashes(storagePath);
  return `${normalizedDomain}/${encodedPath}`;
}

function parseStorageCard(
  publicDomain: string,
  storagePath: string,
): StorageCardInfo | null {
  const segments = storagePath.split('/');
  const filename = segments[segments.length - 1];
  if (!filename) return null;
  const filenameWithoutExt = filename.replace(/\.[^.]+$/, '');

  return {
    publicUrl: getPublicUrl(publicDomain, storagePath),
    rarity: inferRarity(filenameWithoutExt),
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no esta configurada.');
  }

  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
  const accessKeyId = process.env.ACCOUNT_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_SECRET_KEY;
  const publicDomain = process.env.R2_PUBLIC_DOMAIN;

  if (!endpoint || !accessKeyId || !secretAccessKey || !publicDomain) {
    throw new Error(
      'CLOUDFLARE_R2_ENDPOINT, ACCOUNT_KEY_ID, CLOUDFLARE_SECRET_KEY y R2_PUBLIC_DOMAIN son obligatorias para el script.',
    );
  }

  console.log('Consultando cartas disponibles en Cloudflare R2...');
  const storagePaths = await listR2FilesRecursively(
    endpoint,
    accessKeyId,
    secretAccessKey,
    STORAGE_BASE_PATH,
  );
  const storageCards = storagePaths
    .map((storagePath) => parseStorageCard(publicDomain, storagePath))
    .filter((card): card is StorageCardInfo => card !== null)
    .sort((a, b) => a.publicUrl.localeCompare(b.publicUrl));

  console.log(`Cartas detectadas en R2: ${storageCards.length}`);

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
    console.error('Error en backfill-seeded-card-images-r2:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
