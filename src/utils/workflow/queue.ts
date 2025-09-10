export function appendItems(
  prev: ReadonlyArray<string> | undefined,
  items: ReadonlyArray<unknown>,
): Array<string> {
  const base = Array.isArray(prev) ? [...prev] : [];
  const hasProp = <K extends string>(
    obj: unknown,
    key: K,
  ): obj is Record<K, unknown> =>
    typeof obj === "object" &&
    obj != null &&
    key in (obj as Record<string, unknown>);
  const normalized = items.map((i) => {
    if (typeof i === "string") {
      return i;
    }
    if (hasProp(i, "content") && typeof i.content === "string") {
      return i.content as string;
    }
    if (hasProp(i, "text") && typeof i.text === "string") {
      return i.text as string;
    }
    return String(i);
  });
  return [...base, ...normalized];
}

export function shift<T>(arr: ReadonlyArray<T> | undefined): {
  first?: T;
  rest: Array<T>;
} {
  const list = Array.isArray(arr) ? arr : [];
  if (list.length === 0) {
    return { rest: [] };
  }
  const [first, ...rest] = list;
  return { first, rest };
}
