import { useState, type ReactNode } from 'react';
import { Alert, Anchor, Badge, Button, Divider, Skeleton, Stack, Text, Timeline } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconHandGrab, IconPhoto } from '@tabler/icons-react';
import { messageOf } from '@/api/errors';
import {
  ageFrom,
  APPLICANT_KIND,
  DECISION_LABEL,
  DECISION_TONE,
  ID_TYPE_LABEL,
  kycApi,
  REASON_LABEL,
  REVIEW_STATE,
  REVIEW_STATE_LABEL,
  requiredSlots,
  slotOf,
  type DocSlot,
  type KycApplicationDetail,
  type KycDocument,
  type KycReasonCode,
  type KycReviewItem,
} from '@/api/kyc';
import { SERVICE_CATEGORY, SERVICE_CATEGORY_BANK } from '@/api/services';
import { useAuth } from '@/auth/guards';
import { DetailDrawer } from '@/components/DetailDrawer';
import { DocumentGrid, DocumentTile, type ViewerDoc } from '@/components/DocumentViewer';
import { FieldGrid, IdText, When } from '@/components/Bits';
import { ErrorBlock, SectionCard } from '@/components/StateBlocks';
import { fmtDate, fmtPercent, humanize, mask } from '@/lib/format';
import { KycDecisionForm } from './KycDecisionForm';

/**
 * What a vendor offers and its operating licence (service-banks-contract v1 §1). A product seller (0, or an older
 * server without the field) shows "Product seller" and no licence rows. A bank without an NRB licence number is
 * flagged - the server refuses to submit one, so it only happens on data from before the rule.
 */
export function serviceVendorFields(detail: KycApplicationDetail): { label: string; value: ReactNode; wide?: boolean }[] {
  const category = detail.serviceCategory ?? 0;
  const offers = {
    label: 'Offers',
    value: category === 0 ? SERVICE_CATEGORY[0] : (
      <Badge variant="light" color={category === SERVICE_CATEGORY_BANK ? 'blue' : 'grape'} data-testid="service-category">
        {SERVICE_CATEGORY[category] ?? detail.serviceCategoryName ?? `Category ${category}`}
      </Badge>
    ),
  };
  if (category === 0) return [offers];
  const isBank = category === SERVICE_CATEGORY_BANK;
  const expired = !!detail.licenceExpiresOn && detail.licenceExpiresOn < new Date().toISOString().slice(0, 10);
  return [
    offers,
    {
      label: isBank ? 'NRB licence number' : 'Tourism licence number',
      value: detail.licenceNumber ? (
        <span className="sm-mono" data-testid="licence-number">
          {detail.licenceNumber}
        </span>
      ) : isBank ? (
        <Text span c="signal" size="sm">
          Missing
        </Text>
      ) : null,
    },
    { label: 'Licence issued by', value: detail.licenceIssuer ?? (isBank ? 'Nepal Rastra Bank' : null) },
    {
      label: 'Licence valid until',
      value: detail.licenceExpiresOn ? (
        <>
          {fmtDate(detail.licenceExpiresOn)}{' '}
          {expired && (
            <Badge size="xs" color="signal" variant="light">
              Expired
            </Badge>
          )}
        </>
      ) : null,
    },
  ];
}

const SLOT_LABEL: Record<DocSlot, string> = { front: 'Front', back: 'Back', bio: 'Photo page', selfie: 'Selfie', other: 'Other' };

function docLabel(doc: KycDocument): string {
  if (doc.kind) return humanize(doc.kind);
  const side = doc.side && doc.side !== 'NotApplicable' ? ` - ${doc.side.toLowerCase()}` : '';
  return `${humanize(doc.documentType)}${side}`;
}

