import { describe, expect, it } from 'vitest';

import { interpretCategoryJson, normaliseCategoryName } from './categoryImport';

const SAMPLE_JSON = `{
  "Household Essentials": {
    "category": "Groceries & Daily Supplies",
    "subcategories": [
      "Grocery",
      "Meat",
      "Rice"
    ]
  },
  "Financial Commitments": {
    "category": "Loans & Insurance",
    "subcategories": {
      "Loans": ["House Loan"],
      "Insurance": ["Term Insurance", "Health Insurance"]
    }
  }
}`;

describe('categoryImport utilities', () => {
  it('normalises category names consistently', () => {
    expect(normaliseCategoryName('Groceries & Daily Supplies')).toBe('groceries daily supplies');
    expect(normaliseCategoryName('  Groceries  &  Daily  Supplies ')).toBe('groceries daily supplies');
  });

  it('interprets nested JSON structures into category entries', () => {
    const result = interpretCategoryJson(SAMPLE_JSON);
    expect(result.errors).toHaveLength(0);
    expect(result.entries.length).toBe(10);

    const root = result.entries.find((entry) => entry.name === 'Groceries & Daily Supplies');
    expect(root).toBeDefined();
    expect(root?.parentName).toBeUndefined();
    expect(root?.type).toBe('expense');

    const loans = result.entries.find((entry) => entry.name === 'Loans');
    expect(loans?.parentName).toBe('Loans & Insurance');

    const termInsurance = result.entries.find((entry) => entry.name === 'Term Insurance');
    expect(termInsurance?.parentName).toBe('Insurance');

    const tagsAreSanitised = termInsurance?.tags.every((tag) => /^[a-z0-9-]+$/.test(tag));
    expect(tagsAreSanitised).toBe(true);
  });

  it('reports parse errors for invalid JSON input', () => {
    const result = interpretCategoryJson('not valid json');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.entries).toHaveLength(0);
  });
});

