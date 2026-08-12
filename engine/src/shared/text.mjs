export function cleanText(value = "") {
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function shortText(value = "", maxLength = 100) {
  const cleaned = cleanText(value);
  if (!cleaned || cleaned.length > maxLength) return "";
  return cleaned;
}

export function titleCase(value = "") {
  return cleanText(value).replace(/\b\w/g, (character) =>
    character.toUpperCase(),
  );
}

export function isLikelyHash(value = "") {
  const compact = cleanText(value).replace(/\s/g, "");
  return (
    compact.length >= 8 &&
    /^[a-z0-9_-]+$/i.test(compact) &&
    /[a-z]/i.test(compact) &&
    /\d/.test(compact)
  );
}
