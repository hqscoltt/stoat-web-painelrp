import { getVirtmic } from "./virtualMic";

export { useVoice, VoiceContext } from "./state";

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
  if (opts && opts.audio && window.desktopAudioLoopback) {
    const audioContext = new AudioContext({ sampleRate: 48000 });
    await audioContext.audioWorklet.addModule("/loopback-processor.js");

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

    console.debug("Desktop audio loopback acquired:", info);

    if (info?.ok) {
      stream.getAudioTracks().forEach((t) => stream.removeTrack(t));
      stream.addTrack(dest.stream.getAudioTracks()[0]);
    }
  }

  return stream;
};
