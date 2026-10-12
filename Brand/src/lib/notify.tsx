import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { messageOf } from '../api/client';

export function toastSuccess(message: ReactNode, title?: string) {
  notifications.show({ color: 'forest', icon: <IconCheck size={16} />, title, message, autoClose: 3500 });
}

export function toastError(error: unknown, title = 'That did not work') {
  notifications.show({
    color: 'signal',
    icon: <IconAlertTriangle size={16} />,
    title,
    message: messageOf(error),
    autoClose: 7000,
  });
}

/** A yes/no confirmation. Resolves true only on confirm. */
export function confirmAction(opts: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  cancelLabel?: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (v: boolean) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    modals.openConfirmModal({
      title: opts.title,
      children: typeof opts.body === 'string' ? <Text size="sm">{opts.body}</Text> : opts.body,
      labels: { confirm: opts.confirmLabel, cancel: opts.cancelLabel ?? 'Cancel' },
      confirmProps: { color: opts.danger ? 'signal' : 'forest' },
      onConfirm: () => settle(true),
      onCancel: () => settle(false),
      onClose: () => settle(false),
    });
  });
}
