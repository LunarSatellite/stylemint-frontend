import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStepUpDialog } from './useMutationWithStepUp';

/**
 * The step-up handshake, tested at the store rather than through the
 * React hook, because the behaviour that matters is the promise: who
 * resolves it, and what happens to the caller when nobody does.
 *
 * The failure this guards is silent. `open()` returns a promise that
 * only `succeed()` or `cancel()` settles, so if no `<StepUpDialog/>` is
 * mounted the mutation that opened it waits for ever — button
 * spinning, no error, nothing in the console. That was the state of
 * this code before the dialog existed.
 */

beforeEach(() => {
  useStepUpDialog.setState({ isOpen: false, resolve: null });
});

describe('the step-up challenge', () => {
  it('is not open until something asks for it', () => {
    expect(useStepUpDialog.getState().isOpen).toBe(false);
  });

  it('opens, and resolves true when the operator passes', async () => {
    const pending = useStepUpDialog.getState().open();
    expect(useStepUpDialog.getState().isOpen).toBe(true);

    useStepUpDialog.getState().succeed();
    await expect(pending).resolves.toBe(true);
    expect(useStepUpDialog.getState().isOpen).toBe(false);
  });

  it('resolves false when cancelled, rather than hanging', async () => {
    /**
     * The caller treats false as "the operator declined" and rethrows
     * the original refusal. Hanging here is the bug that has no
     * symptom other than a button that never stops spinning.
     */
    const pending = useStepUpDialog.getState().open();
    useStepUpDialog.getState().cancel();
    await expect(pending).resolves.toBe(false);
    expect(useStepUpDialog.getState().isOpen).toBe(false);
  });

  it('clears the resolver, so a later succeed cannot settle a dead promise', async () => {
    const pending = useStepUpDialog.getState().open();
    useStepUpDialog.getState().cancel();
    await pending;

    expect(useStepUpDialog.getState().resolve).toBeNull();
    // Must not throw: a stray succeed() after close is a no-op.
    expect(() => useStepUpDialog.getState().succeed()).not.toThrow();
  });

  it('settles within a tick once answered', async () => {
    /**
     * Proof the promise really is settled rather than merely created:
     * a race against an immediate timer would resolve to 'timeout' if
     * nothing answered.
     */
    const pending = useStepUpDialog.getState().open();
    useStepUpDialog.getState().succeed();

    const raced = await Promise.race([
      pending,
      new Promise((r) => {
        setTimeout(() => r('timeout'), 0);
      }),
    ]);
    expect(raced).toBe(true);
  });

  it('a challenge nobody answers stays pending — which is why the dialog is mounted once', async () => {
    const pending = useStepUpDialog.getState().open();
    const raced = await Promise.race([
      pending,
      new Promise((r) => {
        setTimeout(() => r('still waiting'), 0);
      }),
    ]);
    expect(raced).toBe('still waiting');

    // Leave nothing pending for the next test.
    useStepUpDialog.getState().cancel();
    await pending;
  });
});

describe('the dialog is mounted exactly once', () => {
  it('is rendered by AppShell and by nothing else', async () => {
    /**
     * A source check rather than a render test. Two copies would each
     * subscribe to the same store and both try to resolve one promise;
     * zero copies is the hang above. Neither shows up in a unit test
     * of either component on its own.
     */
    const files = import.meta.glob('/src/**/*.tsx', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;

    const mounts = Object.entries(files)
      .filter(([path]) => !path.endsWith('StepUpDialog.tsx'))
      .filter(([, source]) => /<StepUpDialog\s*\/?>/.test(source))
      .map(([path]) => path);

    expect(mounts).toEqual(['/src/components/AppShell.tsx']);
  });
});
