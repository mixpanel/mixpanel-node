import { IncomingMessage } from "http";

export interface BotClassificationOptions {
  user_agent_property?: string;
  property_prefix?: string;
  additional_bots?: Array<{
    pattern: RegExp;
    name: string;
    provider: string;
    category: "indexing" | "retrieval" | "agent";
  }>;
}

export interface BotClassificationController {
  enable(): void;
  disable(): void;
}

export function enable_bot_classification(
  mixpanel: any,
  options?: BotClassificationOptions,
): BotClassificationController;

export function track_request(
  mixpanel: any,
  req: IncomingMessage,
  eventName: string,
  properties?: Record<string, any>,
  callback?: (err?: Error) => void,
): void;
