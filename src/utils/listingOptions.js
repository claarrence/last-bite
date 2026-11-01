export const QUANTITY_LEVELS = [
  { value: 'plenty', label: 'Plenty' },
  { value: 'some', label: 'Some left' },
  { value: 'few', label: 'A few' },
  { value: 'unknown', label: 'Not sure' },
]

export const DIETARY_TAGS = ['Halal', 'Vegetarian', 'Vegan', 'No pork/no lard']

export const UNKNOWN_ALLERGEN = 'Unknown'

export const ALLERGENS = [
  'Fish',
  'Shellfish',
  'Peanuts',
  'Tree nuts',
  'Dairy',
  'Egg',
  'Gluten',
  'Soy',
  UNKNOWN_ALLERGEN,
]

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024

export function quantityLevelLabel(value) {
  return QUANTITY_LEVELS.find((level) => level.value === value)?.label ?? ''
}
