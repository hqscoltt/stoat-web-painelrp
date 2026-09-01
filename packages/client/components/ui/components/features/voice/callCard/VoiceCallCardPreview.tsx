import { For, Show } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { Channel } from "stoat.js";
import { styled } from "styled-system/jsx";

import { useUsers } from "@revolt/markdown/users";
import { useVoice } from "@revolt/rtc";
import {
  Avatar,
  Button,
  Ripple,
  Text,
  typography,
} from "@revolt/ui/components/design";
import { Symbol } from "@revolt/ui/components/utils/Symbol";
import { css } from "styled-system/css";

/**
 * Full-screen "join the call" preview shown for a voice channel you're not
 * currently connected to — big centred prompt over a purple/blue gradient,
 * with a soft light that follows the cursor (Discord-esque).
 */
export function VoiceCallCardPreview(props: { channel: Channel }) {
  const voice = useVoice();
  const { t } = useLingui();

  const ids = () => [...props.channel.voiceParticipants.keys()];
  const users = useUsers(ids);

  let ref: HTMLDivElement | undefined;

  function onPointerMove(e: PointerEvent) {
    if (!ref) return;
    const rect = ref.getBoundingClientRect();
    ref.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    ref.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  return (
    <Preview
      ref={ref}
      onPointerMove={onPointerMove}
      onClick={() => voice.connect(props.channel)}
    >
      <Ripple />
      <ChannelName>
        <Symbol size={20}>headset_mic</Symbol>
        {props.channel.name}
      </ChannelName>

      <Center>
        <Show
          when={users().length}
          fallback={<Symbol size={44}>voice_chat</Symbol>}
        >
          <Avatars>
            <For each={users()}>
              {(user) => (
                <Avatar size={44} src={user?.avatar} fallback={user?.username} />
              )}
            </For>
          </Avatars>
        </Show>

        <Text class="title" size="large">
          <Show
            when={voice.state() === "READY"}
            fallback={<Trans>Switch to this voice channel</Trans>}
          >
            <Trans>Join the voice channel</Trans>
          </Show>
        </Text>

        <p class={css(typography.raw({ class: "body" }), Subtext)}>
          <Show
            when={users().length}
            fallback={<Trans>Be the first to join</Trans>}
          >
            {t`with ${users()
              .map((u) => u?.username)
              .filter(Boolean)
              .join(", ")}`}
          </Show>
        </p>

        <Button variant="filled" size="md">
          <Symbol>call</Symbol> <Trans>Join Voice Channel</Trans>
        </Button>
      </Center>
    </Preview>
  );
}

const Preview = styled("div", {
  base: {
    "--mx": "50%",
    "--my": "50%",

    position: "relative",
    overflow: "hidden",
    cursor: "pointer",

    width: "100%",
    height: "100%",

    display: "flex",
    flexDirection: "column",

    color: "#fff",
    background: `
      radial-gradient(500px circle at var(--mx) var(--my), rgba(168, 130, 255, 0.35), transparent 60%),
      linear-gradient(160deg, #2b1a5e 0%, #1c1440 45%, #101a3a 100%)
    `,
    transition: "background 0.05s linear",
  },
});

const ChannelName = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",

    padding: "var(--gap-lg)",
    fontWeight: 600,
    fontSize: "1.1em",
    zIndex: 1,

    textShadow: "0 1px 4px rgba(0, 0, 0, 0.4)",
  },
});

const Center = styled("div", {
  base: {
    flexGrow: 1,

    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--gap-md)",

    zIndex: 1,
    textAlign: "center",
    textShadow: "0 1px 4px rgba(0, 0, 0, 0.4)",
  },
});

const Avatars = styled("div", {
  base: {
    display: "flex",
    flexShrink: 0,

    "& > *": {
      border: "3px solid #1c1440",
      borderRadius: "var(--borderRadius-full)",
    },

    "& :not(:first-child)": {
      marginInlineStart: "-16px",
    },
  },
});

const Subtext = css.raw({
  maxWidth: "400px",
  opacity: 0.8,
});
