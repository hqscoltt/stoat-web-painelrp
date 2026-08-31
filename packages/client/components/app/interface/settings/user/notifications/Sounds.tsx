import { Trans, useLingui } from "@lingui/solid/macro";
import { Show } from "solid-js";
import { styled } from "styled-system/jsx";

import { useSound } from "@revolt/client";
import { TypeSounds, useState } from "@revolt/state";
import {
  CategoryButton,
  Checkbox,
  Column,
  IconButton,
  Text,
  iconSize,
} from "@revolt/ui";

import MdVolumeUp from "@material-design-icons/svg/outlined/volume_up.svg?component-solid";

/**
 * Preview button for a notification sound.
 *
 * Wrapped in a click-swallowing div because `CategoryButton`'s root element
 * is a clickable `<a>` (used to toggle the sound on/off) and this button is
 * nested inside it — without stopping propagation here, clicking "preview"
 * also toggles the parent row instead of (or in addition to) playing the
 * sound.
 */
function SoundPreviewButton(props: { sound: keyof TypeSounds }) {
  const soundController = useSound();
  const { t } = useLingui();

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <IconButton
        onPress={() => soundController.playSound(props.sound, true)}
        use:floating={{
          tooltip: {
            placement: "top",
            content: t`Play sound`,
          },
        }}
      >
        <MdVolumeUp {...iconSize(18)} />
      </IconButton>
    </div>
  );
}

export default function Sounds() {
  const { settings, sounds } = useState();

  return (
    <Show when={settings.desktopNotificationsState !== "unsupported"}>
      <Column>
        <Text class="title">
          <Trans>Sounds</Trans>
        </Text>
        <CategoryButton.Group>
          <CategoryButton
            action={<Checkbox checked={sounds.enabled("message")} />}
            onClick={() => sounds.toggle("message")}
            icon="blank"
          >
            <Content>
              <Trans>Message Received</Trans>{" "}
              <SoundPreviewButton sound="message" />
            </Content>
          </CategoryButton>
          <CategoryButton
            action={<Checkbox checked={sounds.enabled("mute")} />}
            onClick={() => sounds.toggle("mute")}
            icon="blank"
          >
            <Content>
              <Trans>Mute</Trans>
              <SoundPreviewButton sound="mute" />
            </Content>
          </CategoryButton>
          <CategoryButton
            action={<Checkbox checked={sounds.enabled("unmute")} />}
            onClick={() => sounds.toggle("unmute")}
            icon="blank"
          >
            <Content>
              <Trans>Unmute</Trans>
              <SoundPreviewButton sound="unmute" />
            </Content>
          </CategoryButton>
          <CategoryButton
            action={<Checkbox checked={sounds.enabled("deafen")} />}
            onClick={() => sounds.toggle("deafen")}
            icon="blank"
          >
            <Content>
              <Trans>Deafen</Trans>
              <SoundPreviewButton sound="deafen" />
            </Content>
          </CategoryButton>
          <CategoryButton
            action={<Checkbox checked={sounds.enabled("undeafen")} />}
            onClick={() => sounds.toggle("undeafen")}
            icon="blank"
          >
            <Content>
              <Trans>Undeafen</Trans>
              <SoundPreviewButton sound="undeafen" />
            </Content>
          </CategoryButton>
          {/* I don't think we need this? */}
          <Show when={false}>
            <CategoryButton
              action={<Checkbox onChange={(value) => void value} />}
              onClick={() => void 0}
              icon="blank"
            >
              <Trans>Message Sent</Trans>
            </CategoryButton>
          </Show>
          <CategoryButton
            action={<Checkbox checked={sounds.enabled("userJoinVoice")} />}
            onClick={() => sounds.toggle("userJoinVoice")}
            icon="blank"
          >
            <Content>
              <Trans>User Joined Call</Trans>
              <SoundPreviewButton sound="userJoinVoice" />
            </Content>
          </CategoryButton>
          <CategoryButton
            action={<Checkbox checked={sounds.enabled("userLeaveVoice")} />}
            onClick={() => sounds.toggle("userLeaveVoice")}
            icon="blank"
          >
            <Content>
              <Trans>User Left Call</Trans>
              <SoundPreviewButton sound="userLeaveVoice" />
            </Content>
          </CategoryButton>
          <CategoryButton
            action={<Checkbox checked={sounds.enabled("streamStart")} />}
            onClick={() => sounds.toggle("streamStart")}
            icon="blank"
          >
            <Content>
              <Trans>Stream Start</Trans>
              <SoundPreviewButton sound="streamStart" />
            </Content>
          </CategoryButton>
          <CategoryButton
            action={<Checkbox checked={sounds.enabled("streamEnd")} />}
            onClick={() => sounds.toggle("streamEnd")}
            icon="blank"
          >
            <Content>
              <Trans>Stream End</Trans>
              <SoundPreviewButton sound="streamEnd" />
            </Content>
          </CategoryButton>
        </CategoryButton.Group>
      </Column>
    </Show>
  );
}

/**
 * Sound content wrapper
 */
const Content = styled("div", {
  base: {
    display: "flex",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
  },
});
