import { useState } from 'react';
import { ActionIcon, Alert, Badge, Button, Card, Group, Modal, Select, Stack, Text, TextInput, Textarea, Tooltip } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { messageOf } from '../../api/client';
import { formatDate } from '../../lib/format';
import { toastSuccess } from '../../lib/notify';
import { crmApi, SubjectKind, TaskPriority, taskPriorityColor, taskPriorityLabel, type TaskCreate, type TaskDto } from './api';
import { CustomerPicker } from './components';
import { CRM_KEY } from './hooks';

/** Create a follow-up task — optionally about one customer (fixed when opened from a profile). */
export function TaskModal({
  opened,
  onClose,
  customer,
}: {
  opened: boolean;
  onClose: () => void;
  /** When given, the task is about this customer and the picker is hidden. */
  customer?: { id: string; name: string } | null;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>(String(TaskPriority.Medium));
  const [due, setDue] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setDescription('');
    setPriority(String(TaskPriority.Medium));
    setDue('');
    setCustomerId(null);
    setError(null);
  };

  const subjectId = customer?.id ?? customerId;
  const create = useMutation({
    mutationFn: () => {
      const body: TaskCreate = {
        title: title.trim(),
        description: description.trim() || null,
        priority: Number(priority),
        dueDate: due ? dayjs(due).hour(17).minute(0).second(0).toISOString() : null,
        subjectKind: subjectId ? SubjectKind.Contact : null,
        subjectId: subjectId ?? null,
      };
      return crmApi.createTask(body);
    },
    onSuccess: () => {
      toastSuccess('Follow-up added');
      void qc.invalidateQueries({ queryKey: [CRM_KEY, 'tasks'] });
      void qc.invalidateQueries({ queryKey: [CRM_KEY, 'customer'] });
      reset();
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });

  return (
    <Modal
      opened={opened}
      onClose={() => {
        reset();
        onClose();
      }}
      title="New follow-up task"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) create.mutate();
        }}
      >
        <Stack gap="md">
          {error && (
            <Alert color="signal" variant="light">
              {error}
            </Alert>
          )}
          {customer ? (
            <Text size="sm">
              About <b>{customer.name}</b>
            </Text>
          ) : (
            <CustomerPicker value={customerId} onChange={setCustomerId} label="About a customer (optional)" />
          )}
          <TextInput label="What needs doing?" required maxLength={300} value={title} onChange={(e) => setTitle(e.currentTarget.value)} data-autofocus />
          <Textarea label="Details" autosize minRows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
          <Group grow align="flex-start">
            <Select
              label="Priority"
              data={[
                { value: '1', label: 'Low' },
                { value: '2', label: 'Medium' },
                { value: '3', label: 'High' },
              ]}
              value={priority}
              onChange={(v) => setPriority(v ?? '2')}
              allowDeselect={false}
              comboboxProps={{ zIndex: 400 }}
            />
            <TextInput label="Due date" type="date" value={due} onChange={(e) => setDue(e.currentTarget.value)} />
          </Group>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                reset();
                onClose();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending} disabled={!title.trim()}>
              Add task
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export function TaskRow({ t, onComplete, busy }: { t: TaskDto; onComplete?: (t: TaskDto) => void; busy?: boolean }) {
  const overdue = !!t.dueDate && !t.completedAt && new Date(t.dueDate).getTime() < Date.now();
  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Text size="sm" fw={600} td={t.status === 3 ? 'line-through' : undefined}>
            {t.title}
          </Text>
          {t.description && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {t.description}
            </Text>
          )}
          <Group gap={6}>
            <Badge size="xs" variant="light" color={taskPriorityColor[t.priority] ?? 'gray'}>
              {taskPriorityLabel[t.priority] ?? 'Task'}
            </Badge>
            {t.dueDate && (
              <Text size="xs" c={overdue ? 'signal' : 'dimmed'}>
                {overdue ? 'Overdue · ' : 'Due '}
                {formatDate(t.dueDate)}
              </Text>
            )}
            {t.assignedToUserName && (
              <Text size="xs" c="dimmed">
                · {t.assignedToUserName}
              </Text>
            )}
          </Group>
        </Stack>
        {onComplete && t.status !== 3 && t.status !== 4 && (
          <Tooltip label="Mark done">
            <ActionIcon variant="light" color="forest" aria-label={`Mark "${t.title}" done`} loading={busy} onClick={() => onComplete(t)}>
              <IconCheck size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Card>
  );
}
