import 'dotenv/config';

import crypto from 'node:crypto';
import path from 'node:path';

import { Board_Type } from '@prisma/client';

import { prisma } from '../infrastructure/prisma';

type StorageFileInfo = {
  storagePath: string;
  filename: string;
};

const BUCKET_NAME = 'game-assets';
const STORAGE_BASE_PATH = 'boards';
const DEFAULT_BOARD_PRICE = 2000;
const AWS_REGION = 'auto';
const AWS_SERVICE = 's3';

const BOARD_METADATA: Record<string, { description: string; price: number }> = {
  [Board_Type.CLASSIC]: {
    description: 'El tablero original de madera y estrellas.',
    price: 0,
  },
  [Board_Type.NEON]: {
    description: 'Un estilo futurista con luces vibrantes y efectos ciberpunk.',
    price: DEFAULT_BOARD_PRICE,
  },
  [Board_Type.STELLAR_GALAXY]: {
    description: 'Viaja a traves del cosmos con este tablero espacial.',
    price: DEFAULT_BOARD_PRICE,
  },
};

function toDisplayName(raw: string): string {
  return raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function sanitizeForStorageKey(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function toBoardName(rawNameWithoutExt: string): string {
  return sanitizeForStorageKey(rawNameWithoutExt)
    .replace(/[-\s]+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toUpperCase();
}

function extractPriceSuffix(rawNameWithoutExt: string): {
  baseName: string;
  priceOverride: number | null;
} {
  const match = rawNameWithoutExt.match(/^(.*?)-([0-9]+)$/);

  if (!match) {
    return {
      baseName: rawNameWithoutExt,
      priceOverride: null,
    };
  }

  const baseName = match[1].trim();
  const parsedPrice = Number.parseInt(match[2], 10);

  if (!baseName || Number.isNaN(parsedPrice)) {
    return {
      baseName: rawNameWithoutExt,
      priceOverride: null,
    };
  }

  return {
    baseName,
    priceOverride: parsedPrice,
  };
}

function getBoardMetadata(boardName: string, rawNameWithoutExt: string) {
  return (
    BOARD_METADATA[boardName] ?? {
      description: `Tablero ${toDisplayName(rawNameWithoutExt)}`,
      price: DEFAULT_BOARD_PRICE,
    }
  );
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodePathPreservingSlashes(value: string): string {
  return value
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

function isSupportedBoardFile(filename: string): boolean {
  const extension = path.extname(filename).toLowerCase();
  return ['.png', '.webp', '.jpg', '.jpeg'].includes(extension);
}

function parseBoardStorageFile(storagePath: string): StorageFileInfo | null {
  const filename = path.basename(storagePath);

  if (!filename || !isSupportedBoardFile(filename)) {
    return null;
  }

  return {
    storagePath,
    filename,
  };
}

async function syncBoardsFromR2() {
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

  console.log(`Leyendo tableros desde R2 en '${STORAGE_BASE_PATH}/'...`);
  const storagePaths = await listR2FilesRecursively(
    endpoint,
    accessKeyId,
    secretAccessKey,
    STORAGE_BASE_PATH,
  );

  const boardFiles = storagePaths
    .map(parseBoardStorageFile)
    .filter((file): file is StorageFileInfo => file !== null)
    .sort((left, right) => left.storagePath.localeCompare(right.storagePath));

  console.log(`Archivos de tablero detectados en R2: ${boardFiles.length}`);

  let createdBoards = 0;
  let updatedBoards = 0;
  let skippedFiles = 0;

  await prisma.$connect();

  for (const boardFile of boardFiles) {
    const rawNameWithoutExt = path.parse(boardFile.filename).name;
    const { baseName, priceOverride } = extractPriceSuffix(rawNameWithoutExt);
    const boardName = toBoardName(baseName);

    if (!boardName) {
      skippedFiles += 1;
      console.warn(`Saltado por nombre invalido: ${boardFile.storagePath}`);
      continue;
    }

    const metadata = getBoardMetadata(boardName, baseName);
    const publicUrl = getPublicUrl(publicDomain, boardFile.storagePath);

    const existingBoard = await prisma.board.findUnique({
      where: { name: boardName },
      select: { id_board: true },
    });

    await prisma.board.upsert({
      where: { name: boardName },
      update: {
        description: metadata.description,
        price: priceOverride ?? metadata.price,
        url_image: publicUrl,
      },
      create: {
        name: boardName,
        description: metadata.description,
        price: priceOverride ?? metadata.price,
        url_image: publicUrl,
      },
    });

    if (existingBoard) {
      updatedBoards += 1;
    } else {
      createdBoards += 1;
    }

    console.log(
      `Sincronizado: ${boardName} | Precio: ${priceOverride ?? metadata.price} | URL: ${publicUrl}`,
    );
  }

  console.log('\nResumen de sincronizacion');
  console.log(`- Tableros nuevos: ${createdBoards}`);
  console.log(`- Tableros actualizados: ${updatedBoards}`);
  console.log(`- Archivos omitidos: ${skippedFiles}`);
}

void syncBoardsFromR2()
  .catch((error) => {
    console.error('Error en sync-boards-r2:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
