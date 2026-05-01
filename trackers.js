/* ============================================================================
 *  Eleòra Anchors — Tracking parameters list
 *  https://github.com/eleora-dev/anchors
 *  License: MIT
 *
 *  Add or remove entries here to keep the list up to date.
 *  All comparisons in anchors.js are case-insensitive (lowercased at runtime).
 *  ============================================================================ */

const TRACKING_PARAMS = new Set([
    // ── UTM (universal) ───────────────────────────────────────────────────────
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
    "utm_source_platform",
    "utm_creative_format",
    "utm_marketing_tactic",

    // ── Google Ads ────────────────────────────────────────────────────────────
    "gclid",
    "gclsrc",
    "dclid",
    "gbraid",
    "wbraid",

    // ── Meta / Facebook ───────────────────────────────────────────────────────
    "fbclid",
    "fb_action_ids",
    "fb_action_types",
    "fb_ref",
    "fb_source",

    // ── Microsoft Ads ─────────────────────────────────────────────────────────
    "msclkid",

    // ── TikTok ────────────────────────────────────────────────────────────────
    "ttclid",

    // ── Twitter / X ───────────────────────────────────────────────────────────
    "twclid",

    // ── Mailchimp ─────────────────────────────────────────────────────────────
    "mc_cid",
    "mc_eid",

    // ── HubSpot ───────────────────────────────────────────────────────────────
    "_hsenc",
    "_hsmi",
    "__hssc",
    "__hstc",
    "__hsfp",
    "hsctaTracking",

    // ── Marketo ───────────────────────────────────────────────────────────────
    "mkt_tok",

    // ── Instagram ─────────────────────────────────────────────────────────────
    "igshid",

    // ── Pinterest ─────────────────────────────────────────────────────────────
    "epik",

    // ── Spotify ───────────────────────────────────────────────────────────────
    "si",

    // ── Omnisend / Vero / Ometria ─────────────────────────────────────────────
    "oly_anon_id",
    "oly_enc_id",
    "vero_id",

    // ── Zanox / Awin ──────────────────────────────────────────────────────────
    "zanpid",

    // ── Amazon (affiliation) ──────────────────────────────────────────────────
    "tag",
    "ref_",

    // ── Yandex ────────────────────────────────────────────────────────────────
    "yclid",

    // ── LinkedIn Ads ──────────────────────────────────────────────────────────
    "li_fat_id",

    // ── Snapchat Ads ──────────────────────────────────────────────────────────
    "sccid",

    // ── Adobe Analytics / Advertising Cloud ───────────────────────────────────
    "s_cid",
    "s_kwcid",
    "ef_id",

    // ── Impact (affiliate network) ────────────────────────────────────────────
    "irclickid",

    // ── ShareASale ────────────────────────────────────────────────────────────
    "sscid",

    // ── Generic click IDs ─────────────────────────────────────────────────────
    "eid",
    "cmpid",
    "cid",
    "trk",
    "trkCampaign",
]);
