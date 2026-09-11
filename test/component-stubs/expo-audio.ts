import * as React from 'react';

export const RecordingPresets = { HIGH_QUALITY: { extension: '.m4a' } };

export const AudioModule = {
  requestRecordingPermissionsAsync: async () => ({ granted: true }),
};

export async function setAudioModeAsync() {}

export function useAudioRecorder() {
  const recorder = React.useRef({
    uri: null as string | null,
    prepareToRecordAsync: async () => {},
    record: () => {},
    stop: async () => {},
    getStatus: () => ({ durationMillis: 0, url: null as string | null }),
  });
  return recorder.current;
}
