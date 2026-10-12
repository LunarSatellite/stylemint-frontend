import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every field a mutation sends must exist on the endpoint's request body.
 *
 * This exists because the first version of `useKycDecide` was written
 * from the prose brief rather than the contract, and sent `reasonCode`
 * and `note` where `DecideKycVm` wants `decisionReasonCode` and
 * `decisionNote`. ASP.NET model binding ignores unknown properties, so
 * there is no error anywhere: the request succeeds, the decision is
 * recorded, and the reviewer's stated reason is silently dropped. It
 * also sent a `rowVersion` the endpoint does not accept, which made
 * the client look as though it carried concurrency protection that
 * nothing on the wire actually had.
 *
 * Nothing else would have caught either one. The types are hand-written,
 * the call compiles, and a running server answers 200.
 */

/**
 * Resolved from the working directory, not `import.meta.url`: under
 * jsdom that is an http URL and `fileURLToPath` refuses it.
 */
const SPEC_PATH = resolve(process.cwd(), '../../stylemint-backend/swagger-spec.json');

const SPEC = JSON.parse(readFileSync(SPEC_PATH, 'utf8')) as {
  paths: Record<string, Record<string, { requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> } }>>;
  components: { schemas: Record<string, { properties?: Record<string, unknown> }> };
};

/** The mutations, and the literal body each one posts. */
const SENDS: { file: string; method: 'post' | 'put' | 'delete'; path: string; keys: string[] }[] = [
  {
    file: 'useKycDecide.ts',
    method: 'post',
    path: '/v1/admin/kyc/{kycItemId}/decide',
    keys: ['decision', 'decisionReasonCode', 'decisionNote'],
  },
  {
    file: 'useModerationDecide.ts',
    method: 'post',
    path: '/v1/admin/moderation/{moderationItemId}/decide',
    keys: ['action', 'decisionNote'],
  },
];

function bodyPropertiesOf(path: string, method: string): string[] {
  const operation = SPEC.paths[path]?.[method];
  expect(operation, `${method.toUpperCase()} ${path} is not in the spec`).toBeTruthy();

  const ref = operation?.requestBody?.content?.['application/json']?.schema?.$ref;
  expect(ref, `${path} has no JSON request body in the spec`).toBeTruthy();

  const schema = SPEC.components.schemas[ref!.split('/').pop()!];
  return Object.keys(schema?.properties ?? {});
}

describe('what a mutation sends is what the endpoint accepts', () => {
  it('reads a spec with the admin endpoints in it', () => {
    expect(Object.keys(SPEC.paths).filter((p) => p.startsWith('/v1/admin')).length).toBeGreaterThan(
      50,
    );
  });

  for (const { file, method, path, keys } of SENDS) {
    it(`${file} sends only fields ${path} accepts`, () => {
      const accepted = bodyPropertiesOf(path, method);
      const unknown = keys.filter((k) => !accepted.includes(k));
      expect(
        unknown,
        `${file} sends ${unknown.join(', ')}, which ${path} will ignore without complaining. It accepts: ${accepted.join(', ')}`,
      ).toEqual([]);
    });
  }

  it('would have caught the bug it was written for', () => {
    /**
     * The exact shape of the original mistake, asserted against the
     * real spec so this cannot pass by the check having gone inert.
     */
    const accepted = bodyPropertiesOf('/v1/admin/kyc/{kycItemId}/decide', 'post');
    expect(accepted).toContain('decisionReasonCode');
    expect(accepted).not.toContain('reasonCode');
    expect(accepted).not.toContain('rowVersion');
  });
});
