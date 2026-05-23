export const TOPICS = [
  "Economy",
  "AI",
  "Crypto",
  "Politics",
  "Defense",
  "Space",
  "Startups",
  "Technology",
  "Sports",
  "Climate",
  "Commodities",
  "Energy",
  "Healthcare",
  "Trade",
] as const;
export type Topic = (typeof TOPICS)[number];
