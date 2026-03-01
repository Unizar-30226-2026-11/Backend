// src/constants/validation.ts

/**
 * Solo permite letras, números y guiones bajos.
 * Evita inyecciones básicas y caracteres especiales problemáticos en URLs.
 */
export const ID_SAFE_REGEX = /^[a-zA-Z0-9_]+$/;

/**
 * Opcional: Si IDs siempre tienen una longitud fija (ej: u_ + 10 caracteres)
 */
export const ID_MAX_LENGTH = 30;
export const ID_MIN_LENGTH = 3;
