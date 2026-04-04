export function normalizeLinkerInput(input: string): string {
  return input
    .trim()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function looksLikeSmiles(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;

  return /[=#@\[\]\(\)\\/]/.test(trimmed) || /\d/.test(trimmed) || /^[bcnohpsfiklrunagtvmezdxr0-9@+\-\[\]\(\)=#$\\/.]+$/i.test(trimmed);
}