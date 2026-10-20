// Turns Arabic-Indic digits (٠-٩) into 0-9, so "٢٠٧" and "207" mean the same thing in search and inputs.
export function normalizeDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
}
