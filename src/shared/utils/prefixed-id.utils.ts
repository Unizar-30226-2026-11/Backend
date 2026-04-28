import { ID_PREFIXES } from '../constants';

export function parsePrefixedCardId(cardId: unknown): number | unknown {
  if (typeof cardId === 'string' && cardId.startsWith(ID_PREFIXES.CARD)) {
    const numericId = parseInt(cardId.replace(ID_PREFIXES.CARD, ''), 10);
    return Number.isNaN(numericId) ? cardId : numericId;
  }

  return cardId;
}

export function parsePrefixedCardIds(cardIds: unknown): unknown {
  if (!Array.isArray(cardIds)) {
    return cardIds;
  }

  return cardIds.map((cardId) => parsePrefixedCardId(cardId));
}
