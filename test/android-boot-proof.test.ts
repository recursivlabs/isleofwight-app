import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { verifyAndroidBoot } from '../scripts/verify-android-boot.mjs';

const COMMIT_SHA = 'a'.repeat(40);

function fixture(overrides: Record<string, string | Buffer> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'minds-android-boot-'));
  const apkPath = join(directory, 'app-release.apk');
  const outputDir = join(directory, 'evidence');
  writeFileSync(apkPath, 'apk');

  const responses: Record<string, string | Buffer> = {
    'install -r': 'Success\n',
    'logcat -c': '',
    'shell cmd package resolve-activity --brief': 'com.minds.app/.MainActivity\n',
    'shell am start -W -n': 'Status: ok\nActivity: com.minds.app/.MainActivity\nComplete\n',
    'shell pidof': '321\n',
    'shell dumpsys activity activities': 'Task realActivity=com.minds.app/.MainActivity\n',
    'logcat --pid': '08-26 ActivityTaskManager: Displayed com.minds.app/.MainActivity\n',
    'logcat -d': '08-26 ActivityTaskManager: Displayed com.minds.app/.MainActivity\n',
    'exec-out screencap -p': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    ...overrides,
  };

  const adb = vi.fn((args: string[]) => {
    const command = Object.keys(responses).find((prefix) => args.join(' ').startsWith(prefix));
    if (!command) throw new Error(`Unexpected adb command: ${args.join(' ')}`);
    return { status: 0, stdout: responses[command], stderr: '' };
  });

  return { adb, apkPath, outputDir, commitSha: COMMIT_SHA };
}

describe('verifyAndroidBoot', () => {
  it('records SHA-bound evidence when the release process survives launch', async () => {
    const { adb, apkPath, outputDir, commitSha } = fixture();
    const summary = await verifyAndroidBoot({ adb, apkPath, outputDir, commitSha, wait: async () => {} });

    expect(summary).toMatchObject({
      commitSha: COMMIT_SHA,
      packageId: 'com.minds.app',
      activity: 'com.minds.app/.MainActivity',
      pid: '321',
      apkPath,
    });
    expect(readFileSync(join(outputDir, 'summary.json'), 'utf8')).toContain(COMMIT_SHA);
    expect(readFileSync(join(outputDir, 'screenshot.png'))).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );
    expect(adb).toHaveBeenCalledWith(['install', '-r', apkPath]);
  });

  it('refuses evidence that is not bound to an exact commit', async () => {
    const setup = fixture();

    await expect(
      verifyAndroidBoot({ ...setup, commitSha: 'short', wait: async () => {} }),
    ).rejects.toThrow('requires an exact commit SHA');
    expect(setup.adb).not.toHaveBeenCalled();
  });

  it('rejects an incomplete ActivityManager launch', async () => {
    const setup = fixture({
      'shell am start -W -n': 'Status: timeout\nActivity: com.minds.app/.MainActivity\n',
    });

    await expect(
      verifyAndroidBoot({ ...setup, wait: async () => {} }),
    ).rejects.toThrow('did not report a completed launch');
  });

  it('accepts a completed ActivityManager timeout when direct boot proofs pass', async () => {
    const setup = fixture({
      'shell am start -W -n': [
        'Status: timeout',
        'LaunchState: UNKNOWN (-1)',
        'Activity: com.minds.app/.MainActivity',
        'Complete',
      ].join('\n'),
    });

    await expect(
      verifyAndroidBoot({ ...setup, wait: async () => {} }),
    ).resolves.toMatchObject({ launchStatus: 'timeout', pid: '321' });
  });

  it('rejects a process that dies during the boot window', async () => {
    const setup = fixture({ 'shell pidof': '' });

    await expect(
      verifyAndroidBoot({ ...setup, wait: async () => {} }),
    ).rejects.toThrow('Application process returned no output');
  });

  it('rejects an activity missing from Android task state', async () => {
    const setup = fixture({
      'shell dumpsys activity activities': 'Task realActivity=com.android.launcher/.Launcher\n',
    });

    await expect(
      verifyAndroidBoot({ ...setup, wait: async () => {} }),
    ).rejects.toThrow('absent from Android task state');
  });

  it('rejects a fatal exception from the launched process', async () => {
    const setup = fixture({
      'logcat --pid': 'FATAL EXCEPTION: main\nProcess: com.minds.app, PID: 321\n',
    });

    await expect(
      verifyAndroidBoot({ ...setup, wait: async () => {} }),
    ).rejects.toThrow('fatal exception');
  });

  it('rejects a boot crash hidden by an automatic process restart', async () => {
    // The surviving pid (321) has a clean log; only the full buffer still
    // carries the first process (320) crashing during the boot window.
    const setup = fixture({
      'logcat --pid': '08-26 ActivityTaskManager: Displayed com.minds.app/.MainActivity\n',
      'logcat -d': `${[
        '08-26 12:00:01.000   320   320 E AndroidRuntime: FATAL EXCEPTION: main',
        '08-26 12:00:01.001   320   320 E AndroidRuntime: Process: com.minds.app, PID: 320',
        '08-26 12:00:09.000   321   321 I ActivityTaskManager: Displayed com.minds.app/.MainActivity',
      ].join('\n')}\n`,
    });

    await expect(
      verifyAndroidBoot({ ...setup, wait: async () => {} }),
    ).rejects.toThrow('crashed during the boot window');
  });

  it('ignores an unrelated process crashing during the boot window', async () => {
    const setup = fixture({
      'logcat -d': `${[
        '08-26 12:00:01.000   555   555 E AndroidRuntime: FATAL EXCEPTION: main',
        '08-26 12:00:01.001   555   555 E AndroidRuntime: Process: com.other.app, PID: 555',
        '08-26 12:00:09.000   321   321 I ActivityTaskManager: Displayed com.minds.app/.MainActivity',
      ].join('\n')}\n`,
    });

    await expect(
      verifyAndroidBoot({ ...setup, wait: async () => {} }),
    ).resolves.toMatchObject({ pid: '321' });
  });
});
