import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFxQuote, parseFawaz, parseYahooChart } from "@/lib/fx/rate-sources";

// Yahoo FX daily bars: midnight London (BST, gmtoffset 3600) = 23:00 UTC of
// the previous day = 18:00 Bogotá of the previous day.
const DAY = 86_400;
const SEP23_LONDON = Date.UTC(2026, 8, 22, 23) / 1000;
const TS = [SEP23_LONDON, SEP23_LONDON + DAY, SEP23_LONDON + 2 * DAY];

function yahooPayload(closes: (number | null)[], live?: number) {
  return {
    chart: {
      result: [
        {
          meta: live === undefined ? { gmtoffset: 3600 } : { regularMarketPrice: live, gmtoffset: 3600 },
          timestamp: TS.slice(0, closes.length),
          indicators: { quote: [{ close: closes }] },
        },
      ],
    },
  };
}

describe("parseYahooChart", () => {
  it("uses the live price and dates bars in the exchange's timezone", () => {
    const parsed = parseYahooChart(yahooPayload([3310.5, null, 3301.2], 3299.28));
    expect(parsed?.rate).toBe(3299.28);
    expect(parsed?.history).toEqual([
      { date: "2026-09-23", rate: 3310.5 },
      { date: "2026-09-25", rate: 3301.2 },
    ]);
  });

  it("falls back to the last close without a live price", () => {
    expect(parseYahooChart(yahooPayload([3310.5, 3305]))?.rate).toBe(3305);
  });

  it("rejects empty or malformed payloads", () => {
    expect(parseYahooChart({})).toBeNull();
    expect(parseYahooChart({ chart: { result: [] } })).toBeNull();
    expect(parseYahooChart(yahooPayload([null, null]))).toBeNull();
  });
});

describe("parseFawaz", () => {
  it("reads the nested {from: {to}} shape", () => {
    expect(parseFawaz({ date: "2026-09-25", usd: { cop: 3300.1 } }, "usd", "cop")).toBe(3300.1);
  });

  it("rejects the flat shape the old single-pair endpoint returned", () => {
    // The old code read data.cop off /usd/cop.json — that's why the rate froze.
    expect(parseFawaz({ cop: 3300.1 }, "usd", "cop")).toBeNull();
    expect(parseFawaz({ usd: { cop: 0 } }, "usd", "cop")).toBeNull();
  });
});

describe("fetchFxQuote", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("prefers Yahoo", async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => Response.json(yahooPayload([3310], 3299.28)));
    vi.stubGlobal("fetch", fetchMock);
    const quote = await fetchFxQuote("USD", "COP");
    expect(quote).toMatchObject({ rate: 3299.28, source: "yahoo" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("USDCOP%3DX?range=5d");
  });

  it("asks for 3 months when history is wanted", async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => Response.json(yahooPayload([3310], 3299.28)));
    vi.stubGlobal("fetch", fetchMock);
    await fetchFxQuote("USD", "COP", { withHistory: true });
    expect(String(fetchMock.mock.calls[0][0])).toContain("range=3mo");
  });

  it("falls back to fawazahmed0 when Yahoo fails", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("yahoo")
        ? new Response("rate limited", { status: 429 })
        : Response.json({ usd: { cop: 3301 } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await fetchFxQuote("USD", "COP")).toEqual({ rate: 3301, history: [], source: "fawazahmed0" });
  });

  it("returns null when every source fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await fetchFxQuote("USD", "COP")).toBeNull();
  });
});
