import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

/**
 * The crew log's offline worker (`public/voyage-sw.js`), run against a pretend
 * browser and a pretend server that can publish a new build, answer slowly, or
 * not answer at all. What matters: with the dish off, the log always opens.
 */
const source = readFileSync(new URL("../../public/voyage-sw.js", import.meta.url), "utf8");
const ORIGIN = "https://site.test";

const build = (name: string): Record<string, string> => ({
  "/index.html": `<script src="/assets/index-${name}.js"></script><link href="/assets/index-${name}.css">`,
  [`/assets/index-${name}.js`]: "entry",
  [`/assets/index-${name}.css`]: "styles",
  // Loaded by the page once it runs; the page itself does not name them.
  [`/assets/VoyageLogPage-${name}.js`]: "log page",
  [`/assets/voyageApi-${name}.js`]: "shared",
});

class Answer {
  type = "basic";
  constructor(public body: string, public ok = true) {}
  clone() {
    return new Answer(this.body, this.ok);
  }
  async text() {
    return this.body;
  }
}

const world = () => {
  const state = { live: "OLD", network: "fast" as "fast" | "slow" | "offline" };
  const pathOf = (input: string | { url: string }) =>
    new URL(typeof input === "string" ? input : input.url, ORIGIN).pathname;

  const fetchFake = async (input: string | { url: string; mode?: string }) => {
    if (state.network === "offline") {
      throw new TypeError("Failed to fetch");
    }
    const navigating = typeof input !== "string" && input.mode === "navigate";
    if (state.network === "slow" && navigating) {
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    const files = build(state.live);
    const body = navigating ? files["/index.html"] : files[pathOf(input)];
    return body === undefined ? new Answer("not found", false) : new Answer(body);
  };

  const saved = new Map<string, Answer>();
  const cache = {
    match: async (key: string | { url: string }) => saved.get(pathOf(key)),
    add: async (url: string) => {
      const answer = await fetchFake(url);
      if (!answer.ok) {
        throw new Error("not saved");
      }
      saved.set(pathOf(url), answer);
    },
    put: async (key: string | { url: string }, answer: Answer) => {
      saved.set(pathOf(key), answer);
    },
  };

  const listeners: Record<string, (event: unknown) => void> = {};
  vm.runInNewContext(
    // The worker waits three seconds for the page before using its saved copy; the test, far less.
    source.replace("const SLOW_NETWORK_MS = 3000;", "const SLOW_NETWORK_MS = 20;"),
    {
      self: {
        location: { origin: ORIGIN },
        addEventListener: (type: string, listener: (event: unknown) => void) => {
          listeners[type] = listener;
        },
        skipWaiting() {},
        clients: { claim: async () => {} },
      },
      caches: { open: async () => cache, keys: async () => [], delete: async () => true },
      fetch: fetchFake,
      URL,
      setTimeout,
      Promise,
    }
  );

  const throughWorker = async (path: string, mode = "no-cors") => {
    const request = { url: ORIGIN + path, method: "GET", mode };
    let answer: Promise<Answer> | null = null;
    listeners.fetch({ request, respondWith: (promise: Promise<Answer>) => (answer = promise) });
    return answer ? await answer : fetchFake(request);
  };

  /**
   * Opens the log as a browser does, then tells the worker what it loaded. Returns
   * the build that opened, or null. `timed: false` is a browser that keeps no record
   * of what it loaded: the page can then only name the files its own tags point to.
   */
  const openLog = async ({ timed = true } = {}): Promise<string | null> => {
    try {
      const page = await throughWorker("/voyage/log", "navigate");
      const name = (await page.clone().text()).includes("OLD") ? "OLD" : "NEW";
      const loaded = Object.keys(build(name)).filter((path) => path !== "/index.html");
      for (const path of loaded) {
        if (!(await throughWorker(path)).ok) {
          return null;
        }
      }
      const inItsTags = loaded.filter((path) => path.startsWith("/assets/index-"));
      let done: Promise<unknown> = Promise.resolve();
      listeners.message({
        data: { type: "precache", urls: ["/index.html", ...(timed ? loaded : inItsTags)] },
        waitUntil: (promise: Promise<unknown>) => (done = promise),
      });
      await done;
      return name;
    } catch {
      return null;
    }
  };

  return { state, openLog, saved };
};

describe("the crew log's offline copy", () => {
  it("opens with no connection once it has been opened with one", async () => {
    const { state, openLog } = world();
    expect(await openLog()).toBe("OLD");
    state.network = "offline";
    expect(await openLog()).toBe("OLD");
  });

  it("moves on to a new version after a visit that really loads it", async () => {
    const { state, openLog } = world();
    await openLog();
    state.live = "NEW";
    expect(await openLog()).toBe("NEW");
    state.network = "offline";
    expect(await openLog()).toBe("NEW");
  });

  it("still opens offline when the first visit after a new version was answered slowly", async () => {
    const { state, openLog, saved } = world();
    await openLog();

    // A new version is published. The page takes too long, so the saved one is shown.
    state.live = "NEW";
    state.network = "slow";
    expect(await openLog()).toBe("OLD");
    // The saved copy must still be one whole build, not the new page with the old scripts.
    expect(await saved.get("/index.html")?.text()).toContain("OLD");

    state.network = "offline";
    expect(await openLog()).toBe("OLD");
  });

  it("is kept as well by a browser that has no record of the files it loaded", async () => {
    const { state, openLog, saved } = world();
    // The page still names the script and the stylesheet in its own tags.
    expect(await openLog({ timed: false })).toBe("OLD");
    expect(saved.has("/index.html")).toBe(true);
    state.network = "offline";
    expect(await openLog({ timed: false })).toBe("OLD");
  });

  it("never opens without a connection on a device that has not opened it before", async () => {
    const { state, openLog } = world();
    state.network = "offline";
    expect(await openLog()).toBeNull();
  });
});
