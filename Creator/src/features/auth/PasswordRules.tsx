import { List, ThemeIcon } from '@mantine/core';
import { IconCheck, IconPointFilled } from '@tabler/icons-react';
import { PASSWORD_RULES } from '../../auth/passwordPolicy';

/** The policy as a live checklist under the field. */
export function PasswordRules({ value }: { value: string }) {
  return (
    <List spacing={4} size="sm" center aria-live="polite" data-testid="password-rules">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value);
        return (
          <List.Item
            key={rule.id}
            data-ok={ok || undefined}
            c={ok ? 'var(--sm-good-text)' : 'dimmed'}
            icon={
              <ThemeIcon size={18} radius="xl" color={ok ? 'forest' : 'slate'} variant={ok ? 'filled' : 'light'}>
                {ok ? <IconCheck size={12} /> : <IconPointFilled size={10} />}
              </ThemeIcon>
            }
          >
            {rule.label}
            <span className="sr-only">{ok ? ' — done' : ' — not yet'}</span>
          </List.Item>
        );
      })}
    </List>
  );
}
