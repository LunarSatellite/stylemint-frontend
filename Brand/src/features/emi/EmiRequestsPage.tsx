import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { messageOf } from '../../api/client';
import {
  AgreementState,
  DocumentKind,
  emiApi,
  reasonLabel,
  riskBandLabel,
  type CreditDocument,
  type EmiApplication,
} from './api';

const money = (amount: number, currency: string) =>
  `${currency === 'NPR' ? 'Rs' : currency} ${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function DocumentButton({ agreementId, doc, index }: { agreementId: string; doc: CreditDocument; index: number }) {
  const [opening, setOpening] = useState(false);
  const label = `${doc.kind === DocumentKind.Identity ? 'Identity document' : 'Financial proof'} ${index + 1}`;
  const open = async () => {
    // Asked for one at a time, only on request: each opening is recorded.
    setOpening(true);
    try {
      const { url } = await emiApi.documentLink(agreementId, doc.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      notifications.show({ color: 'red', message: messageOf(error) });
    } finally {
      setOpening(false);
    }
  };
  return (
    <Button size="xs" variant="light" loading={opening} onClick={open}>
      Open {label} ({doc.contentType === 'application/pdf' ? 'PDF' : 'image'})
    </Button>
  );
}

function ApplicationCard({ app, pending }: { app: EmiApplication; pending: boolean }) {
  const client = useQueryClient();
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  const a = app.agreement;
  const done = () => {
    void client.invalidateQueries({ queryKey: ['emi-applications'] });
  };
  const approve = useMutation({
    mutationFn: () => emiApi.approve(a.id),
    onSuccess: () => {
      notifications.show({ color: 'green', message: `Approved. ${app.buyerDisplayName} can now pay the down payment.` });
      done();
    },
    onError: (error) => notifications.show({ color: 'red', message: messageOf(error) }),
  });
  const decline = useMutation({
    mutationFn: () => emiApi.decline(a.id, note.trim()),
    onSuccess: () => {
      setDeclining(false);
      notifications.show({ message: 'Declined. The buyer has been told why.' });
      done();
    },
    onError: (error) => notifications.show({ color: 'red', message: messageOf(error) }),
  });
  const identity = app.documents.filter((d) => d.kind === DocumentKind.Identity);
  const financial = app.documents.filter((d) => d.kind === DocumentKind.Financial);

  return (
    <Card withBorder radius="md" padding="md" data-testid={`emi-application-${a.id}`}>
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start">
          <div>
            <Text fw={700}>{app.productName || 'Product'}</Text>
            <Text size="sm" c="dimmed">
              Buyer: {app.buyerDisplayName}
            </Text>
          </div>
          {app.riskBand != null && (
            <Badge variant="light" color={app.riskBand >= 4 ? 'orange' : 'green'}>
              Risk band {riskBandLabel[app.riskBand]}
              {app.riskScore != null ? ` · ${app.riskScore}` : ''}
            </Badge>
          )}
        </Group>
        <Text size="sm">
          {money(a.price, a.currency)} · {a.tenureMonths} months · down payment {money(a.downPayment, a.currency)} · then{' '}
          {money(app.monthlyInstalment, a.currency)}/month
        </Text>
        {app.riskReasons.length > 0 && (
          <Text size="xs" c="dimmed">
            Notes: {app.riskReasons.map(reasonLabel).join(' · ')}
          </Text>
        )}
        {!a.documentsSubmittedUtc && pending && (
          <Alert color="yellow" p="xs">
            The buyer has not sent their documents yet.
          </Alert>
        )}
        <Group gap="xs">
          {identity.map((d, i) => (
            <DocumentButton key={d.id} agreementId={a.id} doc={d} index={i} />
          ))}
          {financial.map((d, i) => (
            <DocumentButton key={d.id} agreementId={a.id} doc={d} index={i} />
          ))}
        </Group>
        {a.decisionNote && (
          <Text size="sm" c="dimmed">
            Your note: {a.decisionNote}
          </Text>
        )}
        {pending && (
          <Group>
            <Button color="forest" loading={approve.isPending} onClick={() => approve.mutate()}>
              Approve
            </Button>
            <Button variant="outline" color="red" onClick={() => setDeclining(true)}>
              Decline
            </Button>
          </Group>
        )}
      </Stack>
      <Modal opened={declining} onClose={() => setDeclining(false)} title="Decline this EMI request">
        <Stack>
          <Textarea
            label="Reason (shown to the buyer)"
            maxLength={500}
            minRows={3}
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeclining(false)}>
              Cancel
            </Button>
            <Button color="red" disabled={!note.trim()} loading={decline.isPending} onClick={() => decline.mutate()}>
              Decline request
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}

/** EMI requests: buyers asking to pay for the seller's products in instalments, for the seller to decide. */
export default function EmiRequestsPage() {
  const [state, setState] = useState<string>(String(AgreementState.PendingApproval));
  const query = useQuery({
    queryKey: ['emi-applications', state],
    queryFn: () => emiApi.applications(Number(state)),
  });
  const pending = Number(state) === AgreementState.PendingApproval;
  return (
    <Stack>
      <Title order={2}>EMI requests</Title>
      <Text c="dimmed" size="sm">
        Buyers who want to pay for your products in monthly instalments. Check their identity and financial documents,
        then approve or decline. Once approved, they pay the down payment and the order comes to you.
      </Text>
      <SegmentedControl
        value={state}
        onChange={setState}
        data={[
          { value: String(AgreementState.PendingApproval), label: 'Waiting for you' },
          { value: String(AgreementState.Approved), label: 'Approved' },
          { value: String(AgreementState.Declined), label: 'Declined' },
        ]}
      />
      {query.isLoading && <Loader color="forest" />}
      {query.isError && <Alert color="red">{messageOf(query.error)}</Alert>}
      {query.data && query.data.length === 0 && <Text c="dimmed">Nothing here.</Text>}
      {query.data?.map((app) => <ApplicationCard key={app.agreement.id} app={app} pending={pending} />)}
    </Stack>
  );
}
