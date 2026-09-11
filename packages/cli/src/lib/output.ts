import pc from 'picocolors';

export const log = {
  info(msg: string): void {
    console.log(`${pc.cyan('info')}  ${msg}`);
  },
  success(msg: string): void {
    console.log(`${pc.green('ok')}    ${msg}`);
  },
  warn(msg: string): void {
    console.log(`${pc.yellow('warn')}  ${msg}`);
  },
  error(msg: string): void {
    console.error(`${pc.red('error')} ${msg}`);
  },
  dim(msg: string): void {
    console.log(pc.dim(msg));
  },
};

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function exitWithError(msg: string, code = 1): never {
  log.error(msg);
  process.exit(code);
}

export function banner(): void {
  console.log();
  console.log(pc.bold(pc.cyan('  minds')));
  console.log(pc.dim('  the Minds platform CLI'));
  console.log();
}
