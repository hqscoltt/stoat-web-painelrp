import { BiRegularCheckCircle, BiSolidCheckCircle } from "solid-icons/bi";
import {
  Accessor,
  JSX,
  Match,
  Setter,
  Show,
  Switch,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import type { API, Channel, Server, ServerFlags } from "stoat.js";
import { styled } from "styled-system/jsx";

import { useDevice } from "@revolt/common";
import { KeybindAction, createKeybind } from "@revolt/keybinds";
import { TextWithEmoji } from "@revolt/markdown";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { useVoice } from "@revolt/rtc";
import { useState } from "@revolt/state";
import {
  Column,
  Draggable,
  Header,
  IconButton,
  MenuButton,
  OverflowingText,
  Row,
  Tooltip,
  iconSize,
  symbolSize,
  typography,
} from "@revolt/ui";
import { VoiceChannelPreview } from "@revolt/ui/components/features/voice/VoiceChannelPreview";
import { createDragHandle } from "@revolt/ui/components/utils/Draggable";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import MdAdd from "@material-design-icons/svg/outlined/add.svg?component-solid";
import MdChevronRight from "@material-design-icons/svg/filled/chevron_right.svg?component-solid";
import MdSettings from "@material-symbols/svg-400/outlined/settings-fill.svg?component-solid";

import { SidebarBase } from "./common";

interface Props {
  /**
   * Server to display sidebar for
   */
  server: Server;

  /**
   * Currently selected channel ID
   */
  channelId: string | undefined;

  /**
   * Open server information modal
   */
  openServerInfo: () => void;

  /**
   * Open server settings modal
   */
  openServerSettings: () => void;

  /**
   * Menu generator
   */
  menuGenerator: (target: Server | Channel) => JSX.Directives["floating"];
}

/**
 * Ordered category data returned from server
 */
type CategoryData = Omit<API.Category, "channels"> & { channels: Channel[] };

type OrderingEvent =
  | {
      type: "categories";
      ids: string[];
    }
  | {
      type: "category";
      id: string;
      channelIds: string[];
      moved: boolean;
    };

/**
 * Display server information and channels
 */
export const ServerSidebar = (props: Props) => {
  const navigate = useNavigate();
  const { isMobile } = useDevice();

  // Users can manage certain parts of the server individually, regardless of their ManageServer Permission
  const canManageServer = () =>
    props.server.orPermission(
      "ManageServer",
      "ManageCustomisation",
      "ManageRole",
      "ManagePermissions",
    );

  // TODO: this does not filter visible channels at the moment because the state for categories is not stored anywhere
  /** Gets a list of channels that are currently not hidden inside a closed category */
  const visibleChannels = () =>
    props.server.orderedChannels.flatMap((category) => category.channels);

  // TODO: when navigating channels, we want to add aria-keyshortcuts={localized-shortcut} to the next/previous channels
  // https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-keyshortcuts
  // TODO: issue warning if nothing is found somehow? warnings can be nicer than flat out not working
  // TODO: we want it to feel smooth when navigating through channels, so we'll want to select channels immediately but not actually navigate until we're done moving through them
  /** Navigates to the channel offset from the current one, wrapping around if needed */
  const navigateChannel = (byOffset: number) => {
    if (props.channelId == null) return;

    const channels = visibleChannels();

    const currentChannelIndex = channels.findIndex(
      (channel) => channel.id === props.channelId,
    );

    // this will wrap the index around
    const nextChannel = channels.at(
      (currentChannelIndex + byOffset) % channels.length,
    );

    if (nextChannel) {
      navigate(`/server/${props.server.id}/channel/${nextChannel.id}`);
    }
  };

  createKeybind(KeybindAction.NAVIGATION_CHANNEL_UP, () => navigateChannel(-1));

  createKeybind(KeybindAction.NAVIGATION_CHANNEL_DOWN, () =>
    navigateChannel(1),
  );

  createKeybind(KeybindAction.CHAT_MARK_SERVER_AS_READ, () => {
    if (props.server.unread) {
      props.server.ack();
    }
  });

  const noOrdering = () => !props.server.havePermission("ManageChannel");

  let heldEvent: OrderingEvent & { type: "category" } = null!;
  function handleOrdering(event: OrderingEvent) {
    if (event.type === "category" && event.moved && !heldEvent) {
      heldEvent = event;
      return;
    }

    const normalisedCategories = props.server.orderedChannels.map(
      (category) => ({
        ...category,
        channels: category.channels.map((channel) => channel.id),
      }),
    );

    if (event.type === "categories") {
      props.server.edit({
        categories: event.ids
          .map((id) => normalisedCategories.find((cat) => cat.id === id)!)
          .filter((cat) => cat),
      });
    } else {
      props.server.edit({
        categories: normalisedCategories.map((category) => {
          if (heldEvent && category.id === heldEvent.id) {
            return {
              ...category,
              channels: heldEvent.channelIds,
            };
          } else if (category.id === event.id) {
            return {
              ...category,
              channels: event.channelIds,
            };
          } else {
            return category;
          }
        }),
      });

      heldEvent = null!;
    }
  }

  return (
    <SidebarBase
      class="channel_bar server"
      use:floating={props.menuGenerator(props.server)}
    >
      <Switch
        fallback={
          <Header placement="secondary">
            <ServerInfo
              server={props.server}
              canManageServer={canManageServer()}
              openServerInfo={props.openServerInfo}
              openServerSettings={props.openServerSettings}
            />
          </Header>
        }
      >
        <Match when={props.server.banner}>
          <Header
            image
            placement="secondary"
            style={{
              background: `url('${props.server.bannerURL}')`,
            }}
          >
            <ServerInfo
              server={props.server}
              canManageServer={canManageServer()}
              openServerInfo={props.openServerInfo}
              openServerSettings={props.openServerSettings}
            />
          </Header>
        </Match>
      </Switch>
      <div
        use:invisibleScrollable
        style={{ "flex-grow": 1, "margin-bottom": "var(--gap-md)" }}
        use:floating={props.menuGenerator(props.server)}
      >
        <Draggable
          dragHandles
          type="category"
          //TODO - No channel ordering on mobile due to usability issue
          //Consider adding a way to enable reordering with dragHandles in server settings
          disabled={isMobile || noOrdering()}
          items={props.server.orderedChannels}
          onChange={(ids) => handleOrdering({ type: "categories", ids })}
        >
          {(entry) => (
            <Category
              server={props.server}
              category={entry.item}
              channelId={props.channelId}
              menuGenerator={props.menuGenerator}
              dragDisabled={entry.dragDisabled}
              setDragDisabled={entry.setDragDisabled}
              noOrdering={noOrdering}
              handleOrdering={handleOrdering}
            />
          )}
        </Draggable>
      </div>
    </SidebarBase>
  );
};

/**
 * Server Information
 */
function ServerInfo(
  props: Pick<Props, "server" | "openServerInfo" | "openServerSettings"> & {
    canManageServer: boolean;
  },
) {
  return (
    <Row align grow minWidth={0}>
      <ServerBadge flags={props.server.flags} />
      <ServerName onClick={props.openServerInfo}>
        <TextWithEmoji content={props.server.name} />
      </ServerName>
      <Show when={props.canManageServer}>
        <IconButton
          size="xs"
          width="narrow"
          variant={props.server.banner ? "_header" : "standard"}
          onPress={props.openServerSettings}
        >
          <MdSettings {...symbolSize(24)} />
        </IconButton>
      </Show>
    </Row>
  );
}

/**
 * Server name
 */
const ServerName = styled("a", {
  base: {
    flexGrow: 1,
    minWidth: 0,

    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
});

/**
 * Server badge
 */
function ServerBadge(props: { flags: ServerFlags }) {
  const { t } = useLingui();

  return (
    <Show when={props.flags}>
      <Tooltip
        content={props.flags === 1 ? t`Official Server` : t`Verified`}
        placement="top"
      >
        {props.flags === 1 ? (
          <BiSolidCheckCircle size={12} />
        ) : (
          <BiRegularCheckCircle size={12} />
        )}
      </Tooltip>
    </Show>
  );
}

/**
 * Single category entry
 */
function Category(
  props: {
    server: Server;
    category: CategoryData;
    channelId: string | undefined;
    noOrdering: Accessor<boolean>;
    handleOrdering: (event: OrderingEvent) => void;
  } & Pick<Props, "menuGenerator"> & {
      dragDisabled: Accessor<boolean>;
      setDragDisabled: Setter<boolean>;
    },
) {
  const state = useState();
  const { openModal } = useModals();
  const isOpen = () => state.layout.getSectionState(props.category.id, true);
  const { isMobile } = useDevice();

  const channels = createMemo(() =>
    props.category.channels.filter(
      (channel) =>
        props.category.id === "default" ||
        isOpen() ||
        channel.unread ||
        channel.id === props.channelId,
    ),
  );

  return (
    <CategorySection>
      <Show when={props.category.id !== "default"}>
        <div use:floating={props.menuGenerator(props.category as never)}>
          <CategoryBase
            open={isOpen()}
            onClick={() => {
              state.layout.toggleSectionState(props.category.id, true);
            }}
            {...createDragHandle(props.dragDisabled, props.setDragDisabled)}
          >
            {props.category.title}
            <Show when={props.server.havePermission("ManageChannel")}>
              <a
                use:floating={{
                  tooltip: {
                    placement: "top",
                    content: "Criar Canal",
                  },
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  openModal({
                    type: "create_channel",
                    server: props.server,
                    categoryId: props.category.id,
                  });
                }}
              >
                <MdAdd {...iconSize(14)} />
              </a>
            </Show>
            <MdChevronRight {...iconSize(12)} />
          </CategoryBase>
        </div>
      </Show>
      <Draggable
        type="channels"
        items={channels()}
        onChange={(channelIds) => {
          const current = channels();
          props.handleOrdering({
            type: "category",
            id: props.category.id,
            channelIds,
            moved: channelIds.length !== current.length,
          });
        }}
        //TODO - No channel ordering on mobile due to usability issue
        //Consider adding a way to enable reordering with dragHandles in server settings
        disabled={isMobile || props.noOrdering() || !isOpen()}
        minimumDropAreaHeight="32px"
      >
        {(entry) => (
          <Entry
            channel={entry.item}
            active={entry.item.id === props.channelId}
            menuGenerator={props.menuGenerator}
          />
        )}
      </Draggable>
    </CategorySection>
  );
}

const CategorySection = styled("div", {
  base: {
    display: "flex",
    gap: "var(--gap-md)",
    flexDirection: "column",
    paddingBlock: "var(--gap-sm)",
  },
});

/**
 * Category title styling
 */
const CategoryBase = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",

    padding: "0 var(--gap-sm)",
    paddingLeft: "calc(var(--gap-lg) + 5px)",
    paddingTop: "10px",

    cursor: "pointer",
    userSelect: "none",
    transition: "var(--transitions-fast) all",

    "--color": "var(--md-sys-color-on-surface)",
    color: "var(--color)",
    fill: "var(--color)",

    ...typography.raw({ class: "label", size: "small" }),
    fontSize: "13px",

    "&:hover": {
      "--color": "var(--md-sys-color-on-surface-variant)",
    },

    "& svg": {
      transition: "var(--transitions-fast) transform",
    },
  },
  variants: {
    open: {
      true: {
        "& svg": {
          transform: "rotateZ(90deg)",
        },
      },
    },
  },
});

