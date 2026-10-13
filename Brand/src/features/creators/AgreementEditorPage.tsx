import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconEye, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError, isMissingEndpoint, messageOf } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatMoney } from '../../lib/format';
import { toastSuccess } from '../../lib/notify';
import {
  AgreementKind,
  agreementsApi,
  AgreementStatus,
  ContentApprovalRule,
  defaultTerms,
  type AgreementDeliverable,
  type AgreementDetail,
  type AgreementTerms,
  type CreateAgreementBody,
} from './agreementsApi';
import { creatorsApi, PartnershipState, type Partnership, type Retainer } from './api';
import { confirmAction, CREATORS_KEY } from './components';
import { agreementKindLabel, commissionRange, contentApprovalLabel, payoutScheduleLabel, shortCreator, toFraction } from './labels';

/** Percent shown in the form ↔ fraction on the wire. */
const toPercent = (f: number | null) => (f === null || f === undefined ? '' : Math.round(f * 1000) / 10);

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm">{children}</Text>
    </Stack>
  );
}

/** Plain-language summary of the terms — the same words as the detail page. */
export function TermsSummary({ t }: { t: AgreementTerms }) {
  const commission = t.commissionRateMin !== null ? commissionRange(t.commissionRateMin, t.commissionRateMax) : 'None';
  return (
    <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm" data-testid="terms-summary">
      <Field label="Commission on sales">{commission}</Field>
      <Field label="Fixed fee">{t.fixedFeeAmount ? formatMoney({ amount: t.fixedFeeAmount, currency: t.currency }) : 'None'}</Field>
      <Field label="Deliverables">
        {t.deliverables.length
          ? t.deliverables
              .map((d) => `${d.quantity} × ${d.description}${d.platform ? ` (${d.platform})` : ''}${d.dueDate ? ` by ${dayjs(d.dueDate).format('D MMM YYYY')}` : ''}`)
              .join('; ')
          : 'None listed'}
      </Field>
      <Field label="Content approval">
        {contentApprovalLabel[t.contentApproval] ?? '—'}
        {t.contentApproval === ContentApprovalRule.DeemedApprovedAfterWindow && t.contentApprovalWindowHours ? ` (${t.contentApprovalWindowHours} h)` : ''}
      </Field>
      <Field label="Usage rights">
        {t.usageRights || 'None'}
        {t.usageRights ? (t.usageRightsDays ? ` · ${t.usageRightsDays} days` : ' · for the term of the agreement') : ''}
        {t.paidAdsUsageAllowed ? ' · paid ads allowed' : ''}
      </Field>
      <Field label="Exclusivity">{t.exclusive ? `${t.exclusivityScope || 'Exclusive'}${t.exclusivityDays ? ` · ${t.exclusivityDays} days` : ''}` : 'Not exclusive'}</Field>
      <Field label="Payment">
        {payoutScheduleLabel[t.payoutSchedule] ?? '—'}, within {t.paymentTermsDays} days
      </Field>
      <Field label="Termination">{t.terminationNoticeDays} days’ written notice</Field>
      <Field label="Term">
        {t.effectiveFromUtc ? dayjs(t.effectiveFromUtc).format('D MMM YYYY') : 'From signing'} –{' '}
        {t.expiresAtUtc ? dayjs(t.expiresAtUtc).format('D MMM YYYY') : 'no end date'}
      </Field>
      <Field label="Governing law">{t.governingLaw || 'Nepal'}</Field>
    </SimpleGrid>
  );
}

