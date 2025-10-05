import type { Category } from '../types';

interface CategoryImportBlueprint {
  type: Category['type'];
  tags?: string[];
}

const DEFAULT_CATEGORY_BLUEPRINTS: Record<string, CategoryImportBlueprint> = {
  'groceries daily supplies': { type: 'expense', tags: ['groceries', 'essentials'] },
  'bills maintenance': { type: 'expense', tags: ['bill', 'utilities'] },
  'loans insurance': { type: 'expense', tags: ['commitments'] },
  travel: { type: 'expense', tags: ['leisure'] },
  'family essentials': { type: 'expense', tags: ['family'] },
  'miscellaneous or unplanned': { type: 'expense', tags: ['misc'] }
};

export interface CategoryImportEntry {
  name: string;
  type: Category['type'];
  tags: string[];
  parentName?: string;
}

export interface CategoryImportResult {
  entries: CategoryImportEntry[];
  warnings: string[];
  errors: string[];
}

const CATEGORY_TYPES: Category['type'][] = ['income', 'expense', 'asset', 'liability'];

const normaliseWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

export const normaliseCategoryName = (value: string): string =>
  normaliseWhitespace(value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

const deriveTagsFromLabel = (label: string): string[] => {
  const slug = slugify(label);
  const parts = slug.split('-').filter(Boolean);
  const unique = new Set(parts);
  if (slug) {
    unique.add(slug);
  }
  return Array.from(unique);
};

const sanitiseTag = (value: string): string | null => {
  const slug = slugify(value);
  return slug.length > 0 ? slug : null;
};

const sanitiseTags = (tags: Iterable<string>): string[] => {
  const unique = new Set<string>();
  for (const tag of tags) {
    const sanitised = sanitiseTag(tag);
    if (sanitised) {
      unique.add(sanitised);
    }
  }
  return Array.from(unique);
};

const resolveCategoryType = (name: string, providedType?: unknown): Category['type'] => {
  if (typeof providedType === 'string') {
    const candidate = providedType.toLowerCase();
    if ((CATEGORY_TYPES as string[]).includes(candidate)) {
      return candidate as Category['type'];
    }
  }
  const blueprint = DEFAULT_CATEGORY_BLUEPRINTS[normaliseCategoryName(name)];
  return blueprint?.type ?? 'expense';
};

const extractProvidedTags = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return value
      .split(/[,|]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  }
  return [];
};

const ensureString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

const registerEntry = (
  entry: CategoryImportEntry,
  entries: CategoryImportEntry[],
  warnings: string[]
) => {
  const key = `${normaliseCategoryName(entry.parentName ?? 'root')}::${normaliseCategoryName(entry.name)}`;
  const isDuplicate = entries.some((existing) => {
    const existingKey = `${normaliseCategoryName(existing.parentName ?? 'root')}::${normaliseCategoryName(
      existing.name
    )}`;
    return existingKey === key;
  });
  if (isDuplicate) {
    warnings.push(`Duplicate category "${entry.name}" under "${entry.parentName ?? 'root'}" was ignored.`);
    return;
  }
  entries.push({
    ...entry,
    tags: sanitiseTags(entry.tags)
  });
};

const collectSubcategories = (
  value: unknown,
  parentName: string,
  type: Category['type'],
  inheritedTags: string[],
  entries: CategoryImportEntry[],
  warnings: string[],
  path: string
) => {
  if (value == null) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (item == null) {
        warnings.push(`Empty subcategory at ${path}[${index}] was skipped.`);
        return;
      }
      if (typeof item === 'string') {
        const label = ensureString(item);
        if (!label) {
          warnings.push(`Invalid subcategory label at ${path}[${index}] was skipped.`);
          return;
        }
        const tags = sanitiseTags([...inheritedTags, ...deriveTagsFromLabel(label)]);
        registerEntry({ name: label, type, parentName, tags }, entries, warnings);
        return;
      }
      if (typeof item === 'object') {
        collectSubcategories(item, parentName, type, inheritedTags, entries, warnings, `${path}[${index}]`);
        return;
      }
      warnings.push(`Unsupported subcategory type at ${path}[${index}] was skipped.`);
    });
    return;
  }

  if (typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([rawKey, nestedValue]) => {
      const label = ensureString(rawKey);
      if (!label) {
        warnings.push(`Encountered empty subcategory group under ${path}.`);
        return;
      }
      const tags = sanitiseTags([...inheritedTags, ...deriveTagsFromLabel(label)]);
      registerEntry(
        {
          name: label,
          type,
          parentName,
          tags
        },
        entries,
        warnings
      );
      collectSubcategories(nestedValue, label, type, tags, entries, warnings, `${path} > ${label}`);
    });
    return;
  }

  if (typeof value === 'string') {
    const label = ensureString(value);
    if (!label) {
      warnings.push(`Invalid subcategory label at ${path} was skipped.`);
      return;
    }
    const tags = sanitiseTags([...inheritedTags, ...deriveTagsFromLabel(label)]);
    registerEntry({ name: label, type, parentName, tags }, entries, warnings);
    return;
  }

  warnings.push(`Unsupported subcategory definition at ${path} was skipped.`);
};

const processCategoryRecord = (
  label: string,
  rawValue: unknown,
  entries: CategoryImportEntry[],
  warnings: string[]
) => {
  if (!rawValue || typeof rawValue !== 'object') {
    warnings.push(`Category "${label}" is not an object and was skipped.`);
    return;
  }

  const value = rawValue as Record<string, unknown>;
  const name = ensureString(value.category) ?? ensureString(value.name) ?? ensureString(label);
  if (!name) {
    warnings.push(`Category entry "${label}" is missing a valid name and was skipped.`);
    return;
  }

  const type = resolveCategoryType(name, value.type);
  const blueprint = DEFAULT_CATEGORY_BLUEPRINTS[normaliseCategoryName(name)];
  const providedTags = extractProvidedTags(value.tags);
  const tags = sanitiseTags([
    ...deriveTagsFromLabel(label),
    ...deriveTagsFromLabel(name),
    ...(blueprint?.tags ?? []),
    ...providedTags
  ]);

  registerEntry({ name, type, tags }, entries, warnings);

  if ('subcategories' in value) {
    collectSubcategories(value.subcategories, name, type, tags, entries, warnings, name);
  } else {
    warnings.push(`Category "${name}" does not define any subcategories.`);
  }
};

const interpretParsedValue = (value: unknown, entries: CategoryImportEntry[], warnings: string[]) => {
  if (value == null) {
    warnings.push('Encountered empty category entry.');
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => processCategoryRecord(`item ${index + 1}`, item, entries, warnings));
    return;
  }

  if (typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) =>
      processCategoryRecord(key, item, entries, warnings)
    );
    return;
  }

  warnings.push('Unsupported JSON structure for category import.');
};

export const interpretCategoryJson = (jsonInput: string): CategoryImportResult => {
  const trimmed = jsonInput.trim();
  if (!trimmed) {
    return { entries: [], warnings: [], errors: ['No JSON input provided.'] };
  }

  try {
    const parsed = JSON.parse(trimmed);
    const entries: CategoryImportEntry[] = [];
    const warnings: string[] = [];
    interpretParsedValue(parsed, entries, warnings);
    return { entries, warnings, errors: [] };
  } catch (error) {
    return {
      entries: [],
      warnings: [],
      errors: [`Unable to parse JSON: ${(error as Error).message}`]
    };
  }
};

