import {
  Component,
  createSignal,
  JSX,
  Match,
  Show,
  Switch,
  createMemo,
} from "solid-js";
import { styled } from "styled-system/jsx";

import { Channel, Server as ServerI } from "stoat.js";

import {
  CategoryContextMenu,
  ChannelContextMenu,
  ServerSidebarContextMenu,
} from "@revolt/app";
import { useClient, useUser } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { useVoice } from "@revolt/rtc";
import { useLocation, useParams, useSmartParams } from "@revolt/routing";
import { useState } from "@revolt/state";
import { LAYOUT_SECTIONS } from "@revolt/state/stores/Layout";

import { HomeSidebar, ServerList, ServerSidebar } from "./navigation";
import { AccountBar } from "./navigation/channels/AccountBar";

const MainBar = styled("div", {
  base: {
    display: "flex",
    flexShrink: 0,

    _phone: {
      "--layout-width-channel-sidebar": "auto",
      position: "absolute",
      width: "100vw",
      height: "100%",
    },
  },
});

/**
 * Left-most channel navigation sidebar
 */
export const Sidebar = (props: {
  /**
   * Menu generator TODO FIXME: remove
   */
  menuGenerator: (t: ServerI | Channel) => JSX.Directives["floating"];
}) => {
  const user = useUser();
  const state = useState();
  const client = useClient();
  const voice = useVoice();
  const { openModal } = useModals();

  const params = useParams<{ server: string }>();
  const location = useLocation();

  // Resizable channel-list column width, Discord-style drag handle at its
  // right edge. Persisted across reloads via localStorage.
  const SIDEBAR_WIDTH_KEY = "channelSidebarWidth";
  const MIN_WIDTH = 200,
    MAX_WIDTH = 420;

  const storedWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
  const [channelSidebarWidth, setChannelSidebarWidthSignal] = createSignal(
    storedWidth >= MIN_WIDTH && storedWidth <= MAX_WIDTH ? storedWidth : 300,
  );

  function setChannelSidebarWidth(width: number) {
    setChannelSidebarWidthSignal(width);
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
  }

  return (
    <MainBar
      class="main_bar"
      style={{ "--layout-width-channel-sidebar": `${channelSidebarWidth()}px` }}
    >
      <ServerList
        orderedServers={state.ordering.orderedServers(client())}
        setServerOrder={state.ordering.setServerOrder}
        unreadConversations={state.ordering
          .orderedConversations(client())
          .filter(
            // TODO: muting channels
            (channel) => channel.unread,
          )}
        user={user()!}
        selectedServer={() => params.server}
        onCreateOrJoinServer={() =>
          openModal({
            type: "create_or_join_server",
            client: client(),
          })
        }
        menuGenerator={props.menuGenerator}
      />
      <Show
        when={
          state.layout.getSectionState(LAYOUT_SECTIONS.PRIMARY_SIDEBAR, true) &&
          !location.pathname.startsWith("/discover")
        }
      >
        <Switch fallback={<Home />}>
          <Match when={params.server}>
            <Server />
          </Match>
        </Switch>
        <SidebarResizeHandle
          onPointerDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = channelSidebarWidth();
            voice.setIsLayoutResizing(true);

            const onMove = (ev: PointerEvent) => {
              const next = startWidth + (ev.clientX - startX);
              setChannelSidebarWidth(
                Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(next))),
              );
            };
            const onUp = () => {
              voice.setIsLayoutResizing(false);
              document.removeEventListener("pointermove", onMove);
              document.removeEventListener("pointerup", onUp);
            };
            document.addEventListener("pointermove", onMove);
            document.addEventListener("pointerup", onUp);
          }}
        />
      </Show>
      <AccountBar />
    </MainBar>
  );
};

const SidebarResizeHandle = styled("div", {
  base: {
    flexShrink: 0,
    width: "4px",
    cursor: "col-resize",
    touchAction: "none",
    // Blend into the same background as the sidebar/content either side of
    // it, rather than leaving a seam showing whatever colour sits behind
    // MainBar (which has no background of its own).
    background: "var(--md-sys-color-surface-container-lowest)",
  },
});

/**
 * Render sidebar for home
 */
const Home: Component = () => {
  const params = useSmartParams();
  const client = useClient();
  const state = useState();
  const conversations = createMemo(() =>
    state.ordering.orderedConversations(client()),
  );

  return (
    <HomeSidebar
      conversations={conversations}
      channelId={params().channelId}
      openSavedNotes={(navigate) => {
        // Check whether the saved messages channel exists already
        const channelId = [...client()!.channels.values()].find(
          (channel) => channel.type === "SavedMessages",
        )?.id;

        if (navigate) {
          if (channelId) {
            // Navigate if exists
            navigate(`/channel/${channelId}`);
          } else {
            // If not, try to create one but only if navigating
            client()!
              .user!.openDM()
              .then((channel) => navigate(`/channel/${channel.id}`));
          }
        }

        // Otherwise return channel ID if available
        return channelId;
      }}
    />
  );
};

/**
 * Render sidebar for a server
 */
const Server: Component = () => {
  const { openModal } = useModals();
  const params = useSmartParams();
  const client = useClient();

  /**
   * Resolve the server
   * @returns Server
   */
  const server = () => client()!.servers.get(params().serverId!)!;

  /**
   * Open the server information modal
   */
  function openServerInfo() {
    openModal({
      type: "server_info",
      server: server(),
    });
  }

  /**
   * Open the server settings modal
   */
  function openServerSettings() {
    openModal({
      type: "settings",
      config: "server",
      context: server(),
    });
  }

  return (
    <Show when={server()}>
      <ServerSidebar
        server={server()}
        channelId={params().channelId}
        openServerInfo={openServerInfo}
        openServerSettings={openServerSettings}
        menuGenerator={(target) => ({
          contextMenu: () =>
            target instanceof Channel ? (
              <ChannelContextMenu channel={target} />
            ) : target instanceof ServerI ? (
              <ServerSidebarContextMenu server={target} />
            ) : (
              <CategoryContextMenu server={server()} category={target} />
            ),
        })}
      />
    </Show>
  );
};
