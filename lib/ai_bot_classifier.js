// lib/ai_bot_classifier.js

const AI_BOT_DATABASE = [
  // === OpenAI ===
  {
    pattern: /GPTBot\//i,
    name: "GPTBot",
    provider: "OpenAI",
    category: "indexing",
    description: "OpenAI web crawler for model training data",
    ip_ranges_url: "https://openai.com/gptbot.json",
  },
  {
    pattern: /ChatGPT-User\//i,
    name: "ChatGPT-User",
    provider: "OpenAI",
    category: "retrieval",
    description: "ChatGPT real-time retrieval for user queries (RAG)",
    ip_ranges_url: "https://openai.com/chatgpt-user.json",
  },
  {
    pattern: /OAI-SearchBot\//i,
    name: "OAI-SearchBot",
    provider: "OpenAI",
    category: "indexing",
    description: "OpenAI search indexing crawler",
    ip_ranges_url: "https://openai.com/searchbot.json",
  },

  // === Anthropic ===
  {
    pattern: /ClaudeBot\//i,
    name: "ClaudeBot",
    provider: "Anthropic",
    category: "indexing",
    description: "Anthropic web crawler for model training",
    ip_ranges_url: null, // Anthropic publishes ranges but URL may vary
  },
  {
    pattern: /Claude-User\//i,
    name: "Claude-User",
    provider: "Anthropic",
    category: "retrieval",
    description: "Claude real-time retrieval for user queries",
  },

  // === Google ===
  {
    pattern: /Google-Extended\//i,
    name: "Google-Extended",
    provider: "Google",
    category: "indexing",
    description: "Google AI training data crawler (separate from Googlebot)",
  },

  // === Perplexity ===
  {
    pattern: /PerplexityBot\//i,
    name: "PerplexityBot",
    provider: "Perplexity",
    category: "retrieval",
    description: "Perplexity AI search crawler",
  },

  // === ByteDance ===
  {
    pattern: /Bytespider\//i,
    name: "Bytespider",
    provider: "ByteDance",
    category: "indexing",
    description: "ByteDance/TikTok AI crawler",
  },

  // === Common Crawl ===
  {
    pattern: /CCBot\//i,
    name: "CCBot",
    provider: "Common Crawl",
    category: "indexing",
    description: "Common Crawl bot (data used by many AI models)",
  },

  // === Apple ===
  {
    pattern: /Applebot-Extended\//i,
    name: "Applebot-Extended",
    provider: "Apple",
    category: "indexing",
    description: "Apple AI/Siri training data crawler",
  },

  // === Meta ===
  {
    pattern: /Meta-ExternalAgent\//i,
    name: "Meta-ExternalAgent",
    provider: "Meta",
    category: "indexing",
    description: "Meta/Facebook AI training data crawler",
  },

  // === Cohere ===
  {
    pattern: /cohere-ai\//i,
    name: "cohere-ai",
    provider: "Cohere",
    category: "indexing",
    description: "Cohere AI training data crawler",
  },
];

/**
 * Classify a user-agent string against the AI bot database.
 * @param {string} userAgent - The user-agent string to classify
 * @returns {Object} Classification result with $is_ai_bot and optional bot details
 */
function classify_user_agent(userAgent) {
  if (!userAgent || typeof userAgent !== "string") {
    return { $is_ai_bot: false };
  }

  for (const bot of AI_BOT_DATABASE) {
    if (bot.pattern.test(userAgent)) {
      return {
        $is_ai_bot: true,
        $ai_bot_name: bot.name,
        $ai_bot_provider: bot.provider,
        $ai_bot_category: bot.category,
      };
    }
  }

  return { $is_ai_bot: false };
}

/**
 * Create a classifier with optional additional bot patterns.
 * @param {Object} options
 * @param {Array} options.additional_bots - Additional bot patterns to check (checked first)
 * @returns {Function} A classify_user_agent function
 */
function create_classifier(options) {
  const additional = (options && options.additional_bots) || [];
  const combined = [...additional, ...AI_BOT_DATABASE];

  return function (userAgent) {
    if (!userAgent || typeof userAgent !== "string") {
      return { $is_ai_bot: false };
    }

    for (const bot of combined) {
      if (bot.pattern.test(userAgent)) {
        return {
          $is_ai_bot: true,
          $ai_bot_name: bot.name,
          $ai_bot_provider: bot.provider,
          $ai_bot_category: bot.category,
        };
      }
    }

    return { $is_ai_bot: false };
  };
}

function get_bot_database() {
  return AI_BOT_DATABASE.map((bot) => ({
    pattern: bot.pattern,
    name: bot.name,
    provider: bot.provider,
    category: bot.category,
    description: bot.description || "",
  }));
}

module.exports = { classify_user_agent, create_classifier, get_bot_database };
