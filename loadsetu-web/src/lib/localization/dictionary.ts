// dictionary.ts
// Hinglish localization layer for LoadSetu
// Rule: UI labels stay English; help/status text switches to Hinglish when
// the backend reports detected_language = "hi"

export type LangKey = "en" | "hi";

const dictionary = {
  // ── Status text ──────────────────────────────────────────────
  truck_moving: {
    en: "Truck is moving",
    hi: "Truck move ho raha hai",
  },
  truck_empty: {
    en: "Truck is empty — needs a load",
    hi: "Truck khali hai — load chahiye",
  },
  truck_idle: {
    en: "Truck is idle",
    hi: "Truck abhi ruka hua hai",
  },
  truck_offline: {
    en: "Truck is offline",
    hi: "Truck off hai, signal nahi",
  },
  load_matched: {
    en: "Load matched successfully",
    hi: "Load mil gaya! Booking karo",
  },
  booking_confirmed: {
    en: "Booking confirmed. Kafka event published.",
    hi: "Booking pakki! Aap chalna shuru kar sakte ho.",
  },
  finding_loads: {
    en: "Scanning 50km radius for loads…",
    hi: "50km mein loads dhoondh rahe hain…",
  },
  no_loads_found: {
    en: "No loads found in this area",
    hi: "Is area mein abhi koi load nahi mila",
  },
  // ── Help text ──────────────────────────────────────────────
  help_how_to_match: {
    en: "Click an empty truck on the map to find nearby loads.",
    hi: "Map par khali truck click karo — nearby loads dikhenge.",
  },
  help_bulk_upload: {
    en: "Drag & drop an Excel or CSV file to upload multiple loads at once.",
    hi: "Excel ya CSV file yahan drop karo — ek baar mein bahut saare loads upload hote hain.",
  },
  help_whatsapp: {
    en: "Send a WhatsApp voice note to book instantly.",
    hi: "WhatsApp par voice note bhejo aur turant book karo.",
  },
  // ── Error messages ────────────────────────────────────────────
  error_network: {
    en: "Network error. Check your connection.",
    hi: "Network problem hai. Internet check karo.",
  },
  error_rate_limit: {
    en: "Too many requests. Please wait",
    hi: "Bahut zyada requests ho gayi. Thoda ruko",
  },
  error_auth: {
    en: "Session expired. Please log in again.",
    hi: "Session khatam hua. Dobara login karo.",
  },
  // ── UI action labels ──────────────────────────────────────────
  book_load: { en: "Book Load", hi: "Load Book Karo" },
  find_matches: { en: "Find Matches", hi: "Matches Dhoondo" },
  upload_loads: { en: "Upload Loads", hi: "Loads Upload Karo" },
  view_on_map: { en: "View on Map", hi: "Map par dekho" },
  confirm: { en: "Confirm", hi: "Pakka Karo" },
  cancel: { en: "Cancel", hi: "Rehne Do" },
  // ── Platform status ───────────────────────────────────────────
  platform_connected: {
    en: "Platform Connected",
    hi: "System chal raha hai",
  },
  platform_degraded: {
    en: "Degraded — using fallback",
    hi: "Thodi problem hai — backup mode mein chal raha",
  },
  platform_offline: {
    en: "Platform Offline",
    hi: "System band hai",
  },
} as const;

export type DictKey = keyof typeof dictionary;

/**
 * Get a localized string.
 * Falls back to English if key or lang is missing.
 */
export function t(key: DictKey, lang: LangKey = "en"): string {
  const entry = dictionary[key];
  if (!entry) return key;
  return entry[lang] ?? entry["en"];
}

/**
 * React hook – reads language from Zustand auth store.
 * Usage: const { t } = useLocale(); then t("truck_moving")
 */
export function createLocale(lang: LangKey) {
  return {
    t: (key: DictKey) => t(key, lang),
    lang,
  };
}
