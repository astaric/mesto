// For tests: the texture keys Boot will create, i.e. every file in src/art without the extension.
export const artKeys: Set<string> = new Set(
  Object.keys(import.meta.glob('/src/art/*.svg')).map((p) => p.split('/').pop()!.replace('.svg', '')),
);
