import { useState } from 'react';
import { Alert, Button, Group, Paper, SegmentedControl, Select, Stack, Text, Textarea } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconCheck, IconX } from '@tabler/icons-react';
import { messageOf } from '@/api/errors';
import {
  APPLICANT_KIND,
  DECISION,
  DECISION_LABEL,
  decideKyc,
  REASON_LABEL,
  reasonCodesFor,
  type KycDecision,
  type KycReasonCode,
  type KycReviewItem,
} from '@/api/kyc';

/**
 * Approve, reject with a chance to reapply, or reject for good - always with a reason code on a rejection (the server
 * insists, and the class must match the decision) and an optional note. A buyer's note is shown to them in the app,
 * so it is labelled as such.
 */
export function KycDecisionForm({
  item,
  suggestedReason,
  onDecided,
}: {
  item: Pick<KycReviewItem, 'id' | 'state' | 'applicantKind'>;
  /** e.g. DOCS_UNCLEAR when a required photo is missing. */
  suggestedReason?: KycReasonCode | null;
  onDecided?: (result: KycReviewItem) => void;
}) {
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<KycDecision>(DECISION.Approved);
  const [reason, setReason] = useState<KycReasonCode | null>(null);
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [touched, setTouched] = useState(false);
  const isCustomer = item.applicantKind === APPLICANT_KIND.Customer;
  const codes = reasonCodesFor(decision, item.applicantKind);
  const needsReason = decision !== DECISION.Approved;
  const reasonError = touched && needsReason && !reason ? 'Choose the reason for the rejection' : null;

  const mutation = useMutation({
    mutationFn: () =>
      decideKyc(item, {
        decision,
        decisionReasonCode: needsReason ? reason : null,
        decisionNote: note.trim() ? note.trim() : null,
      }),
    onSuccess: (result) => {
      notifications.show({ color: decision === DECISION.Approved ? 'forest' : 'amber', title: 'Decision recorded', message: DECISION_LABEL[String(decision)] });
      void queryClient.invalidateQueries({ queryKey: ['kyc'] });
      setConfirming(false);
      onDecided?.(result);
    },
  });

  const choose = (value: string) => {
    const next = Number(value) as KycDecision;
    setDecision(next);
    const allowed = reasonCodesFor(next, item.applicantKind);
    setReason(suggestedReason && allowed.includes(suggestedReason) ? suggestedReason : null);
    setConfirming(false);
    setTouched(false);
    mutation.reset();
  };

  const review = () => {
    setTouched(true);
    if (needsReason && !reason) return;
    setConfirming(true);
  };

  return (
    <Paper withBorder p="md" radius="lg" data-testid="kyc-decision">
      <Stack gap="sm">
        <Text fw={650}>Decision</Text>
        <SegmentedControl
          fullWidth
          value={String(decision)}
          onChange={choose}
          data={[
            { value: String(DECISION.Approved), label: 'Approve' },
            { value: String(DECISION.RejectedRetryable), label: 'Reject - may reapply' },
            { value: String(DECISION.RejectedTerminal), label: 'Reject - final' },
          ]}
          aria-label="Decision"
          disabled={mutation.isPending}
        />
        {needsReason && (
          <Select
            label="Reason"
            required
            placeholder="Choose a reason"
            data={codes.map((c) => ({ value: c, label: REASON_LABEL[c] }))}
            value={reason}
            onChange={(v) => setReason((v as KycReasonCode | null) ?? null)}
            error={reasonError}
            comboboxProps={{ withinPortal: true }}
          />
        )}
        <Textarea
          label={isCustomer && needsReason ? 'Message to the buyer' : 'Note'}
          description={
            isCustomer && needsReason
              ? 'Shown to the buyer in the app with the reason. Say what to fix.'
              : 'Kept with the decision in the audit log.'
          }
          maxLength={1000}
          autosize
          minRows={2}
          maxRows={6}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          disabled={mutation.isPending}
        />
        {decision === DECISION.RejectedTerminal && (
          <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />}>
            A final rejection cannot be appealed through the app. Use it for fraud, sanctions or age - not for blurry photos.
          </Alert>
        )}
        {mutation.error && (
          <Alert color="signal" variant="light" role="alert" icon={<IconAlertTriangle size={16} />}>
            {messageOf(mutation.error)}
          </Alert>
        )}
        {!confirming ? (
          <Group justify="flex-end">
            <Button onClick={review} color={decision === DECISION.Approved ? 'forest' : 'signal'} leftSection={decision === DECISION.Approved ? <IconCheck size={16} /> : <IconX size={16} />}>
              {decision === DECISION.Approved ? 'Approve…' : 'Reject…'}
            </Button>
          </Group>
        ) : (
          <Alert color={decision === DECISION.Approved ? 'forest' : 'amber'} variant="light" title="Confirm the decision">
            <Stack gap="xs">
              <Text size="sm">
                {DECISION_LABEL[String(decision)]}
                {reason ? ` - ${REASON_LABEL[reason]}` : ''}. Decisions are final and recorded in the audit log.
                {item.state === 1 ? ' The application will be assigned to you first.' : ''}
              </Text>
              <Group justify="flex-end" gap="sm">
                <Button variant="default" size="xs" onClick={() => setConfirming(false)} disabled={mutation.isPending}>
                  Back
                </Button>
                <Button size="xs" color={decision === DECISION.Approved ? 'forest' : 'signal'} loading={mutation.isPending} onClick={() => mutation.mutate()}>
                  Confirm {decision === DECISION.Approved ? 'approval' : 'rejection'}
                </Button>
              </Group>
            </Stack>
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
