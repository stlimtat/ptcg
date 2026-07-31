import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { scrapeBulbapediaCard, scrapeBulbapediaCards } from "./scrapeBulbapedia";
import { existsSync, rmSync } from "fs";
import { join } from "path";

describe("scrapeBulbapedia", () => {
  const cacheDir = join(process.cwd(), ".cache", "bulbapedia");

  beforeEach(() => {
    // Clean up cache before each test
    if (existsSync(cacheDir)) {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up cache after each test
    if (existsSync(cacheDir)) {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  describe("scrapeBulbapediaCard", () => {
    it("should parse card HTML correctly", () => {
      const html = `
        <html>
          <h1>Pikachu</h1>
          <p>HP: 40</p>
          <p>Stage: 0</p>
          <p>Retreat Cost: 1</p>
        </html>
      `;

      const card = scrapeBulbapediaCard(html, "pikachu");

      expect(card.name).toBe("Pikachu");
      expect(card.hp).toBe(40);
      expect(card.stage).toBe(0);
      expect(card.retreatCost).toBe(1);
    });

    it("should handle missing fields gracefully", () => {
      const html = `
        <html>
          <h1>Mew</h1>
        </html>
      `;

      const card = scrapeBulbapediaCard(html, "mew");

      expect(card.name).toBe("Mew");
      expect(card.hp).toBeUndefined();
      expect(card.stage).toBe(0);
      expect(card.retreatCost).toBe(0);
    });

    it("should throw if card name is missing", () => {
      const html = `<html><p>No header</p></html>`;

      expect(() => scrapeBulbapediaCard(html, "unknown")).toThrow(
        "Could not parse card name"
      );
    });
  });

  describe("scrapeBulbapediaCards", () => {
    it("should create cache directory when caching HTML", async () => {
      // Mock fetch to avoid network calls
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => `<html><h1>TestCard</h1></html>`,
      });

      await scrapeBulbapediaCards(["TestCard"]);

      expect(existsSync(cacheDir)).toBe(true);

      // Clean up mock
      vi.resetAllMocks();
    });

    it("should handle batch processing with delays", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => `<html><h1>Card</h1></html>`,
      });

      const startTime = Date.now();
      await scrapeBulbapediaCards(["Card1", "Card2"]);
      const elapsed = Date.now() - startTime;

      // Should have at least 500ms delay between 2 requests
      expect(elapsed).toBeGreaterThanOrEqual(500);

      vi.resetAllMocks();
    });

    it("should handle fetch errors gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const cards = await scrapeBulbapediaCards(["FailCard"]);

      // Should return empty array if all fail
      expect(cards).toEqual([]);

      vi.resetAllMocks();
    });

    it("should log progress for each card", async () => {
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation();
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation();

      global.fetch = vi.fn().mockRejectedValue(new Error("Test error"));

      await scrapeBulbapediaCards(["Card1", "Card2"]);

      // Check that progress was logged
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[1/2] Scraping Card1...")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[2/2] Scraping Card2...")
      );

      consoleLogSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      vi.resetAllMocks();
    });
  });
});
