"""WhatsApp Message Formatter.

Provides HTML-to-WhatsApp text formatting conversion for message content.

Key dependencies:
    - html: HTML entity unescaping
    - re: Regular expression for HTML tag parsing
"""

import html
import re


def restyle_message_content(message, message_type=None):
    """Convert HTML message content to WhatsApp-compatible formatted text.

    Transforms HTML tags to WhatsApp markdown equivalents:
    - <b>/<strong> -> *text*
    - <i>/<em> -> _text_
    - <strike>/<s>/<del> -> ~text~
    - <a> -> text - url
    - Headers -> *text*
    - Lists -> bullet points

    Args:
        message: The HTML message content to format.
        message_type: If "Template", skips formatting.

    Returns:
        Formatted message string with WhatsApp markdown.
    """
    if message and message_type != "Template":
        return advanced_whatsapp_formatter(message)
    return message


def advanced_whatsapp_formatter(text, strip_newlines=False):
    """Convert rich HTML text to WhatsApp markdown format.

    Args:
        text: HTML text to convert.
        strip_newlines: If True, replaces newlines with spaces.

    Returns:
        WhatsApp-formatted text string.
    """
    if not text:
        return ""
    text = html.unescape(text)
    text = re.sub(
        r'<a[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',
        lambda m: (
            f"{re.sub('<[^>]+>', '', m.group(2)).strip()} - {m.group(1)}"
            if m.group(2).strip()
            else m.group(1)
        ),
        text,
        flags=re.I | re.S,
    )
    text = re.sub(r"<a[^>]*>(https?://[^<]+)</a>", r"\1", text, flags=re.I)
    text = re.sub(r"<(br|p|div|li|tr)[^>]*\/?>", "\n", text, flags=re.I)
    text = re.sub(r"<\/(h[1-6])>", "\n", text, flags=re.I)
    text = re.sub(r"<(h[1-6])[^>]*>", "", text, flags=re.I)
    text = re.sub(r"<(strong|b)[^>]*>", "*", text, flags=re.I)
    text = re.sub(r"<\/(strong|b)>", "*", text, flags=re.I)
    text = re.sub(r"<(em|i)[^>]*>", "_", text, flags=re.I)
    text = re.sub(r"<\/(em|i)>", "_", text, flags=re.I)
    text = re.sub(r"<(strike|s|del)[^>]*>", "~", text, flags=re.I)
    text = re.sub(r"<\/(strike|s|del)>", "~", text, flags=re.I)
    text = re.sub(r"<code[^>]*>", "```", text, flags=re.I)
    text = re.sub(r"<\/code>", "```", text, flags=re.I)
    text = re.sub(r"<pre[^>]*>", "```\n", text, flags=re.I)
    text = re.sub(r"<\/pre>", "\n```", text, flags=re.I)
    text = re.sub(r"<ul[^>]*>", "\n", text, flags=re.I)
    text = re.sub(r"<\/ul>", "\n", text, flags=re.I)
    text = re.sub(r"<li[^>]*>", "\u2022 ", text, flags=re.I)
    text = re.sub(r"<\/li>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    lines = text.split("\n")
    processed = []
    for line in lines:
        line = line.strip()
        if not line:
            processed.append("")
            continue
        if re.match(r"^#{1,6}\s", line):
            processed.append("*" + re.sub(r"^#{1,6}\s+", "", line) + "*")
        elif re.match(r"^[-*+]\s", line):
            processed.append("\u2022 " + re.sub(r"^[-*+]\s+", "", line))
        elif re.match(r"^>\s", line):
            processed.append("_" + re.sub(r"^>\s+", "", line) + "_")
        else:
            processed.append(line)
    text = "\n".join(processed)
    text = re.sub(r"\*\*([^*]+)\*\*", r"*\1*", text)
    text = re.sub(r"__([^_]+)__", r"_\1_", text)
    text = re.sub(r"~~([^~]+)~~", r"~\1~", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    if strip_newlines:
        text = text.replace("\n", " ").strip()
    return text.strip()