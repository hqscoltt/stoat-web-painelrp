import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { useMediaDeviceSelect } from "solid-livekit-components";

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
import { Avatar, IconButton, Text } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";
import { UserMenu } from "../servers/UserMenu";

/**
 * Persistent Discord-style account bar pinned to the bottom of the channel
 * sidebar — self avatar/status, mic/deafen with device pickers, settings,
 * and (while connected) call status, ping, and quick call controls.
 */
export function AccountBar() {
  const user = useUser();
  const voice = useVoice();
  const state = useState();
  const { openModal } = useModals();
  const { limits } = useInstance();
  const { t } = useLingui();

  const [anchor, setAnchor] = createSignal<HTMLDivElement>();

  return (
    <Bar>
      <Show when={voice.channel()}>
        <ConnectedRow>
          <ConnectedInfo>
            <Ping />
            <ConnectedText>
              <Text size="small">
                <Trans>Voz conectada</Trans>
              </Text>
              <Text class="label" size="small">
                {voice.channel()?.name}
              </Text>
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
            <Symbol fill={voice.video()}>camera_video</Symbol>
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
            <Symbol fill={voice.screenshare()}>screen_share</Symbol>
          </IconButton>
          <IconButton
            size="xs"
            variant="standard"
            onPress={() => voice.disconnect()}
            use:floating={{
              tooltip: { placement: "top", content: t`End call` },
            }}
          >
            <Symbol color="var(--md-sys-color-error)">call_end</Symbol>
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
          <Text size="small">
            {user()?.displayName}
          </Text>
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
            <Symbol>settings</Symbol>
          </IconButton>
        </Controls>
      </Row>
    </Bar>
  );
}

/**
 * Signal-latency indicator, polled every 2s while mounted.
 */
function Ping() {
  const voice = useVoice();
  const { t } = useLingui();
  const [rtt, setRtt] = createSignal<number>();

  const interval = setInterval(() => {
    // `engine`/`client`/`rtt` are internal LiveKit APIs not covered by the
    // public TypeScript types, but are the only way to read signal RTT.
    // @ts-expect-error accessing internal LiveKit API for ping display
    setRtt(voice.room()?.engine?.client?.rtt as number | undefined);
  }, 2000);
  onCleanup(() => clearInterval(interval));

  return (
    <div
      use:floating={{
        tooltip: {
          placement: "top",
          content:
            rtt() === undefined
              ? t`Measuring...`
              : `${rtt()}ms`,
        },
      }}
    >
      <Symbol color="var(--md-sys-color-primary)">wifi</Symbol>
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
        <Show when={voice.microphone()} fallback={<Symbol>mic_off</Symbol>}>
          <Symbol>mic</Symbol>
        </Show>
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
        <Show when={voice.deafen()} fallback={<Symbol>headset</Symbol>}>
          <Symbol>headset_off</Symbol>
        </Show>
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
      <Symbol size={14}>keyboard_arrow_down</Symbol>
    </IconButton>
  );
}

const Bar = styled("div", {
  base: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",

    background: "var(--md-sys-color-surface-container-low)",
  },
});

const Row = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
    padding: "var(--gap-sm) var(--gap-md)",
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
