export interface AiBotEntry {
  pattern: RegExp;
  name: string;
  provider: string;
  category: "indexing" | "retrieval" | "agent";
  description?: string;
  ip_ranges_url?: string;
}

export interface AiBotClassification {
  $is_ai_bot: boolean;
  $ai_bot_name?: string;
  $ai_bot_provider?: string;
  $ai_bot_category?: "indexing" | "retrieval" | "agent";
}

export function classify_user_agent(
  userAgent: string | null | undefined,
): AiBotClassification;
export function create_classifier(options: {
  additional_bots?: AiBotEntry[];
}): (userAgent: string) => AiBotClassification;
export function get_bot_database(): AiBotEntry[];
