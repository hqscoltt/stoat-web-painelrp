import {
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import { useMediaDeviceSelect } from "solid-livekit-components";

import { createResizeObserver } from "@solid-primitives/resize-observer";
import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import {
  ContextMenu,
  ContextMenuButton,
} from "@revolt/app/menus/ContextMenu";
import { useUser } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { useVoice } from "@revolt/rtc";
import { useInstance } from "@revolt/instance";
import { useState } from "@revolt/state";
import {
  Avatar,
  ICON_ANIM_KEYFRAMES,
  IconAnim,
  IconButton,
  Text,
} from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";
import { UserMenu } from "../servers/UserMenu";

/**
 * Persistent Discord-style account bar — self avatar/status, mic/deafen
 * with device pickers, settings, and (while connected) call status, ping,
 * and quick call controls.
 *
 * Rendered as a fixed-position overlay spanning the full width of the
 * server rail + channel list (measured off `.main_bar`), so it floats
 * above both independently-scrollable columns instead of pushing into
 * either one's layout flow — matching Discord, where this bar ignores
 * the server rail entirely and both columns keep scrolling underneath it.
 */
export function AccountBar() {
  const user = useUser();
  const voice = useVoice();
  const state = useState();
  const { openModal } = useModals();
  const { limits } = useInstance();
  const { t } = useLingui();

  const [anchor, setAnchor] = createSignal<HTMLDivElement>();
  const [rect, setRect] = createSignal({ x: 0, width: 0 });

  // Lifted up here (rather than living inside <Ping/>) so both the wifi
  // icon AND the "Voz conectada" text can react to the same ping value.
  const [rtt, setRtt] = createSignal<number>();
  const pingColor = createMemo(() => pingColorFor(rtt()));

  onMount(() => {
    const pingInterval = setInterval(async () => {
      // `engine.client.rtt` only measures the signalling WebSocket's RTT,
      // which (behind a reverse proxy/tunnel) can take a completely
      // different, slower path than the actual audio/video. Read the real
      // media transport's RTT instead, straight from the browser's own
      // WebRTC stats for the peer connection carrying the media — this is
      // an internal LiveKit API not covered by the public TypeScript types.
      // @ts-expect-error accessing internal LiveKit API for ping display
      const pcManager = voice.room()?.engine?.pcManager;
      const pc: RTCPeerConnection | undefined =
        pcManager?.subscriber?.pc ?? pcManager?.publisher?.pc;

      if (!pc) {
        setRtt(undefined);
        return;
      }

      const stats = await pc.getStats();
      let rttSeconds: number | undefined;
      stats.forEach((report) => {
        if (
          report.type === "candidate-pair" &&
          (report.state === "succeeded" || report.nominated) &&
          typeof report.currentRoundTripTime === "number"
        ) {
          rttSeconds = report.currentRoundTripTime;
        }
      });

      setRtt(
        rttSeconds === undefined ? undefined : Math.round(rttSeconds * 1000),
      );
    }, 2000);
    onCleanup(() => clearInterval(pingInterval));
  });

  onMount(() => {
    const target = document.querySelector(".main_bar");
    if (!target) return;
    createResizeObserver(target, () => {
      const r = target.getBoundingClientRect();
      setRect({ x: r.x, width: r.width });
    });
  });

  return (
    <Portal mount={document.getElementById("floating")!}>
      {/* One-off keyframes for the small icon hover animations below —
          simplest way to get real @keyframes without fighting the styled
          system's variant API for something this tiny. */}
      <style>{ICON_ANIM_KEYFRAMES}</style>
      <FloatingPosition style={{ left: `${rect().x}px`, width: `${rect().width}px` }}>
        <Bar>
          <Show when={voice.channel()}>
            <ConnectedRow>
              <ConnectedInfo>
                <Ping rtt={rtt()} color={pingColor()} />
                <ConnectedText>
                  <ConnectedLabel style={{ color: pingColor() }}>
                    <Trans>Voz conectada</Trans>
                  </ConnectedLabel>
                  <ChannelNameText>{voice.channel()?.name}</ChannelNameText>
                </ConnectedText>
              </ConnectedInfo>
              <IconButton
                size="xs"
                variant="standard"
                onPress={() => {
                  if (limits().video) voice.toggleCamera();
                }}
                isDisabled={!limits().video}
                use:floating={{
                  tooltip: {
                    placement: "top",
                    content: voice.video() ? t`Stop camera` : t`Start camera`,
                  },
                }}
              >
                <IconAnim kind="pop">
                  <Symbol fill={voice.video()}>camera_video</Symbol>
                </IconAnim>
              </IconButton>
              <IconButton
                size="xs"
                variant="standard"
                onPress={() => {
                  if (limits().video) voice.toggleScreenshare();
                }}
                isDisabled={!limits().video}
                use:floating={{
                  tooltip: {
                    placement: "top",
                    content: voice.screenshare()
                      ? t`Stop sharing`
                      : t`Share screen`,
                  },
                }}
              >
                <IconAnim kind="pop">
                  <Symbol fill={voice.screenshare()}>screen_share</Symbol>
                </IconAnim>
              </IconButton>
              <IconButton
                size="xs"
                variant="standard"
                onPress={() => voice.disconnect()}
                use:floating={{
                  tooltip: { placement: "top", content: t`End call` },
                }}
              >
                <IconAnim kind="jump">
                  <Symbol color="var(--md-sys-color-error)">call_end</Symbol>
                </IconAnim>
              </IconButton>
            </ConnectedRow>
          </Show>

          <Row>
            <AvatarHolder ref={setAnchor}>
              <Avatar
                size={32}
                src={user()?.avatarURL}
                fallback={user()?.username}
                interactive
              />
            </AvatarHolder>
            <UserMenu anchor={anchor} />

            <NameColumn>
              <WhiteName>{user()?.displayName}</WhiteName>
              <Text class="label" size="small">
                {user()?.presence}
              </Text>
            </NameColumn>

            <Controls>
              <MicControl />
              <DeafenControl />
              <IconButton
                size="xs"
                variant="standard"
                onPress={() => openModal({ type: "settings", config: "user" })}
                use:floating={{
                  tooltip: { placement: "top", content: t`Settings` },
                }}
              >
                <IconAnim kind="spin">
                  <Symbol>settings</Symbol>
                </IconAnim>
              </IconButton>
            </Controls>
          </Row>
        </Bar>
      </FloatingPosition>
    </Portal>
  );
}

/**
 * Ping thresholds, Discord-style: green (good) → yellow → orange → red (bad).
 */
function pingColorFor(ms: number | undefined): string {
  if (ms === undefined) return "var(--md-sys-color-outline)";
  if (ms < 100) return "#23a55a";
  if (ms < 200) return "#f0b132";
  if (ms < 300) return "#f0822b";
  return "#da373c";
}

/**
 * Signal-latency indicator — colour is driven from the parent so it stays
 * in sync with the "Voz conectada" text next to it.
 */
function Ping(props: { rtt: number | undefined; color: string }) {
  return (
    <div
      // Dynamic per-render colours like this don't flow reliably through
      // Symbol's `color` prop (Panda's styled-system generates CSS classes
      // from statically-analyzable values, not arbitrary runtime strings) —
      // an inline style + normal CSS colour inheritance always works, same
      // approach already used for the "Voz conectada" text next to this.
      style={{ color: props.color }}
      use:floating={{
        tooltip: {
          placement: "top",
          content:
            props.rtt === undefined ? "Medindo..." : `${props.rtt}ms`,
        },
      }}
    >
      <IconAnim kind="pop">
        <Symbol>wifi</Symbol>
      </IconAnim>
    </div>
  );
}

function MicControl() {
  const voice = useVoice();
  const { t } = useLingui();

  return (
    <ControlGroup>
      <IconButton
        size="xs"
        variant={voice.microphone() ? "standard" : "tonal"}
        onPress={() => voice.toggleMute()}
        isDisabled={!voice.speakingPermission}
        use:floating={{
          tooltip: {
            placement: "top",
            content: voice.microphone() ? t`Mute` : t`Unmute`,
          },
        }}
      >
        <IconAnim kind="wiggle">
          <Show when={voice.microphone()} fallback={<Symbol>mic_off</Symbol>}>
            <Symbol>mic</Symbol>
          </Show>
        </IconAnim>
      </IconButton>
      <DeviceChevron kind="audioinput" />
    </ControlGroup>
  );
}

function DeafenControl() {
  const voice = useVoice();
  const { t } = useLingui();

  return (
    <ControlGroup>
      <IconButton
        size="xs"
        variant={voice.deafen() ? "tonal" : "standard"}
        onPress={() => voice.toggleDeafen()}
        isDisabled={!voice.listenPermission}
        use:floating={{
          tooltip: {
            placement: "top",
            content: voice.deafen() ? t`Undeafen` : t`Deafen`,
          },
        }}
      >
        <IconAnim kind="pop">
          <Show when={voice.deafen()} fallback={<Symbol>headset</Symbol>}>
            <Symbol>headset_off</Symbol>
          </Show>
        </IconAnim>
      </IconButton>
      <DeviceChevron kind="audiooutput" />
    </ControlGroup>
  );
}

/**
 * Small dropdown chevron opening a device picker for mic/speaker selection.
 */
function DeviceChevron(props: { kind: "audioinput" | "audiooutput" }) {
  const state = useState();
  const media = createMemo(() => useMediaDeviceSelect({ kind: props.kind }));

  const setKey = () =>
    props.kind === "audioinput"
      ? "preferredAudioInputDevice"
      : "preferredAudioOutputDevice";

  const activeId = createMemo(() => state.voice[setKey()] ?? "default");

  return (
    <IconButton
      size="xs"
      variant="standard"
      use:floating={{
        contextMenuHandler: "click",
        contextMenu: () => (
          <ContextMenu>
            <For each={media().devices()}>
              {(dev) => (
                <ContextMenuButton
                  actionSymbol={
                    activeId() === dev.deviceId ? (
                      <Symbol>check</Symbol>
                    ) : undefined
                  }
                  onClick={() => {
                    media().setActiveMediaDevice(dev.deviceId);
                    state.voice[setKey()] =
                      dev.deviceId === "default" ? undefined : dev.deviceId;
                  }}
                >
                  {dev.label || dev.deviceId}
                </ContextMenuButton>
              )}
            </For>
          </ContextMenu>
        ),
      }}
    >
      <IconAnim kind="bounce">
        <Symbol size={14}>keyboard_arrow_down</Symbol>
      </IconAnim>
    </IconButton>
  );
}

/**
 * Fixed-position wrapper that pins the bar to the bottom-left corner of the
 * whole app, spanning `.main_bar`'s measured width (server rail + channel
 * list) — independent of either column's own scroll position.
 */
const FloatingPosition = styled("div", {
  base: {
    position: "fixed",
    bottom: "10px",
    zIndex: 20,
    padding: "0 var(--gap-sm)",
  },
});

const Bar = styled("div", {
  base: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",

    borderRadius: "var(--borderRadius-lg)",
    // Match the profile popup's background so the two read as one surface.
    background: "var(--md-sys-color-surface-container)",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
  },
});

