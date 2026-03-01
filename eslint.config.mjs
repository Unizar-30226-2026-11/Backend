import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier/recommended';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default tseslint.config(
  // Reglas base de ESLint recomendadas
  eslint.configs.recommended,

  // Reglas recomendadas de TypeScript
  ...tseslint.configs.recommended,

  // Nuestra configuración personalizada (Imports y reglas específicas)
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Prettier al final (para que sobreescriba cualquier regla de formato de ESLint)
  prettierPlugin,
);
