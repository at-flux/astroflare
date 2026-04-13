export function compactInlineScript(source: string): string {
  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && idx < arr.length - 1));
  return lines.join("\n").trim();
}