const WhiteName = styled("span", {
  base: {
    color: "#fff",
    fontSize: "0.85em",
    fontWeight: 600,

    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
});

const ConnectedLabel = styled("span", {
  base: {
    fontSize: "0.8em",
    fontWeight: 600,

    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
});

const ChannelNameText = styled("span", {
  base: {
    // Was using the app's muted "label" colour, which read as too dark
    // against this row's background — lighten it explicitly.
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: "0.8em",

    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
});

/**
 * Wraps an icon to give it a small, tasteful hover animation — matching
 * Discord's mic-wiggle/hangup-jump/etc. micro-interactions.
 */
const Row = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
    // A bit taller than before — the name/status text was cramped.
    padding: "var(--gap-md)",
    minHeight: "56px",
  },
});

const AvatarHolder = styled("div", {
  base: {
    cursor: "pointer",
    flexShrink: 0,
  },
});

const NameColumn = styled("div", {
  base: {
    minWidth: 0,
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",

    "& span": {
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
    },
  },
});

const Controls = styled("div", {
  base: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "2px",
  },
});

const ControlGroup = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
  },
});

const ConnectedRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--gap-sm)",
    padding: "var(--gap-sm) var(--gap-md)",

    background: "var(--md-sys-color-secondary-container)",
  },
});

const ConnectedInfo = styled("div", {
  base: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
  },
});

const ConnectedText = styled("div", {
  base: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",

    "& span": {
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
    },
  },
});
