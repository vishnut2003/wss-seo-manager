/**
 * Reduce any user-entered URL to a bare domain name.
 * e.g. "https://www.Example.com/path?q=1" -> "example.com"
 */
export function toDomain(input: string): string {
  let value = input.trim().toLowerCase();
  if (!value) return "";

  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    value = url.hostname;
  } catch {
    value = value
      .replace(/^[a-z]+:\/\//, "")
      .split("/")[0]
      .split("?")[0]
      .split("#")[0];
  }

  return value.replace(/^www\./, "");
}