function toViewer(doc: KycDocument, slot?: DocSlot): ViewerDoc {
  return {
    id: doc.id,
    label: slot && slot !== 'other' ? `${SLOT_LABEL[slot]} · ${docLabel(doc)}` : docLabel(doc),
    status: doc.status,
    contentType: doc.contentType,
    sizeBytes: doc.contentSizeBytes,
    uploadedUtc: doc.uploadedUtc,
    filename: doc.originalFilename,
    rejectionReason: doc.rejectionReason,
    emphasis: slot === 'selfie',
  };
}

export function KycDetailDrawer({ itemId, onClose }: { itemId: string | null; onClose: () => void }) {
  const opened = itemId !== null;
  const item = useQuery({ queryKey: ['kyc', 'item', itemId], queryFn: ({ signal }) => kycApi.item(itemId!, signal), enabled: opened, staleTime: 10_000 });
  const app = useQuery({ queryKey: ['kyc', 'application', itemId], queryFn: ({ signal }) => kycApi.application(itemId!, signal), enabled: opened, staleTime: 30_000 });
  const detail = app.data;
  const title = detail ? detail.fullName || detail.displayName || 'Applicant' : 'Application';

  return (
    <DetailDrawer
      opened={opened}
      onClose={onClose}
      title={title}
      subtitle={detail ? `${detail.applicantType} application${detail.legalName ? ` · ${detail.legalName}` : ''}` : undefined}
      badges={
        item.data && (
          <>
            <Badge variant="light" color={item.data.state === REVIEW_STATE.Decided ? 'gray' : item.data.state === REVIEW_STATE.InReview ? 'blue' : 'amber'}>
              {REVIEW_STATE_LABEL[item.data.state]}
            </Badge>
            {item.data.decision && (
              <Badge variant="light" color={DECISION_TONE[String(item.data.decision)]}>
                {DECISION_LABEL[String(item.data.decision)]}
              </Badge>
            )}
            {item.data.state !== REVIEW_STATE.Decided && new Date(item.data.dueByUtc).getTime() < Date.now() && (
              <Badge variant="filled" color="signal">
                Overdue
              </Badge>
            )}
          </>
        )
      }
    >
      {item.error || app.error ? (
        <ErrorBlock error={item.error ?? app.error} onRetry={() => void Promise.all([item.refetch(), app.refetch()])} />
      ) : !item.data || !detail ? (
        <Stack gap="md">
          <Skeleton height={90} radius="lg" />
          <Skeleton height={240} radius="lg" />
        </Stack>
      ) : (
        <KycCase item={item.data} detail={detail} />
      )}
    </DetailDrawer>
  );
}

