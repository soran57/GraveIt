export interface UserProfile {
  id: number;
  google_id: string;
  email: string;
  display_name: string;
  avatar_url: string;
}

export interface Grave {
  id: number;
  user_id: number;
  owner_name: string;
  avatar_url: string;
  x_coord: number;
  y_coord: number;
  size_type: "small" | "medium" | "large";
  width: number;
  height: number;
  epitaph_title: string;
  epitaph_text: string;
  image_url?: string;
  style_index: number;
  created_at: string;
  color?: string;
  views?: number;
  flowers?: number;
  has_flowered?: boolean;
}

export type SizeCategory = "small" | "medium" | "large";

export interface TombstoneStyle {
  index: number;
  name: string;
  description: string;
  width: number;
  height: number;
  color: string;
  price: number;
  premium: boolean;
}

export const SIZE_PRICES: Record<SizeCategory, number> = {
  small: 4.99,
  medium: 9.99,
  large: 14.99,
};

export const TOMBSTONE_STYLES: TombstoneStyle[] = [
  { index: 0, name: "Classic Slate", description: "Timeless granite arched tablet.", width: 1, height: 1, color: "#4b4b4b", price: 0, premium: false },
  { index: 1, name: "Simple Cross", description: "Modest wooden cross.", width: 1, height: 1, color: "#3a3a3a", price: 0, premium: false },
  { index: 2, name: "Gothic Marble", description: "Ornate dark marble cross on steps.", width: 1, height: 1, color: "#555", price: 0, premium: false },
  { index: 3, name: "Celtic Loop", description: "Engraved stone loop with woven patterns.", width: 2, height: 1, color: "#2a2a2a", price: 0, premium: false },
  { index: 4, name: "Hero Sarcophagus", description: "Classical stone ledger flat vault.", width: 2, height: 2, color: "#606060", price: 0, premium: false },
  { index: 5, name: "Angel Sentinel", description: "Weeping angel stone statue.", width: 2, height: 2, color: "#888", price: 0, premium: false },
];
