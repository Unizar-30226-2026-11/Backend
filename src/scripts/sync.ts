import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { stdin as input, stdout as output } from 'process';
import readline from 'readline/promises';

type SyncExecutionPlan = {
  scriptPath: string;
  args: string[];
};

function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase();
}

function isYes(value: string): boolean {
  const answer = normalizeAnswer(value);
  return (
    answer === 's' ||
    answer === 'si' ||
    answer === 'sí' ||
    answer === 'y' ||
    answer === 'yes'
  );
}

function scriptLabel(scriptPath: string): string {
  const baseName = path.basename(scriptPath, path.extname(scriptPath));
  return baseName.replace(/^sync-/, '');
}

function normalizeCliPathArg(arg: string): string {
  const trimmed = arg.trim();

  if (trimmed === '~') {
    return os.homedir();
  }

  if (trimmed.startsWith('~/')) {
    return path.join(os.homedir(), trimmed.slice(2));
  }

  return trimmed;
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env,
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Comando fallido: ${command} ${args.join(' ')}`));
    });
  });
}

async function listSyncScripts(): Promise<string[]> {
  const scriptsDir = __dirname;
  const currentBasename = path.basename(__filename);
  const currentExtension = path.extname(__filename);
  const targetExtension = currentExtension === '.ts' ? '.ts' : '.js';

  const entries = await fs.readdir(scriptsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name !== currentBasename)
    .filter((name) => name.startsWith('sync-'))
    .filter((name) => name.endsWith(targetExtension))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => path.join(scriptsDir, name));
}

async function buildInteractivePlan(
  targetScripts: string[],
): Promise<SyncExecutionPlan[]> {
  const plan: SyncExecutionPlan[] = [];
  const rl = readline.createInterface({ input, output });

  console.log('\nModo interactivo de sincronizacion por script.');
  console.log(
    'Puedes definir ruta distinta para cada sync-* o dejar vacio para usar la ruta por defecto.',
  );

  try {
    for (const scriptPath of targetScripts) {
      const label = scriptLabel(scriptPath);
      console.log(`\nConfigurando sync-${label}:`);

      const shouldRunAnswer = await rl.question(
        `- Ejecutar sync-${label}? (s/N): `,
      );

      if (!isYes(shouldRunAnswer)) {
        console.log(`  Saltado sync-${label}.`);
        continue;
      }

      const folderAnswer = await rl.question(
        '- Ruta de carpeta (Enter para usar la predeterminada del script): ',
      );

      const cleanupAnswer = await rl.question(
        '- Activar cleanup para este script? (s/N): ',
      );

      const args: string[] = [];
      const trimmedFolder = folderAnswer.trim();

      if (trimmedFolder.length > 0) {
        args.push(normalizeCliPathArg(trimmedFolder));
      }

      if (isYes(cleanupAnswer)) {
        args.push('--cleanup');
      }

      plan.push({ scriptPath, args });
    }
  } finally {
    rl.close();
  }

  return plan;
}

function buildNonInteractivePlan(
  targetScripts: string[],
  forwardedArgs: string[],
): SyncExecutionPlan[] {
  const normalizedArgs = forwardedArgs.map((arg) => normalizeCliPathArg(arg));

  return targetScripts.map((scriptPath) => ({
    scriptPath,
    args: normalizedArgs,
  }));
}

async function runAllSyncScripts() {
  const targetScripts = await listSyncScripts();

  if (targetScripts.length === 0) {
    console.log('No se encontraron scripts sync-* para ejecutar.');
    return;
  }

  console.log(`Scripts detectados: ${targetScripts.length}`);

  const forwardedArgs = process.argv.slice(2);
  const isTsRuntime = path.extname(__filename) === '.ts';
  const forceInteractive = forwardedArgs.includes('--interactive');
  const forceNonInteractive = forwardedArgs.includes('--no-interactive');
  const forwardedArgsClean = forwardedArgs.filter(
    (arg) => arg !== '--interactive' && arg !== '--no-interactive',
  );

  if (forceInteractive && forceNonInteractive) {
    throw new Error(
      'No puedes usar --interactive y --no-interactive a la vez.',
    );
  }

  const interactiveEnabled = forceInteractive
    ? true
    : forceNonInteractive
      ? false
      : Boolean(input.isTTY && output.isTTY);

  const executionPlan = interactiveEnabled
    ? await buildInteractivePlan(targetScripts)
    : buildNonInteractivePlan(targetScripts, forwardedArgsClean);

  if (executionPlan.length === 0) {
    console.log('No hay scripts seleccionados para ejecutar.');
    return;
  }

  for (const item of executionPlan) {
    const scriptName = path.basename(item.scriptPath);
    console.log(`\nEjecutando ${scriptName}...`);

    if (isTsRuntime) {
      await runCommand('ts-node-dev', [
        '--transpile-only',
        item.scriptPath,
        ...item.args,
      ]);
    } else {
      await runCommand('node', [item.scriptPath, ...item.args]);
    }

    console.log(`Completado ${scriptName}.`);
  }

  console.log(
    '\nTodos los scripts de sincronizacion se ejecutaron correctamente.',
  );
}

void runAllSyncScripts().catch((error) => {
  console.error('Error en sync:', error);
  process.exitCode = 1;
});
