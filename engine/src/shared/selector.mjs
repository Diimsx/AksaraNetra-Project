export function firstSimpleSelector(axeNode) {
  const target = axeNode?.target;
  if (!Array.isArray(target) || target.length !== 1) return null;
  return typeof target[0] === "string" ? target[0] : null;
}

export function uniqueSelectors(nodes = []) {
  return [
    ...new Set(
      nodes
        .map(firstSimpleSelector)
        .filter((selector) => typeof selector === "string"),
    ),
  ];
}
