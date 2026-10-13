import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  List,
  Modal,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconPlus, IconSparkles, IconSpeakerphone, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatNumber, fromNow } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import { crmApi, SegmentStatus, type DiscoveredSegment, type TargetFilter } from './api';
import { AudienceSummary, BUILT_IN_SEGMENTS, describeFilter, loadSegments, saveSegments, type RuleSegment } from './audience';
import { DetailSheet, IfCan, RequireCap } from './components';
import { CRM_KEY, useCan, useClientPage, useCrmSession } from './hooks';

function RuleBuilder({ opened, onClose, onSave }: { opened: boolean; onClose: () => void; onSave: (s: RuleSegment) => void }) {
  const options = useQuery({ queryKey: [CRM_KEY, 'recipient-options'], queryFn: crmApi.recipientOptions, enabled: opened, staleTime: 5 * 60_000 });
  const [name, setName] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [mode, setMode] = useState<'any' | 'all'>('any');
  const [cities, setCities] = useState<string[]>([]);
  const [activeOn, setActiveOn] = useState(false);
  const [days, setDays] = useState<number | string>(30);
  const [wholesale, setWholesale] = useState(false);
  const filter: TargetFilter = {
    ...(tags.length ? { tags, tagMatchMode: mode } : {}),
    ...(cities.length ? { cities } : {}),
    ...(activeOn && Number(days) > 0 ? { lastSignalDaysAgo: Number(days) } : {}),
    ...(wholesale ? { hasOpenDeals: true } : {}),
  };
  const close = () => {
    setName('');
    setTags([]);
    setMode('any');
    setCities([]);
    setActiveOn(false);
    setDays(30);
    setWholesale(false);
    onClose();
  };
  return (
    <Modal opened={opened} onClose={close} title="New segment" size="lg">
      <Stack gap="md">
        <TextInput label="Name" required maxLength={80} value={name} onChange={(e) => setName(e.currentTarget.value)} placeholder="e.g. Kathmandu regulars" />
        {options.error && <ErrorBlock error={options.error} title="Could not load tags and cities" onRetry={() => void options.refetch()} />}
        <MultiSelect
          label="Tags"
          placeholder={options.isPending ? 'Loading…' : 'Any tag'}
          data={options.data?.availableTags ?? []}
          value={tags}
          onChange={setTags}
          searchable
          comboboxProps={{ zIndex: 400 }}
        />
        {tags.length > 1 && (
          <SegmentedControl
            size="xs"
            value={mode}
            onChange={(v) => setMode(v as 'any' | 'all')}
            data={[
              { value: 'any', label: 'Has any of these tags' },
              { value: 'all', label: 'Has all of these tags' },
            ]}
          />
        )}
        <MultiSelect
          label="Cities"
          placeholder={options.isPending ? 'Loading…' : 'Any city'}
          data={options.data?.availableCities ?? []}
          value={cities}
          onChange={setCities}
          searchable
          comboboxProps={{ zIndex: 400 }}
        />
        <Group align="flex-end" gap="sm">
          <Switch label="Active recently" checked={activeOn} onChange={(e) => setActiveOn(e.currentTarget.checked)} />
          {activeOn && <NumberInput aria-label="Days" w={120} min={1} max={365} value={days} onChange={setDays} suffix=" days" />}
        </Group>
        <Switch label="Has an open wholesale deal" checked={wholesale} onChange={(e) => setWholesale(e.currentTarget.checked)} />
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" mb={6}>
            {describeFilter(filter)}
          </Text>
          <AudienceSummary filter={filter} />
        </Card>
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={() => {
              onSave({ key: `seg-${Date.now().toString(36)}`, name: name.trim(), filter });
              close();
            }}
          >
            Save segment
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function SegmentCard({ s, onOpen, onDelete }: { s: RuleSegment; onOpen: () => void; onDelete?: () => void }) {
  return (
    <Card withBorder padding="md" data-interactive="true" onClick={onOpen} style={{ cursor: 'pointer' }} aria-label={`Segment ${s.name}`}>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Stack gap={4} style={{ minWidth: 0 }}>
          <Group gap="xs">
            <Text fw={650}>{s.name}</Text>
            {s.builtIn && (
              <Badge size="xs" variant="light" color="gray">
                Built-in
              </Badge>
            )}
          </Group>
          <Text size="xs" c="dimmed">
            {s.description ?? describeFilter(s.filter)}
          </Text>
        </Stack>
        {onDelete && (
          <Tooltip label="Delete segment">
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={`Delete ${s.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <IconTrash size={15} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Card>
  );
}

function AiSegments() {
  const qc = useQueryClient();
  const canManage = useCan('segments.manage');
  const list = useQuery({ queryKey: [CRM_KEY, 'ai-segments'], queryFn: crmApi.aiSegments });
  const paging = useClientPage(list.data, 6);
  const discover = useMutation({
    mutationFn: crmApi.discoverSegments,
    onSuccess: () => {
      toastSuccess('Looking for new groups in your customers');
      void qc.invalidateQueries({ queryKey: [CRM_KEY, 'ai-segments'] });
    },
    onError: (e) => toastError(e),
  });
  const adopt = useMutation({
    mutationFn: (s: DiscoveredSegment) => crmApi.adoptSegment(s.id, s.name),
    onSuccess: () => {
      toastSuccess('Segment kept');
      void qc.invalidateQueries({ queryKey: [CRM_KEY, 'ai-segments'] });
    },
    onError: (e) => toastError(e),
  });
  return (
    <SectionCard
      title="Suggested by AI"
      description="Groups the CRM found in your customers' buying patterns."
      action={
        canManage ? (
          <Button size="xs" variant="light" leftSection={<IconSparkles size={14} />} loading={discover.isPending} onClick={() => discover.mutate()}>
            Find groups
          </Button>
        ) : undefined
      }
    >
      {list.isPending ? (
        <ListSkeleton rows={2} height={70} />
      ) : list.error ? (
        <ErrorBlock error={list.error} title="Could not load suggested segments" onRetry={() => void list.refetch()} />
      ) : paging.total === 0 ? (
        <EmptyBlock title="No suggestions yet" body="Suggestions appear once you have enough customers and orders." />
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
            {paging.items
              .filter((s) => s.status !== SegmentStatus.Archived)
              .map((s) => (
                <Card key={s.id} withBorder padding="md">
                  <Stack gap={6}>
                    <Group justify="space-between" wrap="nowrap">
                      <Text fw={650}>{s.name}</Text>
                      {s.status === SegmentStatus.Adopted ? (
                        <Badge size="xs" color="forest" variant="light">
                          Kept
                        </Badge>
                      ) : (
                        <Badge size="xs" color="blue" variant="light">
                          New
                        </Badge>
                      )}
                    </Group>
                    <Text size="sm" c="dimmed">
                      {s.description}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatNumber(s.memberCount)} customers · {Math.round((s.retentionRate ?? 0) * (s.retentionRate > 1 ? 1 : 100))}% come back · found {fromNow(s.discoveredAt)}
                    </Text>
                    {s.actionRecommendations?.length > 0 && (
                      <List size="xs" spacing={2}>
                        {s.actionRecommendations.slice(0, 2).map((a) => (
                          <List.Item key={a}>{a}</List.Item>
                        ))}
                      </List>
                    )}
                    {canManage && s.status === SegmentStatus.Discovered && (
                      <Group>
                        <Button size="xs" variant="light" loading={adopt.isPending && adopt.variables?.id === s.id} onClick={() => adopt.mutate(s)}>
                          Keep this segment
                        </Button>
                      </Group>
                    )}
                  </Stack>
                </Card>
              ))}
          </SimpleGrid>
          <Pager page={paging.page} pageSize={paging.pageSize} total={paging.total} shown={paging.items.length} hasPrev={paging.hasPrev} hasNext={paging.hasNext} onPrev={paging.prev} onNext={paging.next} />
        </>
      )}
    </SectionCard>
  );
}

function Segments() {
  const navigate = useNavigate();
  const { tenantId } = useCrmSession();
  const [mine, setMine] = useState<RuleSegment[]>(() => loadSegments(tenantId));
  const [building, setBuilding] = useState(false);
  const [open, setOpen] = useState<RuleSegment | null>(null);
  const all = [...BUILT_IN_SEGMENTS, ...mine];
  const paging = useClientPage(all, 12);
  const persist = (next: RuleSegment[]) => {
    setMine(next);
    saveSegments(tenantId, next);
  };
  return (
    <>
      <PageHeader
        title="Segments"
        description="Groups of customers to understand and to reach with campaigns."
        actions={
          <IfCan cap="segments.manage">
            <Button leftSection={<IconPlus size={16} />} onClick={() => setBuilding(true)}>
              New segment
            </Button>
          </IfCan>
        }
      />
      <Stack gap="lg">
        <SectionCard title="Your segments" description="Built-in groups plus the rules you create. Open one to see how many customers can be reached.">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
            {paging.items.map((s) => (
              <SegmentCard
                key={s.key}
                s={s}
                onOpen={() => setOpen(s)}
                onDelete={
                  s.builtIn
                    ? undefined
                    : () =>
                        void confirmAction({ title: `Delete “${s.name}”?`, body: 'Campaigns already sent are not affected.', confirmLabel: 'Delete', danger: true }).then(
                          (ok) => ok && persist(mine.filter((m) => m.key !== s.key)),
                        )
                }
              />
            ))}
          </SimpleGrid>
          <Pager page={paging.page} pageSize={paging.pageSize} total={paging.total} shown={paging.items.length} hasPrev={paging.hasPrev} hasNext={paging.hasNext} onPrev={paging.prev} onNext={paging.next} />
        </SectionCard>
        <AiSegments />
      </Stack>
      <RuleBuilder
        opened={building}
        onClose={() => setBuilding(false)}
        onSave={(s) => {
          persist([...mine, s]);
          toastSuccess(`Segment “${s.name}” saved`);
        }}
      />
      <DetailSheet opened={!!open} onClose={() => setOpen(null)} title={open?.name ?? ''}>
        {open && (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {describeFilter(open.filter)}
            </Text>
            <AudienceSummary filter={open.filter} />
            <IfCan cap="campaigns.manage">
              <Button
                leftSection={<IconSpeakerphone size={16} />}
                onClick={() => navigate('/crm/campaigns', { state: { segment: open } })}
              >
                Send a campaign to this segment
              </Button>
            </IfCan>
            <Alert variant="light" color="gray" p="xs">
              <Text size="xs">Only customers who agreed to marketing get campaign messages. Everyone else is skipped automatically.</Text>
            </Alert>
          </Stack>
        )}
      </DetailSheet>
    </>
  );
}

export default function SegmentsPage() {
  return (
    <RequireCap cap="segments.view">
      <Segments />
    </RequireCap>
  );
}

