function fold(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function matchesSearch(
  query: string,
  ...values: (string | null | undefined)[]
) {
  const needle = fold(query);
  if (!needle) return true;
  return values.some((value) => fold(value ?? "").includes(needle));
}
