/**
 * Helpers for bulk WhatsApp campaigns and recipient lists.
 *
 * Keeps parsing/normalisation logic out of the modal components so the same
 * rules are used when adding recipients manually, from chats, or from saved
 * contacts.
 */

import type { MessageTemplate, RecipientRow } from "../types/bulk";

/**
 * Reduce a phone number to digits (and an optional leading +) for comparison.
 *
 * @param value Raw phone number.
 * @returns Normalised number used only for duplicate detection.
 */
export function normalizeMobile(value: string): string {
  const trimmed = (value || "").trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

/**
 * Merge new recipients into an existing list, skipping duplicate numbers.
 *
 * @param existing Recipients already in the list.
 * @param incoming Recipients to add.
 * @returns A new array containing `existing` followed by unique `incoming` rows.
 */
export function mergeRecipients(
  existing: RecipientRow[],
  incoming: RecipientRow[],
): RecipientRow[] {
  const seen = new Set(
    existing.map((row) => normalizeMobile(row.mobile_number)),
  );
  const merged = [...existing];

  for (const row of incoming) {
    const key = normalizeMobile(row.mobile_number);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }

  return merged;
}

/**
 * Parse manually entered recipients.
 *
 * Each line contains a number, optionally followed by a name:
 *   `254712345678`
 *   `254712345678, Jane Doe`
 *   `Jane Doe <254712345678>`
 *
 * @param raw Textarea contents.
 * @returns Parsed recipient rows (not yet deduplicated).
 */
export function parseManualRecipients(raw: string): RecipientRow[] {
  return raw
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const angled = line.match(/^(.+?)\s*<([^>]+)>$/);
      if (angled) {
        return {
          mobile_number: angled[2].trim(),
          recipient_name: angled[1].trim(),
        };
      }

      const [number, ...rest] = line.split(",");
      return {
        mobile_number: number.trim(),
        recipient_name: rest.join(",").trim() || undefined,
      };
    })
    .filter((row) => normalizeMobile(row.mobile_number) !== "");
}

/** Template section that contains a `{{n}}` placeholder. */
export type TemplateVariableSection = "header" | "body" | "footer";

/** A single `{{n}}` placeholder in a template section. */
export interface TemplateVariableField {
  section: TemplateVariableSection;
  variable: string;
}

/**
 * Build the state key for a template variable.
 *
 * Header and body placeholders can both be `{{1}}`, so the section is part of
 * the key to keep their values independent.
 *
 * @param field Template variable field.
 * @returns Key in the form `section:variable`.
 */
export function templateVariableKey(field: TemplateVariableField): string {
  return `${field.section}:${field.variable}`;
}

/**
 * List every `{{n}}` placeholder in a template, header first.
 *
 * @param template Selected template.
 * @returns Ordered variable fields.
 */
export function templateVariableFields(
  template: MessageTemplate | undefined,
): TemplateVariableField[] {
  if (!template) return [];
  return (
    [
      ["header", template.header_vars],
      ["body", template.body_vars],
      ["footer", template.footer_vars],
    ] as const
  ).flatMap(([section, variables]) =>
    (variables || []).map((variable) => ({ section, variable })),
  );
}


/**
 * Serialise common template variables for the campaign's `template_variables`.
 *
 * Values are stored as an object with positional lists for each section:
 * `{"header": ["..."], "body": ["..."], "footer": ["..."]}`. The bulk sender
 * falls back to a plain body list for documents saved by older clients.
 *
 * @param template Selected template.
 * @param values Variable values keyed by `section:variable`.
 * @returns JSON string, or an empty string when the template has no variables.
 */
export function serializeTemplateVariables(
  template: MessageTemplate | undefined,
  values: Record<string, string>,
): string {
  const fields = templateVariableFields(template);
  if (fields.length === 0) return "";

  const payload: Record<TemplateVariableSection, string[]> = {
    header: [],
    body: [],
    footer: [],
  };
  for (const field of fields) {
    payload[field.section].push((values[templateVariableKey(field)] || "").trim());
  }
  return JSON.stringify(payload);
}

/** Media type required by a template header. */
export type TemplateAttachmentKind = "image" | "document" | null;

/**
 * Return the attachment kind required by a template header.
 *
 * @param template Selected template.
 * @returns `"image"`, `"document"`, or `null` for text/empty headers.
 */
export function templateAttachmentKind(
  template: MessageTemplate | undefined,
): TemplateAttachmentKind {
  const headerType = (template?.header_type || "").trim().toUpperCase();
  if (headerType === "IMAGE") return "image";
  if (headerType === "DOCUMENT") return "document";
  return null;
}
