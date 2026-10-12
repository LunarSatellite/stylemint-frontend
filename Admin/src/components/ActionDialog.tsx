import { useCallback, useState, type ReactNode } from 'react';
import { Alert, Button, Checkbox, Group, Modal, NumberInput, Select, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle } from '@tabler/icons-react';
import { ApiError, messageOf } from '@/api/errors';
import { withStepUp } from '@/auth/stepUp';

export type ActionField =
  | { name: string; kind: 'textarea' | 'text'; label: string; description?: string; required?: boolean; minLength?: number; placeholder?: string; defaultValue?: string }
  | { name: string; kind: 'select'; label: string; description?: string; required?: boolean; options: { value: string; label: string }[]; defaultValue?: string }
  | { name: string; kind: 'number'; label: string; description?: string; required?: boolean; min?: number; max?: number; defaultValue?: string; decimalScale?: number }
  | { name: string; kind: 'checkbox'; label: string; description?: string; defaultValue?: string };

export interface ActionSpec {
  title: string;
  /** What happens if they go ahead - the reason the question is asked at all. */
  consequence: ReactNode;
  /** Named for what it does ("Suspend rider"), never "OK". */
  confirmLabel: string;
  danger?: boolean;
  fields?: ActionField[];
  /** Runs the write. Step-up challenges are handled around it. */
  run: (values: Record<string, string>) => Promise<unknown>;
  /** The toast on success. */
  success: string | ((result: unknown) => string);
  /** After success (invalidate queries, close a drawer). */
  onDone?: (result: unknown) => void;
}

function initialValues(fields: ActionField[] = []): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? '']));
}

/**
 * Every write goes through one dialog: it states the consequence, asks for the reason the audit log will keep,
 * handles a step-up challenge, keeps the dialog open with the server's message on failure, and toasts on success.
 */
export function useActionDialog(): [ReactNode, (spec: ActionSpec) => void] {
  const [spec, setSpec] = useState<ActionSpec | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const open = useCallback((next: ActionSpec) => {
    setSpec(next);
    setValues(initialValues(next.fields));
    setError(null);
    setTouched(false);
    setBusy(false);
  }, []);

  const close = () => {
    if (busy) return;
    setSpec(null);
  };

  const invalid = (f: ActionField): string | null => {
    if (f.kind === 'checkbox') return null;
    const v = (values[f.name] ?? '').trim();
    if (f.required && !v) return `${f.label} is required`;
    if ((f.kind === 'textarea' || f.kind === 'text') && f.minLength && v && v.length < f.minLength) return `At least ${f.minLength} characters`;
    return null;
  };

  const submit = async () => {
    if (!spec) return;
    setTouched(true);
    if ((spec.fields ?? []).some((f) => invalid(f))) return;
    setBusy(true);
    setError(null);
    try {
      const result = await withStepUp(() => spec.run(values));
      const message = typeof spec.success === 'function' ? spec.success(result) : spec.success;
      notifications.show({ color: 'forest', title: 'Done', message });
      spec.onDone?.(result);
      setSpec(null);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'mfa.step_up_cancelled') {
        setError('Cancelled - the change was not made.');
      } else {
        const ref = caught instanceof ApiError && caught.correlationId ? ` (reference ${caught.correlationId})` : '';
        setError(`${messageOf(caught)}${ref}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const node = (
    <Modal opened={spec !== null} onClose={close} title={<Text fw={650}>{spec?.title}</Text>} size="md" closeOnClickOutside={!busy}>
      {spec && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          noValidate
        >
          <Stack gap="md">
            <Text size="sm">{spec.consequence}</Text>
            {(spec.fields ?? []).map((f) => {
              const err = touched ? invalid(f) : null;
              const set = (v: string) => setValues((prev) => ({ ...prev, [f.name]: v }));
              switch (f.kind) {
                case 'textarea':
                  return (
                    <Textarea
                      key={f.name}
                      label={f.label}
                      description={f.description}
                      placeholder={f.placeholder}
                      required={f.required}
                      autosize
                      minRows={3}
                      maxRows={8}
                      value={values[f.name] ?? ''}
                      onChange={(e) => set(e.currentTarget.value)}
                      error={err}
                      data-autofocus
                    />
                  );
                case 'text':
                  return (
                    <TextInput
                      key={f.name}
                      label={f.label}
                      description={f.description}
                      placeholder={f.placeholder}
                      required={f.required}
                      value={values[f.name] ?? ''}
                      onChange={(e) => set(e.currentTarget.value)}
                      error={err}
                    />
                  );
                case 'select':
                  return (
                    <Select
                      key={f.name}
                      label={f.label}
                      description={f.description}
                      required={f.required}
                      data={f.options}
                      value={values[f.name] || null}
                      onChange={(v) => set(v ?? '')}
                      error={err}
                      searchable={f.options.length > 8}
                      comboboxProps={{ withinPortal: true }}
                    />
                  );
                case 'number':
                  return (
                    <NumberInput
                      key={f.name}
                      label={f.label}
                      description={f.description}
                      required={f.required}
                      min={f.min}
                      max={f.max}
                      decimalScale={f.decimalScale}
                      value={values[f.name] ?? ''}
                      onChange={(v) => set(v === '' ? '' : String(v))}
                      error={err}
                    />
                  );
                case 'checkbox':
                  return (
                    <Checkbox
                      key={f.name}
                      label={f.label}
                      description={f.description}
                      checked={values[f.name] === 'true'}
                      onChange={(e) => set(e.currentTarget.checked ? 'true' : '')}
                    />
                  );
                default:
                  return null;
              }
            })}
            {error && (
              <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
                {error}
              </Alert>
            )}
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" color={spec.danger ? 'signal' : undefined} loading={busy}>
                {spec.confirmLabel}
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );

  return [node, open];
}
