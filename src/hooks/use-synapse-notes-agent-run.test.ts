import { createElement, StrictMode, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSynapseNotesAgentRun } from "./use-synapse-notes-agent-run";

const mocks = vi.hoisted(() => ({
  channelNames: [] as string[],
  channels: new Map<string, { on: () => unknown; subscribe: () => unknown }>(),
  removeChannel: vi.fn().mockResolvedValue("ok"),
}));

vi.mock("framer-motion", () => ({
  useReducedMotion: () => true,
}));

vi.mock("@/integrations/supabase/client", () => {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    order: () => Promise.resolve({ data: [], error: null }),
  };

  return {
    supabase: {
      from: () => query,
      channel: (name: string) => {
        mocks.channelNames.push(name);
        const existing = mocks.channels.get(name);
        if (existing) return existing;

        let subscribed = false;
        const channel = {
          on: () => {
            if (subscribed) throw new Error("cannot add postgres_changes callbacks after subscribe()");
            return channel;
          },
          subscribe: () => {
            subscribed = true;
            return channel;
          },
        };
        mocks.channels.set(name, channel);
        return channel;
      },
      removeChannel: mocks.removeChannel,
    },
  };
});

describe("useSynapseNotesAgentRun", () => {
  beforeEach(() => {
    mocks.channelNames.length = 0;
    mocks.channels.clear();
    mocks.removeChannel.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses a new Realtime topic for a remount while the prior channel is closing", async () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.1).mockReturnValueOnce(0.2);
    const wrapper = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children);
    const { unmount } = renderHook(() => useSynapseNotesAgentRun("run-1"), { wrapper });

    await waitFor(() => expect(mocks.channelNames).toHaveLength(2));
    expect(new Set(mocks.channelNames)).toHaveLength(2);

    unmount();
  });
});
