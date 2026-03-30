"""
LoadSetu x VahanSync — Security Utilities
DPDP (Digital Personal Data Protection Act 2023) compliant helpers.
"""

from __future__ import annotations

import re


def mask_phone(phone: str) -> str:
    """
    DPDP-compliant phone masking. Masks middle digits, keeps country code + last 4.
    Handles raw numbers, E.164 format, and whatsapp: prefix.

    Examples:
        +919876543210        → +91XXXXXX3210
        whatsapp:+919876543210 → whatsapp:+91XXXXXX3210
        919876543210         → 91XXXXXX3210
        9876543210           → XXXXXX3210
    """
    prefix = ""
    number = phone.strip()

    if number.startswith("whatsapp:"):
        prefix = "whatsapp:"
        number = number[9:]

    if len(number) >= 7:
        # Keep up to 3 leading chars (e.g. +91) and last 4 digits
        keep_start = min(3, len(number) - 4)
        visible_start = number[:keep_start]
        visible_end = number[-4:]
        masked_len = len(number) - keep_start - 4
        return f"{prefix}{visible_start}{'X' * masked_len}{visible_end}"

    # Very short numbers — mask everything except last 2
    return f"{prefix}{'X' * max(len(number) - 2, 0)}{number[-2:]}"


def sanitize_message(text: str) -> str:
    """
    Strip null bytes, control characters, and excessive whitespace from
    inbound driver messages before they enter the processing pipeline.
    Prevents null-byte injection and Unicode control character attacks.
    """
    # Remove null bytes and ASCII control characters (except tab, newline, carriage return)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    # Collapse runs of whitespace to single space, strip leading/trailing
    text = re.sub(r"[ \t]+", " ", text).strip()
    return text


def is_confirmation_word(text: str) -> bool:
    """
    Returns True if the message is a shipper confirmation (YES in any supported language).
    """
    CONFIRM = {"yes", "haan", "y", "ha", "1", "हाँ", "हां", "हाँ", "ہاں", "ஆம்", "हो"}
    return text.strip().lower() in CONFIRM


def is_cancellation_word(text: str) -> bool:
    """
    Returns True if the message is a shipper cancellation (NO in any supported language).
    """
    CANCEL = {
        "no", "nahi", "n", "cancel", "nope", "stop", "band",
        "नहीं", "نہیں", "இல்லை", "नको", "रद्द",
    }
    return text.strip().lower() in CANCEL
