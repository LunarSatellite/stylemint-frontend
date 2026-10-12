/**
 * Freeze the API's request-body field names into this repository.
 *
 * The contract guard needs to know what each endpoint accepts. Reading
 * the backend's `swagger-spec.json` directly works on a machine that
 * has both repositories checked out and fails in CI, which has only
 * this one — and a guard that cannot find its contract passes by doing
 * nothing, which is the worst way for it to fail.
 *
 * So the field names are extracted at codegen time and committed, next
 * to the generated types and for the same reason.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const specPath = resolve(here, '../../../stylemint-backend/swagger-spec.json');
const outPath = resolve(here, '../src/api/request-bodies.json');

const spec = JSON.parse(readFileSync(specPath, 'utf8'));

const bodies = {};
for (const [path, operations] of Object.entries(spec.paths ?? {})) {
  for (const [method, operation] of Object.entries(operations)) {
    const ref = operation?.requestBody?.content?.['application/json']?.schema?.$ref;
    if (!ref) continue;
    const schema = spec.components?.schemas?.[ref.split('/').pop()];
    if (!schema?.properties) continue;
    bodies[`${method.toUpperCase()} ${path}`] = Object.keys(schema.properties);
  }
}

writeFileSync(outPath, `${JSON.stringify(bodies, null, 2)}\n`);
console.log(`wrote ${Object.keys(bodies).length} request bodies to src/api/request-bodies.json`);
