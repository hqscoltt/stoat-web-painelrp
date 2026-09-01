import { getVirtmic } from "./virtualMic";

export {
  useVoice,
  VoiceContext,
  VOICE_CHAT_MIN_WIDTH,
  VOICE_CHAT_MAX_WIDTH,
} from "./state";

export { InRoom } from "./components/InRoom";
export { RoomAudioManager } from "./components/RoomAudioManager";
export { stoatSinkName } from "./virtualMic";

const originalMediaCall = navigator.mediaDevices.getDisplayMedia;

navigator.mediaDevices.getDisplayMedia = async function (opts) {
  // Hard overwrite the track constraints so that we -never ever- get a track
  // that is over 720p when requesting a new video track
  if (opts && opts.video && typeof opts.video === "object") {
    opts.video = {
      ...opts.video,
      frameRate: { ideal: 5, max: 5 },
      width: { ideal: 640, max: 640 },
      height: { ideal: 480, max: 480 },
    };
  }

  const stream: MediaStream = await originalMediaCall.call(this, opts);

  if (opts && opts.audio && window.native?.isWayland?.()) {
    const id = await getVirtmic();

    console.debug("Virt mic acquired:", id);

    if (id) {
      const audio = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: {
            exact: id,
          },
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
          channelCount: 2,
          sampleRate: 48000,
          sampleSize: 16,
        },
      });

      stream.getAudioTracks().forEach((t) => stream.removeTrack(t));
      stream.addTrack(audio.getAudioTracks()[0]);
    }
  }

  // Windows desktop app: swap in per-process loopback audio (excludes our
  // own output) captured natively via the Electron preload bridge, since
  // Chromium's screen-share picker has no way to request a custom audio
  // track directly.
  console.log(
    "[DEBUG] loopback check: opts.audio =",
    !!(opts && opts.audio),
    "window.desktopAudioLoopback =",
    typeof window.desktopAudioLoopback,
  );

  if (opts && opts.audio && window.desktopAudioLoopback) {
    console.log("[DEBUG] entering desktopAudioLoopback swap block");

    try {
      const audioContext = new AudioContext({ sampleRate: 48000 });
      await audioContext.audioWorklet.addModule("/loopback-processor.js");
      console.log("[DEBUG] audioWorklet module loaded");

      const workletNode = new AudioWorkletNode(
        audioContext,
        "loopback-processor",
        { outputChannelCount: [2] },
      );
      const dest = audioContext.createMediaStreamDestination();
      workletNode.connect(dest);

      const info = await window.desktopAudioLoopback.start((chunk) => {
        workletNode.port.postMessage(new Float32Array(chunk), [chunk]);
      });

      console.log("[DEBUG] desktopAudioLoopback.start() resolved with:", info);

      if (info?.ok) {
        stream.getAudioTracks().forEach((t) => stream.removeTrack(t));
        stream.addTrack(dest.stream.getAudioTracks()[0]);
        console.log("[DEBUG] swapped in loopback audio track successfully");
      } else {
        console.log(
          "[DEBUG] info.ok was falsy, keeping original Electron loopback audio",
        );
      }
    } catch (e) {
      console.log("[DEBUG] desktopAudioLoopback swap threw an error:", e);
    }
  } else {
    console.log(
      "[DEBUG] skipped desktopAudioLoopback swap block (condition was false)",
    );
  }

  return stream;
};
