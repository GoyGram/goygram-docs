#!/usr/bin/env python3
"""
Translate GoyGram docs from English to Russian.
Preserves markdown structure: code blocks, inline code, URLs, HTML tags, frontmatter keys.
Uses deep_translator (free Google Translate web interface) with rate limiting.
"""

import os
import re
import time
import sys
from pathlib import Path
from deep_translator import GoogleTranslator

SRC_DIR = Path("content/docs/en")
OUT_DIR = Path("content/docs/ru")
DELAY_SECONDS = 2.5  # conservative delay to avoid rate limits
MAX_CHUNK_LEN = 4500  # Google Translate has ~5000 char limit per request

translator = GoogleTranslator(source="en", target="ru")


def split_frontmatter(text: str):
    """Split markdown into frontmatter dict and body."""
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            fm_raw = parts[1].strip()
            body = parts[2].strip()
            fm = {}
            for line in fm_raw.split("\n"):
                line = line.strip()
                if ":" in line:
                    key, _, val = line.partition(":")
                    fm[key.strip()] = val.strip()
            return fm, body
    return {}, text


def protect_code_blocks(text: str):
    """Replace code blocks and inline code with placeholders. Returns (protected_text, replacements_dict)."""
    placeholders = {}
    counter = [0]

    def next_key():
        counter[0] += 1
        return f"__CODEBLOCK_{counter[0]}__"

    def next_inline():
        counter[0] += 1
        return f"__INLINECODE_{counter[0]}__"

    # Fenced code blocks: ``` ... ```
    def replace_fenced(m):
        key = next_key()
        placeholders[key] = m.group(0)
        return f"\n{key}\n"

    text = re.sub(r"```[\s\S]*?```", replace_fenced, text)

    # Indented code blocks (4 spaces)
    def replace_indented(m):
        key = next_key()
        placeholders[key] = m.group(0)
        return f"\n{key}\n"

    text = re.sub(r"(?:^|\n)(    [^\n]+(?:\n    [^\n]+)*)", replace_indented, text)

    # Inline code: `...`
    def replace_inline(m):
        key = next_inline()
        placeholders[key] = m.group(0)
        return key

    text = re.sub(r"`[^`]+`", replace_inline, text)

    return text, placeholders


def restore_protected(text: str, placeholders: dict):
    """Restore protected code blocks/inline code."""
    for key in sorted(placeholders.keys(), key=len, reverse=True):
        text = text.replace(key, placeholders[key])
    return text


def protect_html_tags(text: str):
    """Replace HTML tags with placeholders."""
    placeholders = {}
    counter = [0]

    def replace_tag(m):
        counter[0] += 1
        key = f"__HTMLTAG_{counter[0]}__"
        placeholders[key] = m.group(0)
        return key

    text = re.sub(r"<[^>]+>", replace_tag, text)
    return text, placeholders


def protect_urls(text: str):
    """Protect markdown links: [text](url) — only the URL part."""
    placeholders = {}
    counter = [0]

    def replace_link(m):
        counter[0] += 1
        key = f"__URL_{counter[0]}__"
        placeholders[key] = m.group(2)  # the URL part
        # Keep the link text for translation, but protect the URL
        return f"[{m.group(1)}]({key})"

    text = re.sub(r"\[([^\]]*)\]\((https?://[^)\s]+)\)", replace_link, text)
    text = re.sub(r"\[([^\]]*)\]\(([./][^)\s]+)\)", replace_link, text)
    return text, placeholders


def protect_frontmatter_like(text: str):
    """Protect key: value lines that look like frontmatter."""
    placeholders = {}
    counter = [0]

    def replace_kv(m):
        counter[0] += 1
        key = f"__FM_{counter[0]}__"
        placeholders[key] = m.group(0)
        return key

    text = re.sub(r"^(\w[\w\s]*):\s*(.+)$", replace_kv, text, flags=re.MULTILINE)
    return text, placeholders