function DeliverablesEditor({ value, onChange }: { value: AgreementDeliverable[]; onChange: (v: AgreementDeliverable[]) => void }) {
  const update = (i: number, patch: Partial<AgreementDeliverable>) => onChange(value.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <Stack gap="xs">
      {value.map((d, i) => (
        <Card key={i} withBorder padding="sm" data-testid="deliverable-row">
          <Stack gap="xs">
            <Group gap="xs" wrap="nowrap" align="flex-end">
              <TextInput
                label={`Deliverable ${i + 1}`}
                placeholder="e.g. Reel showing the outfit styled two ways"
                maxLength={500}
                style={{ flex: 1 }}
                value={d.description}
                onChange={(e) => update(i, { description: e.currentTarget.value })}
              />
              <ActionIcon variant="subtle" color="signal" size="lg" aria-label={`Remove deliverable ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
            <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="xs">
              <NumberInput label="How many" min={1} max={1000} value={d.quantity} onChange={(v) => update(i, { quantity: Number(v) || 1 })} />
              <TextInput label="Platform" placeholder="StyleMint, Instagram…" maxLength={60} value={d.platform ?? ''} onChange={(e) => update(i, { platform: e.currentTarget.value || null })} />
              <DateInput
                label="Deadline"
                clearable
                valueFormat="D MMM YYYY"
                value={d.dueDate ? new Date(d.dueDate) : null}
                onChange={(v) => update(i, { dueDate: v ? dayjs(v).format('YYYY-MM-DD') : null })}
              />
            </SimpleGrid>
          </Stack>
        </Card>
      ))}
      <Button
        variant="light"
        size="xs"
        leftSection={<IconPlus size={14} />}
        style={{ alignSelf: 'flex-start' }}
        onClick={() => onChange([...value, { description: '', quantity: 1, platform: null, dueDate: null }])}
        disabled={value.length >= 50}
      >
        Add deliverable
      </Button>
    </Stack>
  );
}

/** Client checks that mirror the server's (`AgreementTerms.Normalize`), so mistakes show before saving. */
export function validateTerms(t: AgreementTerms): string | null {
  if (t.commissionRateMin === null && t.commissionRateMax === null && !t.fixedFeeAmount) return 'Set a commission, a fixed fee, or both.';
  if (t.commissionRateMin !== null && (t.commissionRateMin < 0 || t.commissionRateMin > 1)) return 'Commission must be between 0% and 100%.';
  if (t.commissionRateMin !== null && t.commissionRateMax !== null && t.commissionRateMax < t.commissionRateMin)
    return 'The highest commission cannot be lower than the lowest.';
  if (t.fixedFeeAmount !== null && t.fixedFeeAmount < 0) return 'The fixed fee cannot be negative.';
  if (t.deliverables.some((d) => !d.description.trim())) return 'Describe every deliverable, or remove the empty one.';
  if (t.contentApproval === ContentApprovalRule.DeemedApprovedAfterWindow && !t.contentApprovalWindowHours)
    return 'Say how many hours you have to review content.';
  if (t.exclusive && !t.exclusivityDays) return 'Say how many days the exclusivity lasts.';
  if (t.effectiveFromUtc && t.expiresAtUtc && !dayjs(t.expiresAtUtc).isAfter(t.effectiveFromUtc)) return 'The end date must be after the start date.';
  return null;
}

export function TermsForm({ value, onChange }: { value: AgreementTerms; onChange: (t: AgreementTerms) => void }) {
  const set = <K extends keyof AgreementTerms>(k: K, v: AgreementTerms[K]) => onChange({ ...value, [k]: v });
  const hasCommission = value.commissionRateMin !== null;
  return (
    <Stack gap="lg">
      <SectionCard title="Scope" description="What the creator promotes.">
        <Textarea
          label="Products and channels covered"
          placeholder="e.g. The Dashain 2026 collection, on StyleMint reels and Instagram"
          autosize
          minRows={2}
          maxLength={4000}
          value={value.scopeDescription ?? ''}
          onChange={(e) => set('scopeDescription', e.currentTarget.value || null)}
        />
      </SectionCard>

      <SectionCard title="Money" description="What the creator earns and when it is paid.">
        <Stack gap="sm">
          <Switch
            label="Commission on sales from the creator’s content"
            checked={hasCommission}
            onChange={(e) => onChange({ ...value, commissionRateMin: e.currentTarget.checked ? 0.1 : null, commissionRateMax: e.currentTarget.checked ? 0.1 : null })}
          />
          {hasCommission && (
            <SimpleGrid cols={2} spacing="sm">
              <NumberInput
                label="Commission from (%)"
                min={0}
                max={100}
                decimalScale={1}
                value={toPercent(value.commissionRateMin)}
                onChange={(v) => set('commissionRateMin', toFraction(Number(v) || 0))}
              />
              <NumberInput
                label="Up to (%)"
                description="Same as ‘from’ for a fixed rate"
                min={0}
                max={100}
                decimalScale={1}
                value={toPercent(value.commissionRateMax)}
                onChange={(v) => set('commissionRateMax', toFraction(Number(v) || 0))}
              />
            </SimpleGrid>
          )}
          <NumberInput
            label="Fixed fee (Rs)"
            description="Per agreement, or per month for a retainer. Leave empty for none."
            min={0}
            thousandSeparator=","
            decimalScale={2}
            value={value.fixedFeeAmount ?? ''}
            onChange={(v) => set('fixedFeeAmount', v === '' || v === null ? null : Number(v))}
          />
          <SimpleGrid cols={2} spacing="sm">
            <Select
              label="Payout schedule"
              allowDeselect={false}
              data={Object.entries(payoutScheduleLabel).map(([v, l]) => ({ value: v, label: l }))}
              value={String(value.payoutSchedule)}
              onChange={(v) => set('payoutSchedule', Number(v))}
            />
            <NumberInput label="Pay within (days)" min={0} max={180} value={value.paymentTermsDays} onChange={(v) => set('paymentTermsDays', Number(v) || 0)} />
          </SimpleGrid>
        </Stack>
      </SectionCard>

      <SectionCard title="Deliverables & deadlines">
        <DeliverablesEditor value={value.deliverables} onChange={(v) => set('deliverables', v)} />
      </SectionCard>

      <SectionCard title="Content approval">
        <Stack gap="sm">
          <Select
            label="Before content goes live"
            allowDeselect={false}
            data={Object.entries(contentApprovalLabel).map(([v, l]) => ({ value: v, label: l }))}
            value={String(value.contentApproval)}
            onChange={(v) => set('contentApproval', Number(v))}
          />
          {value.contentApproval === ContentApprovalRule.DeemedApprovedAfterWindow && (
            <NumberInput label="Review window (hours)" min={1} max={720} value={value.contentApprovalWindowHours ?? ''} onChange={(v) => set('contentApprovalWindowHours', v === '' ? null : Number(v))} />
          )}
        </Stack>
      </SectionCard>

      <SectionCard title="Usage rights & exclusivity">
        <Stack gap="sm">
          <Textarea
            label="What you may do with the content"
            autosize
            minRows={2}
            maxLength={500}
            value={value.usageRights ?? ''}
            onChange={(e) => set('usageRights', e.currentTarget.value || null)}
          />
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            <NumberInput
              label="For how many days"
              description="Empty = for the term of the agreement"
              min={1}
              max={3650}
              value={value.usageRightsDays ?? ''}
              onChange={(v) => set('usageRightsDays', v === '' ? null : Number(v))}
            />
            <Switch mt={{ xs: 'lg' }} label="May be used in paid ads" checked={value.paidAdsUsageAllowed} onChange={(e) => set('paidAdsUsageAllowed', e.currentTarget.checked)} />
          </SimpleGrid>
          <Divider />
          <Switch
            label="Exclusive — the creator does not promote competing shops"
            checked={value.exclusive}
            onChange={(e) => onChange({ ...value, exclusive: e.currentTarget.checked, exclusivityDays: e.currentTarget.checked ? (value.exclusivityDays ?? 30) : null })}
          />
          {value.exclusive && (
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
              <TextInput label="Category covered" placeholder="e.g. Women’s ethnic wear" maxLength={500} value={value.exclusivityScope ?? ''} onChange={(e) => set('exclusivityScope', e.currentTarget.value || null)} />
              <NumberInput label="Days" min={1} max={3650} value={value.exclusivityDays ?? ''} onChange={(v) => set('exclusivityDays', v === '' ? null : Number(v))} />
            </SimpleGrid>
          )}
        </Stack>
      </SectionCard>

      <SectionCard title="Term & ending">
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            <DateInput
              label="Starts"
              placeholder="When both have signed"
              clearable
              valueFormat="D MMM YYYY"
              value={value.effectiveFromUtc ? new Date(value.effectiveFromUtc) : null}
              onChange={(v) => set('effectiveFromUtc', v ? dayjs(v).startOf('day').toISOString() : null)}
            />
            <DateInput
              label="Ends"
              placeholder="No end date"
              clearable
              valueFormat="D MMM YYYY"
              minDate={new Date()}
              value={value.expiresAtUtc ? new Date(value.expiresAtUtc) : null}
              onChange={(v) => set('expiresAtUtc', v ? dayjs(v).endOf('day').toISOString() : null)}
            />
          </SimpleGrid>
          <NumberInput
            label="Notice to end early (days)"
            min={0}
            max={365}
            value={value.terminationNoticeDays}
            onChange={(v) => set('terminationNoticeDays', Number(v) || 0)}
          />
          <Textarea label="Cancellation terms (optional)" autosize minRows={2} maxLength={4000} value={value.cancellationTerms ?? ''} onChange={(e) => set('cancellationTerms', e.currentTarget.value || null)} />
          <Textarea label="Anything else agreed (optional)" autosize minRows={2} maxLength={4000} value={value.additionalTerms ?? ''} onChange={(e) => set('additionalTerms', e.currentTarget.value || null)} />
          <Text size="xs" c="dimmed">
            Governed by the laws of Nepal; disputes are heard in Kathmandu.
          </Text>
        </Stack>
      </SectionCard>
    </Stack>
  );
}

/** The agreement text, as the creator will read it. */
export function AgreementText({ text }: { text: string }) {
  return (
    <ScrollArea.Autosize mah={520} type="auto" data-testid="agreement-text">
      <Text size="sm" style={{ whiteSpace: 'pre-wrap', fontFamily: 'Georgia, "Times New Roman", serif', lineHeight: 1.6 }}>
        {text}
      </Text>
    </ScrollArea.Autosize>
  );
}

function seedFromPartnership(p: Partnership | undefined): Partial<AgreementTerms> {
  return p ? { commissionRateMin: p.commissionMinPercent, commissionRateMax: p.commissionMaxPercent } : {};
}

function seedFromRetainer(r: Retainer | undefined): Partial<AgreementTerms> {
  return r
    ? {
        commissionRateMin: null,
        commissionRateMax: null,
        fixedFeeAmount: r.monthlyAmount,
        currency: r.currency || 'NPR',
        deliverables: r.deliverablesPerMonth ? [{ description: r.deliverablesPerMonth, quantity: 1, platform: null, dueDate: null }] : [],
        payoutSchedule: 4,
      }
    : {};
}

const partnershipLabel = (p: Partnership) =>
  `${p.creatorName || (p.creatorHandle ? `@${p.creatorHandle}` : shortCreator(p.creatorAccountId ?? p.creatorProfileId))} · ${commissionRange(p.commissionMinPercent, p.commissionMaxPercent)}`;

/**
 * New agreement (`/creators/agreements/new?kind=&partnershipId=&retainerId=`), edit a draft
 * (`/:id/edit`) or amend an agreement in force (`/:id/amend`).
 */
export default function AgreementEditorPage({ mode = 'new' }: { mode?: 'new' | 'edit' | 'amend' }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const existing = useQuery({ queryKey: [CREATORS_KEY, 'agreements', 'one', id], queryFn: () => agreementsApi.get(id!), enabled: mode !== 'new' && !!id });
  const partnerships = useQuery({
    queryKey: [CREATORS_KEY, 'partnerships', 'for-agreement'],
    queryFn: () => creatorsApi.partnerships([PartnershipState.Invited, PartnershipState.Active, PartnershipState.Paused], null, 100),
    enabled: mode === 'new',
  });
  const retainers = useQuery({ queryKey: [CREATORS_KEY, 'retainers'], queryFn: creatorsApi.retainers, enabled: mode === 'new' });
  const briefs = useQuery({ queryKey: [CREATORS_KEY, 'briefs', 'locked'], queryFn: () => creatorsApi.briefs([2], null), enabled: mode === 'new' });
  const workspaces = useQuery({ queryKey: [CREATORS_KEY, 'workspaces'], queryFn: creatorsApi.workspaces, enabled: mode === 'new', retry: false });
  const templates = useQuery({ queryKey: [CREATORS_KEY, 'agreement-templates'], queryFn: agreementsApi.templates, enabled: mode === 'new', retry: false });

  const [kind, setKind] = useState<number>(Number(params.get('kind')) || AgreementKind.Partnership);
  const [partnershipId, setPartnershipId] = useState<string | null>(params.get('partnershipId'));
  const [retainerId, setRetainerId] = useState<string | null>(params.get('retainerId'));
  const [referenceId, setReferenceId] = useState<string | null>(params.get('referenceId'));
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [terms, setTerms] = useState<AgreementTerms>(defaultTerms());
  const [reason, setReason] = useState('');
  const [seeded, setSeeded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const partnership = partnerships.data?.items.find((p) => p.id === partnershipId);
  const retainer = retainers.data?.find((r) => r.id === retainerId);

  // Seed terms + title from what the agreement covers (once per source), or from the version being edited/amended.
  useEffect(() => {
    if (mode !== 'new') {
      const d = existing.data;
      if (!d || seeded === d.id) return;
      const v = d.versions[0];
      if (v?.terms) setTerms({ ...defaultTerms(), ...v.terms });
      setTitle(d.title);
      setSeeded(d.id);
      return;
    }
    const key = `${kind}:${partnershipId}:${retainerId}`;
    if (seeded === key) return;
    if (kind === AgreementKind.Retainer && retainer) {
      setTerms(defaultTerms(seedFromRetainer(retainer)));
      setTitle(`Monthly retainer — ${formatMoney({ amount: retainer.monthlyAmount, currency: retainer.currency })}`);
      setSeeded(key);
    } else if (kind !== AgreementKind.Retainer && partnership) {
      setTerms(defaultTerms(seedFromPartnership(partnership)));
      setTitle(`${agreementKindLabel[kind]} agreement — ${partnership.creatorName ?? 'creator'}`);
      setSeeded(key);
    }
  }, [mode, existing.data, kind, partnershipId, retainerId, partnership, retainer, seeded]);

  useEffect(() => {
    if (!templateId && templates.data?.length) setTemplateId((templates.data.find((t) => t.isLatestVersion) ?? templates.data[0]).id);
  }, [templates.data, templateId]);

  const body = useMemo<CreateAgreementBody>(
    () => ({
      kind,
      partnershipId: kind === AgreementKind.Retainer ? null : partnershipId,
      retainerId: kind === AgreementKind.Retainer ? retainerId : null,
      referenceId: kind === AgreementKind.Campaign || kind === AgreementKind.Brief ? referenceId : null,
      templateId,
      title: title.trim(),
      terms,
    }),
    [kind, partnershipId, retainerId, referenceId, templateId, title, terms],
  );

  const save = useMutation({
    mutationFn: async (): Promise<AgreementDetail> => {
      if (mode === 'edit') return agreementsApi.updateDraft(id!, { title: body.title, terms });
      if (mode === 'amend') return agreementsApi.amend(id!, terms, reason.trim());
      return agreementsApi.create(body);
    },
    onSuccess: (d) => {
      toastSuccess(mode === 'amend' ? 'Amendment sent. The creator is asked to sign it.' : 'Draft saved. Check the text, then send it for signature.');
      void qc.invalidateQueries({ queryKey: [CREATORS_KEY, 'agreements'] });
      navigate(`/creators/agreements/${d.id}`);
    },
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        const [field, msg] = Object.entries(e.fieldErrors)[0];
        setError(`${msg}${field ? ` (${field})` : ''}`);
      } else setError(messageOf(e));
    },
  });

  const runPreview = useMutation({
    mutationFn: () => agreementsApi.preview(body),
    onSuccess: (r) => setPreview(r.renderedText),
    onError: (e) =>
      setError(isMissingEndpoint(e) ? 'Preview is shown after you save the draft.' : messageOf(e)),
  });

  const submit = async () => {
    setError(null);
    if (mode === 'new') {
      if (kind === AgreementKind.Retainer ? !retainerId : !partnershipId) return setError(kind === AgreementKind.Retainer ? 'Choose the retainer.' : 'Choose the partnership.');
      if ((kind === AgreementKind.Campaign || kind === AgreementKind.Brief) && !referenceId) return setError(kind === AgreementKind.Brief ? 'Choose the brief.' : 'Choose the campaign.');
    }
    if (!title.trim()) return setError('Give the agreement a title.');
    const problem = validateTerms(terms);
    if (problem) return setError(problem);
    if (mode === 'amend') {
      if (!reason.trim()) return setError('Say why the agreement is being amended. The creator sees this.');
      const ok = await confirmAction({
        title: 'Send this amendment?',
        body: 'It becomes a new version. The current terms stay in force until both of you sign the new one.',
        confirmLabel: 'Send amendment',
      });
      if (!ok) return;
    }
    save.mutate();
  };

  if (mode !== 'new') {
    if (existing.isPending) return <ListSkeleton rows={6} />;
    if (existing.error) return <ErrorBlock error={existing.error} title="Could not load this agreement" onRetry={() => void existing.refetch()} />;
    if (mode === 'edit' && existing.data.status !== AgreementStatus.Draft)
      return <Alert color="gray">Only drafts can be edited. Use “Amend” to change an agreement after it was sent.</Alert>;
  }

  const heading = mode === 'amend' ? 'Amend agreement' : mode === 'edit' ? 'Edit draft' : 'New agreement';
  const back = id ? { to: `/creators/agreements/${id}`, label: 'Agreement' } : { to: '/creators/agreements', label: 'Agreements' };

  return (
    <>
      <PageHeader
        title={heading}
        back={back}
        description={
          mode === 'amend'
            ? 'Change the terms. The creator signs the new version; until then the current version stays in force.'
            : 'Fill in the agreed terms. They are put into StyleMint’s Nepal creator agreement template, which both sides sign.'
        }
      />
      <Stack gap="lg" maw={860}>
        {error && (
          <Alert color="signal" variant="light" role="alert" data-testid="editor-error">
            {error}
          </Alert>
        )}
        <SectionCard title="Agreement">
          <Stack gap="sm">
            {mode === 'new' && (
              <>
                <Select
                  label="Covers"
                  allowDeselect={false}
                  data={Object.entries(agreementKindLabel).map(([v, l]) => ({ value: v, label: l }))}
                  value={String(kind)}
                  onChange={(v) => {
                    setKind(Number(v));
                    setReferenceId(null);
                  }}
                />
                {kind === AgreementKind.Retainer ? (
                  <Select
                    label="Retainer"
                    placeholder={retainers.isPending ? 'Loading…' : retainers.data?.length ? 'Choose a retainer' : 'No retainers yet'}
                    data={(retainers.data ?? []).map((r) => ({
                      value: r.id,
                      label: `${shortCreator(r.creatorAccountId)} · ${formatMoney({ amount: r.monthlyAmount, currency: r.currency })}/month`,
                    }))}
                    value={retainerId}
                    onChange={setRetainerId}
                    searchable
                  />
                ) : (
                  <Select
                    label="Partnership"
                    placeholder={partnerships.isPending ? 'Loading…' : partnerships.data?.items.length ? 'Choose a creator partnership' : 'No partnerships yet'}
                    data={(partnerships.data?.items ?? []).map((p) => ({ value: p.id, label: partnershipLabel(p) }))}
                    value={partnershipId}
                    onChange={setPartnershipId}
                    searchable
                    error={partnerships.error ? 'Could not load partnerships' : undefined}
                  />
                )}
                {kind === AgreementKind.Brief && (
                  <Select
                    label="Brief"
                    placeholder="Choose a locked brief"
                    data={(briefs.data?.items ?? []).map((b) => ({ value: b.id, label: `${b.title} (v${b.version})` }))}
                    value={referenceId}
                    onChange={setReferenceId}
                  />
                )}
                {kind === AgreementKind.Campaign && (
                  <Select
                    label="Campaign"
                    placeholder={workspaces.data?.length ? 'Choose a campaign' : 'No campaigns yet'}
                    data={(workspaces.data ?? []).map((w) => ({ value: w.id, label: w.name }))}
                    value={referenceId}
                    onChange={setReferenceId}
                  />
                )}
                {!!templates.data?.length && (
                  <Select
                    label="Template"
                    allowDeselect={false}
                    data={templates.data.map((t) => ({ value: t.id, label: `${t.name} v${t.version}${t.reviewedByLegal ? ' · legally reviewed' : ''}` }))}
                    value={templateId}
                    onChange={setTemplateId}
                  />
                )}
              </>
            )}
            {mode !== 'amend' && <TextInput label="Title" maxLength={200} value={title} onChange={(e) => setTitle(e.currentTarget.value)} />}
            {mode === 'amend' && (
              <Textarea
                label="Why are you amending it?"
                placeholder="e.g. Extending for the Tihar season with two more reels"
                maxLength={500}
                autosize
                minRows={2}
                value={reason}
                onChange={(e) => setReason(e.currentTarget.value)}
              />
            )}
            {partnership && mode === 'new' && kind !== AgreementKind.Retainer && (
              <Text size="xs" c="dimmed">
                The partnership currently pays {commissionRange(partnership.commissionMinPercent, partnership.commissionMaxPercent)}. Commission in the
                agreement starts from that.
              </Text>
            )}
          </Stack>
        </SectionCard>

        <TermsForm value={terms} onChange={setTerms} />

        <Card>
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Text size="sm" c="dimmed">
              Commission {terms.commissionRateMin !== null ? commissionRange(terms.commissionRateMin, terms.commissionRateMax) : '—'} · fee{' '}
              {terms.fixedFeeAmount ? formatMoney(terms.fixedFeeAmount) : '—'} · {terms.deliverables.length} deliverables
              {terms.exclusive ? ' · exclusive' : ''}
            </Text>
            <Group gap="xs">
              {mode === 'new' && (
                <Button variant="default" leftSection={<IconEye size={16} />} loading={runPreview.isPending} onClick={() => runPreview.mutate()}>
                  Preview text
                </Button>
              )}
              <Button variant="default" onClick={() => navigate(back.to)}>
                Cancel
              </Button>
              <Button onClick={submit} loading={save.isPending}>
                {mode === 'amend' ? 'Send amendment' : 'Save draft'}
              </Button>
            </Group>
          </Group>
        </Card>
      </Stack>
      <Modal opened={preview !== null} onClose={() => setPreview(null)} title="Agreement preview" size="xl">
        {preview !== null && <AgreementText text={preview} />}
      </Modal>
    </>
  );
}