/**
 * Live "call duration" timer shown next to a voice channel's name once
 * anyone is connected — ticks up from whoever joined first, Discord-style.
 */
function VoiceCallDuration(props: { channel: Channel }) {
  const [now, setNow] = createSignal(Date.now());

  const interval = setInterval(() => setNow(Date.now()), 1000);
  onCleanup(() => clearInterval(interval));

  const elapsed = createMemo(() => {
    const joinTimes = [...props.channel.voiceParticipants.values()].map(
      (p) => p.joinedAt.getTime(),
    );
    if (!joinTimes.length) return 0;
    return Math.max(0, Math.floor((now() - Math.min(...joinTimes)) / 1000));
  });

  const formatted = createMemo(() => {
    const s = elapsed();
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
  });

  return <DurationText>{formatted()}</DurationText>;
}

const DurationText = styled("span", {
  base: {
    flexShrink: 0,
    whiteSpace: "nowrap",
    fontSize: "0.75em",
    fontWeight: 600,
    color: "#23a55a",
    fontVariantNumeric: "tabular-nums",
  },
});

/**
 * Server channel entry
 */
function Entry(
  props: { channel: Channel; active: boolean } & Pick<Props, "menuGenerator">,
) {
  const state = useState();
  const voice = useVoice();
  const { openModal } = useModals();
  const { isMobile } = useDevice();

  const canEditChannel = createMemo(() =>
    (["ManageChannel", "ManagePermissions", "ManageWebhooks"] as const).some(
      (perm) => props.channel.server?.havePermission(perm),
    ),
  );

  const canInvite = createMemo(() =>
    props.channel.server?.havePermission("InviteOthers"),
  );

  const alertState = createMemo(
    () =>
      !props.active &&
      props.channel.unread &&
      (props.channel.mentions?.size || true),
  );

  const inCall = () => props.channel.id === voice.channel()?.id;

  const attentionState = createMemo(() =>
    props.active
      ? "selected"
      : inCall()
        ? "active"
        : state.notifications.isChannelMuted(props.channel)
          ? "muted"
          : props.channel.unread
            ? "active"
            : "normal",
  );

  return (
    <Column gap="sm">
      <MenuButton
        href={`/server/${props.channel.serverId}/channel/${props.channel.id}`}
        onClick={() => {
          // Discord/Meet-style behaviour: clicking a voice channel joins it
          // immediately (no separate "Join voice channel" click required),
          // and clicking a *different* voice channel while already in a
          // call switches straight over — voice.connect() already tears
          // down any existing call before connecting the new one.
          if (
            props.channel.isVoice &&
            !inCall() &&
            props.channel.havePermission("Connect")
          ) {
            voice.connect(props.channel);
          }
        }}
        use:floating={props.menuGenerator(props.channel)}
        size="normal"
        alert={alertState()}
        attention={attentionState()}
        icon={
          <>
            <Switch fallback={<Symbol>grid_3x3</Symbol>}>
              <Match when={props.channel.isVoice}>
                <Symbol
                  color={inCall() ? "var(--md-sys-color-primary)" : undefined}
                >
                  headset_mic
                </Symbol>
              </Match>
            </Switch>
            <Show when={props.channel.icon}>
              <ChannelIcon
                src={props.channel.iconURL}
                css={{ marginEnd: "0.2em" }}
              />
            </Show>
          </>
        }
        persistentAction={
          <Show
            when={
              props.channel.isVoice && props.channel.voiceParticipants.size
            }
          >
            <VoiceCallDuration channel={props.channel} />
          </Show>
        }
        actions={
          <Show when={!isMobile}>
            <Show when={props.channel.isVoice && inCall()}>
              <a
                use:floating={{
                  tooltip: { placement: "top", content: "Abrir chat" },
                }}
                onClick={(e) => {
                  e.preventDefault();
                  voice.toggleChat();
                }}
              >
                <Symbol size={16} fill>
                  chat
                </Symbol>
              </a>
            </Show>
            <Show when={canInvite()}>
              <a
                use:floating={{
                  tooltip: { placement: "top", content: "Criar Convite" },
                }}
                onClick={(e) => {
                  e.preventDefault();
                  openModal({
                    type: "create_invite",
                    channel: props.channel,
                  });
                }}
              >
                <Symbol size={16} fill>
                  person_add
                </Symbol>
              </a>
            </Show>
            <Show when={canEditChannel()}>
              <a
                use:floating={{
                  tooltip: { placement: "top", content: "Editar Canal" },
                }}
                onClick={(e) => {
                  e.preventDefault();
                  openModal({
                    type: "settings",
                    config: "channel",
                    context: props.channel,
                  });
                }}
              >
                <Symbol size={16} fill>
                  settings
                </Symbol>
              </a>
            </Show>
          </Show>
        }
      >
        <OverflowingText>
          <TextWithEmoji content={props.channel.name!} />
        </OverflowingText>
      </MenuButton>

      <VoiceChannelPreview channel={props.channel} />
    </Column>
  );
}

/**
 * Channel icon styling
 */
const ChannelIcon = styled("img", {
  base: {
    width: "16px",
    height: "16px",
    objectFit: "contain",
  },
});
