import { Badge, type BadgeProps } from '@mantine/core';

export function StatusBadge({ label, color, ...rest }: { label: string; color: string } & Omit<BadgeProps, 'color'>) {
  return (
    <Badge color={color} variant="light" {...rest}>
      {label}
    </Badge>
  );
}
