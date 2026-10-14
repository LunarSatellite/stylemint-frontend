import type { ReactNode } from 'react';
import { Drawer, ScrollArea, Text } from '@mantine/core';
import { useIsPhone } from '../lib/useIsPhone';

/** Details beside a list: a right-hand drawer on a computer, a bottom sheet on a phone. */
export function DetailSheet({
  opened,
  onClose,
  title,
  children,
  size = 'lg',
}: {
  opened: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}) {
  const phone = useIsPhone();
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={<Text fw={650}>{title}</Text>}
      position={phone ? 'bottom' : 'right'}
      size={phone ? '90%' : size}
      radius={phone ? 'lg' : 0}
      padding="md"
      zIndex={300}
      scrollAreaComponent={ScrollArea.Autosize}
    >
      {children}
    </Drawer>
  );
}
