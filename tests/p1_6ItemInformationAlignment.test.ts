import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateMappingSuggestions } from '@/lib/mapping/mappingSuggester';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';
import { PINT_AE_UC1_FIELDS } from '@/types/fieldMapping';

interface TemplateManifest {
  templates: Array<{
    file: string;
    columns: Array<{ name: string; mandatory: boolean; description: string }>;
  }>;
}

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), 'public', 'templates', 'templates_manifest.json'), 'utf8'),
) as TemplateManifest;

describe('P1.6 item information alignment', () => {
  it('requires independent item name and description sources under the UAE MoF profile', () => {
    const lineColumns = manifest.templates.find((item) => item.file === 'invoice_lines_template.csv')!.columns;
    const fields = PINT_AE_UC1_FIELDS.filter((field) => ['item_name', 'description'].includes(field.id));

    expect(lineColumns.find((column) => column.name === 'item_name')).toMatchObject({ mandatory: true });
    expect(lineColumns.find((column) => column.name === 'description')).toMatchObject({
      mandatory: true,
      description: expect.stringContaining('optional in base PINT-AE'),
    });
    expect(fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'item_name', ibtReference: 'IBT-153', isMandatory: true }),
      expect.objectContaining({ id: 'description', ibtReference: 'IBT-154', isMandatory: true }),
    ]));
  });

  it('does not cross-map item name and item description aliases', () => {
    const suggestions = generateMappingSuggestions(
      ['product_name', 'product_description'],
      [{ product_name: 'Widget', product_description: 'Detailed widget specification' }],
      'lines',
    );

    expect(suggestions.find((item) => item.erpColumn === 'product_name')?.targetField.id).toBe('item_name');
    expect(suggestions.find((item) => item.erpColumn === 'product_description')?.targetField.id).toBe('description');
  });

  it('keeps the two presence controls independently attributed', () => {
    const itemName = UAE_UC1_CHECK_PACK.find((check) => check.check_id === 'UAE-UC1-CHK-038')!;
    const itemDescription = UAE_UC1_CHECK_PACK.find((check) => check.check_id === 'UAE-UC1-CHK-039')!;

    expect(itemName).toMatchObject({
      pint_reference_terms: ['IBT-153'],
      mof_rule_reference: 'MOF-TAX-50|MOF-COM-48',
      parameters: { primary_field: 'item_name' },
    });
    expect(itemDescription).toMatchObject({
      pint_reference_terms: ['IBT-154'],
      mof_rule_reference: 'MOF-TAX-51|MOF-COM-49',
      parameters: { primary_field: 'description' },
    });
  });
});
