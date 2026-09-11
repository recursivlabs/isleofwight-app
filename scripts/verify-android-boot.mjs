import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DEFAULT_PACKAGE_ID = 'com.minds.app';
const DEFAULT_APK = 'android/app/build/outputs/apk/release/app-release.apk';
const DEFAULT_OUTPUT_DIR = 'qa-media/android-boot';

/** @typedef {{ stdout?: string | Buffer | null, stderr?: string | Buffer | null, status?: number | null }} AdbResult */
/** @typedef {(args: string[], options?: { binary?: boolean }) => AdbResult} AdbRunner */

/** @param {AdbResult} result */
function commandOutput(result) {
  const stdout = Buffer.isBuffer(result.stdout)
    ? result.stdout.toString('utf8')
    : String(result.stdout || '');
  const stderr = Buffer.isBuffer(result.stderr)
    ? result.stderr.toString('utf8')
    : String(result.stderr || '');
  return { stdout, stderr };
}

/** @returns {AdbRunner} */
export function createAdbRunner(executable = process.env.ADB || 'adb') {
  return (args, options = {}) => {
    const result = spawnSync(executable, args, {
      encoding: options.binary ? null : 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
      const { stdout, stderr } = commandOutput(result);
      throw new Error(`adb ${args.join(' ')} failed (${result.status})\n${stdout}\n${stderr}`);
    }

    return result;
  };
}

function requireText(result, label) {
  const { stdout } = commandOutput(result);
  const value = stdout.trim();
  if (!value) throw new Error(`${label} returned no output`);
  return value;
}

function lastLine(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1) || '';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function verifyAndroidBoot({
  adb = createAdbRunner(),
  wait = delay,
  packageId = process.env.ANDROID_BOOT_PACKAGE || DEFAULT_PACKAGE_ID,
  apkPath = process.env.ANDROID_BOOT_APK || DEFAULT_APK,
  outputDir = process.env.ANDROID_BOOT_OUTPUT_DIR || DEFAULT_OUTPUT_DIR,
  commitSha = process.env.GITHUB_SHA || '',
} = /** @type {{ adb?: AdbRunner, wait?: (ms: number) => Promise<void>, packageId?: string, apkPath?: string, outputDir?: string, commitSha?: string }} */ ({})) {
  if (!/^[A-Za-z][A-Za-z0-9_.]+$/.test(packageId)) {
    throw new Error(`Unsafe Android package id: ${packageId}`);
  }
  if (!/^[0-9a-f]{40}$/i.test(commitSha)) {
    throw new Error(`Android boot proof requires an exact commit SHA, got: ${commitSha || '<missing>'}`);
  }
  if (!existsSync(apkPath)) throw new Error(`Release APK not found: ${apkPath}`);

  mkdirSync(outputDir, { recursive: true });
  adb(['install', '-r', apkPath]);
  adb(['logcat', '-c']);

  const resolved = requireText(
    adb(['shell', 'cmd', 'package', 'resolve-activity', '--brief', packageId]),
    'Launcher activity lookup',
  );
  const activity = lastLine(resolved);
  if (!activity.includes('/') || !activity.startsWith(packageId)) {
    throw new Error(`Unexpected launcher activity: ${activity}`);
  }

  const launch = requireText(adb(['shell', 'am', 'start', '-W', '-n', activity]), 'App launch');
  writeFileSync(`${outputDir}/launch.txt`, `${launch}\n`);
  const launchStatus = launch.match(/^Status:\s*([^\s]+)$/im)?.[1]?.toLowerCase();
  // A cold release build can exceed ActivityManager's window-draw deadline on
  // a fresh emulator and return `Status: timeout` with `Complete`. Treat that
  // as provisional only: the process, task-state, and fatal-log checks below
  // still have to prove that the app actually booted.
  if (!['ok', 'timeout'].includes(launchStatus || '') || !/^Complete$/im.test(launch)) {
    throw new Error(`Android did not report a completed launch:\n${launch}`);
  }

  await wait(15_000);

  const pid = requireText(adb(['shell', 'pidof', packageId]), 'Application process').split(/\s+/)[0];
  if (!/^\d+$/.test(pid)) throw new Error(`Unexpected application pid: ${pid}`);

  const activities = requireText(
    adb(['shell', 'dumpsys', 'activity', 'activities']),
    'Activity state',
  );
  writeFileSync(`${outputDir}/activities.txt`, `${activities}\n`);
  if (!activities.includes(packageId) || !activities.includes(activity.split('/')[1])) {
    throw new Error(`The launched Minds activity is absent from Android task state: ${activity}`);
  }

  const logcat = commandOutput(adb(['logcat', '--pid', pid, '-d', '-v', 'threadtime'])).stdout;
  writeFileSync(`${outputDir}/logcat.txt`, logcat);
  if (/FATAL EXCEPTION/i.test(logcat)) {
    throw new Error('The Minds process logged a fatal exception after launch');
  }

  // The pid above is sampled AFTER the boot window. If the first process
  // crashed and something restarted it (push wake, headless task), that pid's
  // log is clean and the check above proves nothing about the launch. The
  // buffer was cleared before `am start`, so the full dump holds only this
  // boot: any fatal record attributed to our package in it is a boot crash,
  // while an unrelated process crashing on the emulator stays a pass.
  const fullLogcat = commandOutput(adb(['logcat', '-d', '-v', 'threadtime'])).stdout;
  writeFileSync(`${outputDir}/logcat-full.txt`, fullLogcat);
  const packageCrash = new RegExp(
    `FATAL EXCEPTION[\\s\\S]{0,300}?Process: ${packageId.replaceAll('.', '\\.')}[,\\s]`,
    'i',
  );
  if (packageCrash.test(fullLogcat)) {
    throw new Error(`A ${packageId} process crashed during the boot window`);
  }

  const screenshot = adb(['exec-out', 'screencap', '-p'], { binary: true }).stdout;
  if (!Buffer.isBuffer(screenshot) || screenshot.length === 0) {
    throw new Error('Android screenshot capture returned no bytes');
  }
  writeFileSync(`${outputDir}/screenshot.png`, screenshot);

  const summary = {
    commitSha,
    packageId,
    activity,
    pid,
    apkPath,
    launchStatus,
    verifiedAt: new Date().toISOString(),
  };
  writeFileSync(`${outputDir}/summary.json`, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`ANDROID BOOT PASS ${JSON.stringify(summary)}`);
  return summary;
}

async function main() {
  try {
    await verifyAndroidBoot();
  } catch (error) {
    const outputDir = process.env.ANDROID_BOOT_OUTPUT_DIR || DEFAULT_OUTPUT_DIR;
    mkdirSync(outputDir, { recursive: true });
    try {
      const fullLog = createAdbRunner()(['logcat', '-d', '-v', 'threadtime']);
      writeFileSync(`${outputDir}/logcat-full.txt`, commandOutput(fullLog).stdout);
    } catch {
      // Preserve the original boot failure when diagnostics are unavailable.
    }
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
