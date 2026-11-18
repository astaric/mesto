/** Pizza ingredients and orders. Every ingredient `k` has a 500x500 layer texture `pizza-${k}` that stacks on `pizza-testo`. */
export const INGREDIENTS = ['omaka', 'sir', 'bazilika', 'sunka', 'gobe', 'oljke', 'paprika', 'ananas', 'salama'] as const;
export type Ingredient = typeof INGREDIENTS[number];

export interface Pizza { name: string; base: Ingredient[]; toppings: Ingredient[] }

/** Sauce first, then cheese (the base); the toppings go on top in any order. */
const BASE: Ingredient[] = ['omaka', 'sir'];
const pizza = (name: string, ...toppings: Ingredient[]): Pizza => ({ name, base: BASE, toppings });

/** Easy -> hard: customer 1 gets a pizza from tier 0, customer 2 from tier 1, customer 3 from tier 2. */
export const TIERS: Pizza[][] = [
  [pizza('Margherita', 'bazilika'), pizza('Šunka', 'sunka'), pizza('Salama', 'salama')],
  [pizza('Gobova', 'gobe'), pizza('Havaj', 'sunka', 'ananas')],
  [pizza('Kapricoza', 'sunka', 'gobe', 'oljke'), pizza('Zelenjavna', 'paprika', 'gobe', 'oljke')],
];

/** The ingredients the customer's picture shows, bottom to top. */
export const layersOf = (p: Pizza): Ingredient[] => [...p.base, ...p.toppings];

/** Correct = sauce then cheese first, then exactly the toppings (any order, nothing missing or extra). */
export function check(order: Ingredient[], p: Pizza): boolean {
  if (order.length !== p.base.length + p.toppings.length) return false;
  if (!p.base.every((b, i) => order[i] === b)) return false;
  const rest = order.slice(p.base.length).sort();
  const want = [...p.toppings].sort();
  return rest.every((k, i) => k === want[i]);
}