def chunk_text(text: str, max_len: int = MAX_CHUNK_LEN):
    """Split text into chunks at sentence/paragraph boundaries."""
    if len(text) <= max_len:
        return [text]

    chunks = []
    paragraphs = text.split("\n\n")
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 <= max_len:
            current = (current + "\n\n" + para) if current else para
        else:
            if current:
                chunks.append(current)
            current = para

    if current:
        chunks.append(current)

    # If any single chunk is still too long, split by sentences
    final_chunks = []
    for chunk in chunks:
        if len(chunk) <= max_len:
            final_chunks.append(chunk)
        else:
            sentences = re.split(r"(?<=[.!?])\s+", chunk)
            sub = ""
            for s in sentences:
                if len(sub) + len(s) + 1 <= max_len:
                    sub = (sub + " " + s) if sub else s
                else:
                    if sub:
                        final_chunks.append(sub)
                    sub = s
            if sub:
                final_chunks.append(sub)

    return final_chunks


def translate_text(text: str) -> str:
    """Translate text, handling long texts by chunking."""
    if not text or not text.strip():
        return text

    # Skip pure whitespace/symbol strings
    stripped = text.strip()
    if not any(c.isalpha() for c in stripped):
        return text

    chunks = chunk_text(text)
    if len(chunks) == 1:
        try:
            result = translator.translate(text)
            return result if result else text
        except Exception as e:
            print(f"  Translate error: {e}, keeping original")
            return text

    # Multiple chunks — translate individually
    translated_chunks = []
    for i, chunk in enumerate(chunks):
        try:
            result = translator.translate(chunk)
            translated_chunks.append(result if result else chunk)
            if i < len(chunks) - 1:
                time.sleep(0.5)
        except Exception as e:
            print(f"  Translate chunk error: {e}, keeping original")
            translated_chunks.append(chunk)

    return "\n\n".join(translated_chunks)


def process_text(text: str) -> str:
    """
    Process markdown text for translation:
    1. Protect code blocks, inline code, HTML tags, URLs
    2. Translate remaining text
    3. Restore protected elements
    """
    # Step 1: Protect code blocks
    text, code_placeholders = protect_code_blocks(text)

    # Step 2: Protect HTML tags
    text, html_placeholders = protect_html_tags(text)

    # Step 3: Protect URLs in links
    text, url_placeholders = protect_urls(text)

    # Step 4: Translate the rest
    translated = translate_text(text)

    # Step 5: Restore in reverse order
    translated = restore_protected(translated, url_placeholders)
    translated = restore_protected(translated, html_placeholders)
    translated = restore_protected(translated, code_placeholders)

    return translated


def translate_file(src_path: Path):
    """Translate a single markdown file."""
    out_path = OUT_DIR / src_path.name

    with open(src_path, "r", encoding="utf-8") as f:
        content = f.read()

    fm, body = split_frontmatter(content)

    # Translate frontmatter values that are human-readable
    translated_fm = {}
    for k, v in fm.items():
        if k in ("title", "description", "sidebarTitle"):
            translated_fm[k] = translate_text(v)
        else:
            translated_fm[k] = v

    # Translate body
    if body.strip():
        translated_body = process_text(body)
    else:
        translated_body = body

    # Reconstruct
    lines = ["---"]
    for k, v in translated_fm.items():
        val = v.replace('"', '\\"')
        lines.append(f'{k}: "{val}"')
    lines.append("---")
    lines.append("")
    lines.append(translated_body)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    return True


def main():
    src_files = sorted(SRC_DIR.glob("*.md"))
    if not src_files:
        print(f"No .md files found in {SRC_DIR}")
        return 1

    print(f"Found {len(src_files)} files to translate")
    print(f"Rate limit: {DELAY_SECONDS}s between files")
    print()

    failed = []
    for i, path in enumerate(src_files, 1):
        print(f"[{i}/{len(src_files)}] {path.name} ... ", end="", flush=True)
        try:
            translate_file(path)
            print("OK")
        except Exception as e:
            print(f"FAILED: {e}")
            failed.append(path.name)

        if i < len(src_files):
            time.sleep(DELAY_SECONDS)

    print()
    if failed:
        print(f"Failed: {', '.join(failed)}")
        return 1
    else:
        print("All files translated successfully!")
        return 0


if __name__ == "__main__":
    sys.exit(main())
