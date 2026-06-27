const letter = "A-Za-z\\u00c0-\\u00ff";
const isolatedUppercasePattern = new RegExp(`(^|[^${letter}])[A-Z](?=$|[^${letter}])`);
const brokenAccentPattern = new RegExp(
  `(^|[^${letter}])(jo o|jos|vit ria|gon alves|f lix|rom rio|paix o|le o|j lia|ara jo|m lo|am rico|dom cio|tha any|simi o|mois s|pedr o)(?=$|[^${letter}])`,
  "i",
);

export function needsNameReview(name: string): boolean {
  const normalized = name.trim();
  if (!normalized) return false;

  if (isolatedUppercasePattern.test(normalized)) return true;

  return brokenAccentPattern.test(normalized);
}
