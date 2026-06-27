export function buildWhatsAppShareUrl(message: string): string {
  const text = message.trim();
  if (!text) return "";

  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
