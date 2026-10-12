import { ActionIcon, Menu, Tooltip, useMantineColorScheme, type MantineColorScheme, type MantineColorSchemeManager } from '@mantine/core';
import { IconCheck, IconDeviceDesktop, IconMoon, IconSun } from '@tabler/icons-react';

export const COLOR_SCHEME_KEY = 'stylemint.admin.colorScheme';

const isScheme = (value: unknown): value is MantineColorScheme => value === 'light' || value === 'dark' || value === 'auto';

/** Mantine's colour-scheme manager on localStorage, every access guarded (private windows throw). */
export function colorSchemeManager(key = COLOR_SCHEME_KEY): MantineColorSchemeManager {
  let listener: ((event: StorageEvent) => void) | undefined;
  return {
    get: (fallback) => {
      try {
        const stored = window.localStorage.getItem(key);
        return isScheme(stored) ? stored : fallback;
      } catch {
        return fallback;
      }
    },
    set: (value) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // kept for this visit only
      }
    },
    subscribe: (onUpdate) => {
      listener = (event) => {
        if (event.key === key && isScheme(event.newValue)) onUpdate(event.newValue);
      };
      window.addEventListener('storage', listener);
    },
    unsubscribe: () => {
      if (listener) window.removeEventListener('storage', listener);
      listener = undefined;
    },
    clear: () => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // nothing stored
      }
    },
  };
}

export function ColorSchemeMenu() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const options: { value: MantineColorScheme; label: string; icon: typeof IconSun }[] = [
    { value: 'light', label: 'Light', icon: IconSun },
    { value: 'dark', label: 'Dark', icon: IconMoon },
    { value: 'auto', label: 'Match system', icon: IconDeviceDesktop },
  ];
  const CurrentIcon = options.find((o) => o.value === colorScheme)?.icon ?? IconSun;
  return (
    <Menu position="bottom-end">
      <Menu.Target>
        <Tooltip label="Appearance">
          <ActionIcon variant="subtle" color="slate" size="lg" aria-label="Appearance">
            <CurrentIcon size={19} aria-hidden />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Appearance</Menu.Label>
        {options.map(({ value, label, icon: Icon }) => (
          <Menu.Item
            key={value}
            leftSection={<Icon size={15} aria-hidden />}
            rightSection={colorScheme === value ? <IconCheck size={14} aria-hidden /> : null}
            aria-current={colorScheme === value ? 'true' : undefined}
            onClick={() => setColorScheme(value)}
          >
            {label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

export function SkipToContent() {
  return (
    <a
      className="sm-skip-link"
      href="#main-content"
      onClick={(event) => {
        event.preventDefault();
        document.getElementById('main-content')?.focus();
      }}
    >
      Skip to content
    </a>
  );
}

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}favicon.svg`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'block', borderRadius: size * 0.23, boxShadow: '0 3px 12px rgba(8, 61, 42, 0.25)' }}
    />
  );
}
