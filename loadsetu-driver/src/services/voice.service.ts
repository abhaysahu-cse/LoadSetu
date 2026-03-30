/**
 * LoadSetu — Voice Recording Service
 * Hold-to-record, .aac format, 2 MB hard cap, streams to FastAPI → Gemini
 */

import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { parseVoice, VoiceIntentResponse } from '../api/endpoints';

const MAX_BYTES       = 2 * 1024 * 1024; // 2 MB
const MAX_DURATION_MS = 30_000;          // 30 sec safety cutoff

let recording: Audio.Recording | null = null;
let cutoffTimer: ReturnType<typeof setTimeout> | null = null;

export type VoiceState =
  | 'IDLE'
  | 'RECORDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'ERROR_TOO_LARGE'
  | 'ERROR_NETWORK'
  | 'ERROR_PERMISSION';

// ─── Request mic permission (call once at startup) ───────────────────────────
export async function requestMicPermission(): Promise<boolean> {
  const { granted } = await Audio.requestPermissionsAsync();
  return granted;
}

// ─── Start recording (call on press-in of mic button) ────────────────────────
export async function startRecording(
  onState: (s: VoiceState) => void,
): Promise<void> {
  const hasPermission = await requestMicPermission();
  if (!hasPermission) {
    onState('ERROR_PERMISSION');
    return;
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  recording = new Audio.Recording();

  await recording.prepareToRecordAsync({
    android: {
      extension:    '.aac',
      outputFormat: Audio.AndroidOutputFormat.AAC_ADTS,
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate:   16_000,
      numberOfChannels: 1,
      bitRate:      64_000,
    },
    ios: {
      extension:    '.aac',
      outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
      audioQuality: Audio.IOSAudioQuality.MEDIUM,
      sampleRate:   16_000,
      numberOfChannels: 1,
      bitRate:      64_000,
      linearPCMBitDepth:    16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat:     false,
    },
    web: {
      mimeType: 'audio/webm',
      bitsPerSecond: 64000,
    },
    isMeteringEnabled: true,
  });

  await recording.startAsync();
  onState('RECORDING');

  // Safety cutoff — stop automatically at MAX_DURATION_MS
  cutoffTimer = setTimeout(() => stopAndParse(onState), MAX_DURATION_MS);
}

// ─── Stop recording & send to AI (call on press-out of mic button) ───────────
export async function stopAndParse(
  onState: (s: VoiceState) => void,
): Promise<VoiceIntentResponse | null> {
  if (!recording) return null;

  if (cutoffTimer) {
    clearTimeout(cutoffTimer);
    cutoffTimer = null;
  }

  try {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recording = null;

    if (!uri) throw new Error('No URI from recording');

    // ── 2 MB hard cap check ───────────────────────────────────────────────
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (!info.exists) throw new Error('Recording file missing');

    if (info.size > MAX_BYTES) {
      // Delete file, show error — DO NOT upload
      await FileSystem.deleteAsync(uri, { idempotent: true });
      onState('ERROR_TOO_LARGE');
      return null;
    }

    onState('PROCESSING'); // show "Processing AI..." shimmer

    const result = await parseVoice(uri, 'audio/aac');

    // Clean up temp file
    await FileSystem.deleteAsync(uri, { idempotent: true });

    onState('SUCCESS');
    return result;
  } catch (err: any) {
    recording = null;
    if (err?.type === 'NETWORK_ERROR') {
      onState('ERROR_NETWORK');
    } else {
      onState('ERROR_PERMISSION'); // generic fallback
    }
    return null;
  } finally {
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  }
}

// ─── Cancel (e.g. drag away from mic) ────────────────────────────────────────
export async function cancelRecording(): Promise<void> {
  if (cutoffTimer) clearTimeout(cutoffTimer);
  if (!recording) return;
  try {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recording = null;
    if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    recording = null;
  }
}
