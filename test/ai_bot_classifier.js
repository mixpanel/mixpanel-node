// test/ai_bot_classifier.js

// These tests define the expected behavior of the classifier
// Write these BEFORE implementing lib/ai_bot_classifier.js

describe("AiBotClassifier", () => {
  let classify;

  beforeEach(() => {
    const { classify_user_agent } = require("../lib/ai_bot_classifier");
    classify = classify_user_agent;
  });

  // === CORE CLASSIFICATION ===

  describe("classify_user_agent", () => {
    // --- OpenAI Bots ---

    it("should classify GPTBot user agent", () => {
      const result = classify(
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
      );
      expect(result.$is_ai_bot).toBe(true);
      expect(result.$ai_bot_name).toBe("GPTBot");
      expect(result.$ai_bot_provider).toBe("OpenAI");
      expect(result.$ai_bot_category).toBe("indexing");
    });

    it("should classify ChatGPT-User agent", () => {
      const result = classify(
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)",
      );
      expect(result.$is_ai_bot).toBe(true);
      expect(result.$ai_bot_name).toBe("ChatGPT-User");
      expect(result.$ai_bot_provider).toBe("OpenAI");
      expect(result.$ai_bot_category).toBe("retrieval");
    });

    it("should classify OAI-SearchBot agent", () => {
      const result = classify(
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)",
      );
      expect(result.$is_ai_bot).toBe(true);
      expect(result.$ai_bot_name).toBe("OAI-SearchBot");
      expect(result.$ai_bot_provider).toBe("OpenAI");
      expect(result.$ai_bot_category).toBe("indexing");
    });

    // --- Anthropic Bots ---

    it("should classify ClaudeBot agent", () => {
      const result = classify(
        "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
      );
      expect(result.$is_ai_bot).toBe(true);
      expect(result.$ai_bot_name).toBe("ClaudeBot");
      expect(result.$ai_bot_provider).toBe("Anthropic");
      expect(result.$ai_bot_category).toBe("indexing");
    });

    it("should classify Claude-User agent", () => {
      const result = classify("Mozilla/5.0 (compatible; Claude-User/1.0)");
      expect(result.$is_ai_bot).toBe(true);
      expect(result.$ai_bot_name).toBe("Claude-User");
      expect(result.$ai_bot_provider).toBe("Anthropic");
      expect(result.$ai_bot_category).toBe("retrieval");
    });

    // --- Google Bots ---

    it("should classify Google-Extended agent", () => {
      const result = classify("Mozilla/5.0 (compatible; Google-Extended/1.0)");
      expect(result.$is_ai_bot).toBe(true);
      expect(result.$ai_bot_name).toBe("Google-Extended");
      expect(result.$ai_bot_provider).toBe("Google");
      expect(result.$ai_bot_category).toBe("indexing");
    });

    // --- Perplexity ---

    it("should classify PerplexityBot agent", () => {
      const result = classify("Mozilla/5.0 (compatible; PerplexityBot/1.0)");
      expect(result.$is_ai_bot).toBe(true);
      expect(result.$ai_bot_name).toBe("PerplexityBot");
      expect(result.$ai_bot_provider).toBe("Perplexity");
      expect(result.$ai_bot_category).toBe("retrieval");
    });

    // --- ByteDance ---

    it("should classify Bytespider agent", () => {
      const result = classify("Mozilla/5.0 (compatible; Bytespider/1.0)");
      expect(result.$is_ai_bot).toBe(true);
      expect(result.$ai_bot_name).toBe("Bytespider");
      expect(result.$ai_bot_provider).toBe("ByteDance");
    });

    // --- Common Crawl ---

    it("should classify CCBot agent", () => {
      const result = classify("CCBot/2.0 (https://commoncrawl.org/faq/)");
      expect(result.$is_ai_bot).toBe(true);
      expect(result.$ai_bot_name).toBe("CCBot");
      expect(result.$ai_bot_provider).toBe("Common Crawl");
    });

    // --- Apple ---

    it("should classify Applebot-Extended agent", () => {
      const result = classify(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Applebot-Extended/0.1",
      );
      expect(result.$is_ai_bot).toBe(true);
      expect(result.$ai_bot_name).toBe("Applebot-Extended");
      expect(result.$ai_bot_provider).toBe("Apple");
    });

    // --- Meta ---

    it("should classify Meta-ExternalAgent agent", () => {
      const result = classify(
        "Mozilla/5.0 (compatible; Meta-ExternalAgent/1.0)",
      );
      expect(result.$is_ai_bot).toBe(true);
      expect(result.$ai_bot_name).toBe("Meta-ExternalAgent");
      expect(result.$ai_bot_provider).toBe("Meta");
    });

    // --- Cohere ---

    it("should classify cohere-ai agent", () => {
      const result = classify("cohere-ai/1.0 (https://cohere.com)");
      expect(result.$is_ai_bot).toBe(true);
      expect(result.$ai_bot_name).toBe("cohere-ai");
      expect(result.$ai_bot_provider).toBe("Cohere");
      expect(result.$ai_bot_category).toBe("indexing");
    });

    // === NEGATIVE CASES ===

    it("should NOT classify regular Chrome browser as AI bot", () => {
      const result = classify(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      );
      expect(result.$is_ai_bot).toBe(false);
      expect(result.$ai_bot_name).toBeUndefined();
    });

    it("should NOT classify Googlebot (regular) as AI bot", () => {
      const result = classify(
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      );
      expect(result.$is_ai_bot).toBe(false);
    });

    it("should NOT classify Bingbot (regular) as AI bot", () => {
      const result = classify(
        "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      );
      expect(result.$is_ai_bot).toBe(false);
    });

    it("should NOT classify curl as AI bot", () => {
      const result = classify("curl/7.64.1");
      expect(result.$is_ai_bot).toBe(false);
    });

    it("should handle empty user agent", () => {
      const result = classify("");
      expect(result.$is_ai_bot).toBe(false);
    });

    it("should handle undefined user agent", () => {
      const result = classify(undefined);
      expect(result.$is_ai_bot).toBe(false);
    });

    it("should handle null user agent", () => {
      const result = classify(null);
      expect(result.$is_ai_bot).toBe(false);
    });

    // === CASE SENSITIVITY ===

    it("should match case-insensitively", () => {
      const result = classify("Mozilla/5.0 (compatible; gptbot/1.2)");
      expect(result.$is_ai_bot).toBe(true);
      expect(result.$ai_bot_name).toBe("GPTBot");
    });

    // === RETURN SHAPE ===

    it("should return all expected fields for a match", () => {
      const result = classify("GPTBot/1.2");
      expect(result).toHaveProperty("$is_ai_bot", true);
      expect(result).toHaveProperty("$ai_bot_name");
      expect(result).toHaveProperty("$ai_bot_provider");
      expect(result).toHaveProperty("$ai_bot_category");
      expect(typeof result.$ai_bot_name).toBe("string");
      expect(typeof result.$ai_bot_provider).toBe("string");
      expect(["indexing", "retrieval", "agent"]).toContain(
        result.$ai_bot_category,
      );
    });

    it("should return only $is_ai_bot:false for non-matches", () => {
      const result = classify("Mozilla/5.0 Chrome/120");
      expect(Object.keys(result)).toEqual(["$is_ai_bot"]);
      expect(result.$is_ai_bot).toBe(false);
    });
  });

  // === BOT DATABASE ===

  describe("get_bot_database", () => {
    it("should expose the bot database for inspection", () => {
      const { get_bot_database } = require("../lib/ai_bot_classifier");
      const db = get_bot_database();
      expect(Array.isArray(db)).toBe(true);
      expect(db.length).toBeGreaterThan(0);
      expect(db[0]).toHaveProperty("pattern");
      expect(db[0]).toHaveProperty("name");
      expect(db[0]).toHaveProperty("provider");
      expect(db[0]).toHaveProperty("category");
    });
  });

  // === CUSTOM BOTS ===

  describe("custom bot registration", () => {
    it("should allow adding custom bot patterns", () => {
      const { create_classifier } = require("../lib/ai_bot_classifier");
      const classifier = create_classifier({
        additional_bots: [
          {
            pattern: /MyCustomBot\//i,
            name: "MyCustomBot",
            provider: "CustomCorp",
            category: "indexing",
          },
        ],
      });
      const result = classifier("Mozilla/5.0 (compatible; MyCustomBot/1.0)");
      expect(result.$is_ai_bot).toBe(true);
      expect(result.$ai_bot_name).toBe("MyCustomBot");
    });

    it("should check custom bots before built-in bots", () => {
      const { create_classifier } = require("../lib/ai_bot_classifier");
      const classifier = create_classifier({
        additional_bots: [
          {
            pattern: /GPTBot\//i,
            name: "GPTBot-Custom",
            provider: "CustomProvider",
            category: "retrieval",
          },
        ],
      });
      const result = classifier("GPTBot/1.2");
      expect(result.$ai_bot_name).toBe("GPTBot-Custom");
    });
  });
});
