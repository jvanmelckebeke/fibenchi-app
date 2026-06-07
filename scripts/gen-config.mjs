// Generate the Zod schema for the companion config contract from the JSON Schema
// that Fibenchi emits (single source of truth — see fibenchi/scripts/export_companion_schema.py).
//
// json-schema-to-zod doesn't resolve Pydantic's 2020-12 `$defs`/`$ref` (it expects
// draft-07 `definitions`), so we inline all internal refs first; otherwise nested
// models collapse to z.any() and we lose the whole point of the contract.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import jsonSchemaToZodPkg from 'json-schema-to-zod';

const jsonSchemaToZod =
  jsonSchemaToZodPkg.jsonSchemaToZod ?? jsonSchemaToZodPkg.default ?? jsonSchemaToZodPkg;

const INPUT = 'schema/companion.schema.json';
const OUTPUT = 'lib/config/generated/config.schema.ts';

const schema = JSON.parse(readFileSync(INPUT, 'utf8'));
const defs = schema.$defs ?? schema.definitions ?? {};

/** Inline every internal `#/$defs/X` (or `#/definitions/X`) ref. No recursive types here. */
function deref(node) {
  if (Array.isArray(node)) return node.map(deref);
  if (node && typeof node === 'object') {
    if (typeof node.$ref === 'string') {
      const name = node.$ref.split('/').pop();
      const target = defs[name];
      if (!target) throw new Error(`unresolved $ref: ${node.$ref}`);
      return deref(target);
    }
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === '$defs' || key === 'definitions') continue;
      out[key] = deref(value);
    }
    return out;
  }
  return node;
}

const code = jsonSchemaToZod(deref(schema), { name: 'companionConfigSchema', module: 'esm' });
const header =
  '// GENERATED from schema/companion.schema.json by `npm run gen:config` — do not edit by hand.\n';

mkdirSync('lib/config/generated', { recursive: true });
writeFileSync(OUTPUT, header + code + '\n');
console.log(`wrote ${OUTPUT}`);