function KycCase({ item, detail }: { item: KycReviewItem; detail: KycApplicationDetail }) {
  const { can, claims } = useAuth();
  const queryClient = useQueryClient();
  const isCustomer = detail.applicantKind === APPLICANT_KIND.Customer;
  const decided = item.state === REVIEW_STATE.Decided;

  const claim = useMutation({
    mutationFn: () => kycApi.assign(item.id),
    onSuccess: () => {
      notifications.show({ color: 'forest', title: 'Assigned to you', message: 'The application is now in your review.' });
      void queryClient.invalidateQueries({ queryKey: ['kyc'] });
    },
    onError: (e) => notifications.show({ color: 'signal', title: 'Could not claim', message: messageOf(e) }),
  });

  // Customer ID photos go into slots so the front, back and selfie line up for comparison.
  const slotted = detail.documents.map((d) => ({ doc: d, slot: slotOf(d) }));
  const required = isCustomer ? requiredSlots(detail.documentType) : [];
  const missing = required.filter((s) => !slotted.some((x) => x.slot === s));
  const order: DocSlot[] = ['front', 'back', 'bio', 'selfie', 'other'];
  slotted.sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
  const [showAll, setShowAll] = useState(false);
  const age = ageFrom(detail.dateOfBirth);
  const suggested: KycReasonCode | null = missing.length > 0 ? 'DOCS_UNCLEAR' : age !== null && age < 18 ? 'UNDERAGE' : null;
  const assignedToMe = item.assignedReviewerId && claims?.adminAccountId && item.assignedReviewerId === claims.adminAccountId;

  const isCourier = detail.applicantKind === APPLICANT_KIND.Courier;
  const applicantFields = isCourier
    ? [
        { label: 'Name', value: detail.displayName },
        { label: 'Government ID', value: detail.documentNumberMasked ?? (detail.documentNumberLast4 ? `•••• ${detail.documentNumberLast4}` : null) },
        { label: 'Vehicle', value: detail.vehicle ? humanize(detail.vehicle) : null },
        { label: 'Home area', value: detail.homeArea ? <span className="sm-mono">{detail.homeArea}</span> : null },
        { label: 'Rider state', value: detail.courierState ? humanize(detail.courierState) : null },
      ]
    : isCustomer
    ? [
        { label: 'Full name', value: detail.fullName },
        {
          label: 'Date of birth',
          value: detail.dateOfBirth ? (
            <>
              {fmtDate(detail.dateOfBirth)}{' '}
              {age !== null && (
                <Badge size="xs" variant="light" color={age < 18 ? 'signal' : 'gray'}>
                  {age < 18 ? `Under 18 (${age})` : `${age} years`}
                </Badge>
              )}
            </>
          ) : null,
        },
        { label: 'ID type', value: detail.documentType ? ID_TYPE_LABEL[detail.documentType] ?? humanize(detail.documentType) : null },
        { label: 'ID number', value: <span className="sm-mono">{detail.documentNumberMasked ? mask(detail.documentNumberMasked) : detail.documentNumberLast4 ? `•••• ${detail.documentNumberLast4}` : '—'}</span> },
        { label: 'Address', value: [detail.addressLine, detail.city, detail.stateProvince, detail.postalCode, detail.countryCode].filter(Boolean).join(', '), wide: true },
      ]
    : [
        { label: 'Display name', value: detail.displayName },
        { label: 'Legal name', value: detail.legalName },
        { label: 'Registration number', value: detail.registrationNumber ? <span className="sm-mono">{mask(detail.registrationNumber)}</span> : null },
        { label: 'Tax ID (PAN/VAT)', value: detail.taxId ? <span className="sm-mono">{mask(detail.taxId)}</span> : null },
        { label: 'Location', value: [detail.addressLine, detail.city, detail.countryCode].filter(Boolean).join(', ') },
        {
          label: 'Website',
          value: detail.website ? (
            <Anchor href={/^https?:\/\//i.test(detail.website) ? detail.website : `https://${detail.website}`} target="_blank" rel="noopener noreferrer nofollow" size="sm">
              {detail.website}
            </Anchor>
          ) : null,
        },
        ...(detail.applicantKind === APPLICANT_KIND.Vendor ? serviceVendorFields(detail) : []),
        ...(detail.applicantKind === APPLICANT_KIND.Vendor
          ? [
              {
                label: 'Commission range',
                value:
                  detail.serviceCategory === SERVICE_CATEGORY_BANK ? (
                    <Text span c="dimmed" size="sm">
                      Not applicable - banks pay no commission
                    </Text>
                  ) : !detail.commissionMinPercent && !detail.commissionMaxPercent ? (
                    <Text span c="signal" size="sm">
                      Not collected
                    </Text>
                  ) : (
                    `${fmtPercent(detail.commissionMinPercent, 0)} – ${fmtPercent(detail.commissionMaxPercent, 0)}`
                  ),
              },
            ]
          : []),
        { label: 'Story', value: detail.story, wide: true },
      ];

  return (
    <Stack gap="lg">
      <SectionCard
        title="Applicant"
        action={
          !decided &&
          can('decideKyc') &&
          (item.state === REVIEW_STATE.Pending || !assignedToMe) && (
            <Button size="xs" variant="light" leftSection={<IconHandGrab size={14} />} loading={claim.isPending} onClick={() => claim.mutate()}>
              {item.state === REVIEW_STATE.Pending ? 'Claim for review' : 'Take over'}
            </Button>
          )
        }
      >
        <FieldGrid
          fields={[
            ...applicantFields,
            { label: 'Account', value: <IdText value={detail.accountId} /> },
            { label: 'Submitted', value: <When value={detail.submittedUtc} /> },
            { label: 'Due by', value: <When value={item.dueByUtc} /> },
            { label: 'Reviewer', value: item.assignedReviewerId ? (assignedToMe ? 'You' : <IdText value={item.assignedReviewerId} />) : 'Unassigned' },
          ]}
        />
      </SectionCard>

      <SectionCard
        title={`Documents (${detail.documents.length})`}
        description={isCustomer ? 'Compare the ID photos with the selfie. Files open only when you ask, and each view is audited.' : 'Every identity document on the account. Each view is audited.'}
        action={
          detail.documents.length > 0 &&
          !showAll && (
            <Button size="xs" variant="light" leftSection={<IconPhoto size={14} />} onClick={() => setShowAll(true)}>
              Show side by side
            </Button>
          )
        }
      >
        <Stack gap="md">
          {missing.length > 0 && (
            <Alert color="amber" variant="light" icon={<IconAlertTriangle size={16} />}>
              Missing for {ID_TYPE_LABEL[detail.documentType ?? ''] ?? 'this ID'}: {missing.map((m) => SLOT_LABEL[m].toLowerCase()).join(', ')}. Consider “{REASON_LABEL.DOCS_UNCLEAR}”.
            </Alert>
          )}
          {detail.documents.length === 0 ? (
            <Text size="sm" c="dimmed">
              No documents on file.
            </Text>
          ) : (
            <DocumentGrid cols={isCustomer ? 3 : 2}>
              {slotted.map(({ doc, slot }) => (
                <DocumentTile
                  key={doc.id}
                  doc={toViewer(doc, isCustomer ? slot : undefined)}
                  autoLoad={showAll}
                  queryKey={['kyc', 'doc-link', item.id, doc.id]}
                  fetchLink={(signal) => kycApi.documentLink(item.id, doc.id, signal)}
                />
              ))}
            </DocumentGrid>
          )}
        </Stack>
      </SectionCard>

      {detail.previousAttempts && detail.previousAttempts.length > 0 && (
        <SectionCard title="Earlier attempts">
          <Timeline bulletSize={14} lineWidth={2}>
            {detail.previousAttempts.map((a, i) => (
              <Timeline.Item key={a.kycItemId ?? i} title={a.decision ? DECISION_LABEL[a.decision] ?? humanize(a.decision) : 'Undecided'}>
                <Text size="xs" c="dimmed">
                  Submitted <When value={a.submittedUtc} />
                  {a.decidedUtc && (
                    <>
                      {' '}
                      · decided <When value={a.decidedUtc} />
                    </>
                  )}
                </Text>
                {a.decisionReasonCode && <Text size="sm">{REASON_LABEL[a.decisionReasonCode as KycReasonCode] ?? a.decisionReasonCode}</Text>}
                {a.decisionNote && (
                  <Text size="sm" c="dimmed">
                    “{a.decisionNote}”
                  </Text>
                )}
              </Timeline.Item>
            ))}
          </Timeline>
        </SectionCard>
      )}

      {decided ? (
        <SectionCard title="Decision">
          <FieldGrid
            fields={[
              { label: 'Outcome', value: item.decision ? DECISION_LABEL[String(item.decision)] : null },
              { label: 'Decided', value: <When value={item.decidedUtc} /> },
              { label: 'Reason', value: item.decisionReasonCode ? REASON_LABEL[item.decisionReasonCode as KycReasonCode] ?? item.decisionReasonCode : null },
              { label: 'Note', value: item.decisionNote, wide: true },
            ]}
          />
        </SectionCard>
      ) : can('decideKyc') ? (
        <>
          <Divider />
          <KycDecisionForm item={item} suggestedReason={suggested} />
        </>
      ) : (
        <Text size="sm" c="dimmed">
          Your role can read applications but not decide them.
        </Text>
      )}
    </Stack>
  );
}
