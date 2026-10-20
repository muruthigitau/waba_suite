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

/**
 * Serialise common body variables for the campaign's `template_variables`.
 *
 * The bulk sender stores common variables as a JSON array of body values in
 * `{{1}}`, `{{2}}`, ... order.
 *
 * @param template Selected template.
 * @param values Variable values keyed by placeholder index.
 * @returns JSON string, or an empty string when the template has no variables.
 */
export function serializeTemplateVariables(
  template: MessageTemplate | undefined,
  values: Record<string, string>,
): string {
  if (!template?.body_vars?.length) return "";
  return JSON.stringify(
    template.body_vars.map((variable) => (values[variable] || "").trim()),
  );
}

/**
 * Bulk campaigns can only fill body variables.
 *
 * Header/footer placeholders are not resolved by the bulk sender, so templates
 * containing them are disabled in the picker.
 */
export function supportsBulkVariables(template: MessageTemplate): boolean {
  return (
    (template.header_vars?.length || 0) === 0 &&
    (template.footer_vars?.length || 0) === 0
  );
}
