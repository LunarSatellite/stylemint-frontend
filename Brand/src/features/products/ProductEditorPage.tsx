import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Group, Progress, Stack, Stepper, Text } from '@mantine/core';
import { IconAlertTriangle, IconArchive, IconCircleCheck, IconRocket } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, messageOf } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import { useIsPhone } from '../../lib/useIsPhone';
import { ProductState, productsApi, productStateColor, productStateLabel, type Product } from './api';
import { EmiCard } from './EmiCard';
import { toPricingRequest, toShippingRequest, type BasicsForm, type PricingForm, type ShippingForm } from './schemas';
import { BasicsStep } from './steps/BasicsStep';
import { AttributesCard } from './steps/DetailsStep';
import { PhotosStep, type PhotoItem } from './steps/PhotosStep';
import { PricingStep } from './steps/PricingStep';
import { ShippingStep } from './steps/ShippingStep';
import { TryOnBadge, TryOnStep, tryOnGate, useTryOnReadiness } from './steps/TryOnStep';

const STEPS = ['Basics', 'Photos', 'Price & variants', 'Delivery', 'Try-on & sizes', 'Details & publish'];
/** Steps 0–3 are tracked by the backend (`wizardStepReached` 0–4); try-on and publish open once delivery is saved. */
const TRYON_STEP = 4;
const LAST_STEP = STEPS.length - 1;

function friendly(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'state.duplicate') return 'That SKU is already used by another of your products. Use a different SKU.';
    if (e.status === 403 && e.message.toLowerCase().includes('gated'))
      return 'This category needs StyleMint’s approval before you can sell in it. Choose another category or contact support.';
    if (e.code === 'state.concurrency_conflict') return 'This product changed in the meantime. Reload the page and try again.';
  }
  return messageOf(e);
}

/**
 * Add / edit a product. A draft goes through the wizard steps in order (the backend tracks
 * `wizardStepReached`); a live product shows the same sections as free tabs and saves through the
 * `details/*` routes.
 */
export default function ProductEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isPhone = useIsPhone();
  const product = useQuery({ queryKey: ['product', id], queryFn: () => productsApi.detail(id!), enabled: !!id });
  const [active, setActive] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [initialised, setInitialised] = useState<string | null>(null);

  const p = product.data ?? null;
  const isDraft = !p || p.state === ProductState.Draft;
  const reached = p ? p.wizardStepReached : 0;
  const readiness = useTryOnReadiness(p?.id);

  // Open a draft where the seller left off.
  useEffect(() => {
    if (p && initialised !== p.id) {
      setInitialised(p.id);
      setActive(p.state === ProductState.Draft ? Math.min(reached, 4) : 0);
    }
  }, [p, reached, initialised]);

  const afterSave = (saved: Product, message: string) => {
    qc.setQueryData(['product', saved.id], saved);
    void qc.invalidateQueries({ queryKey: ['products'] });
    setServerError(null);
    toastSuccess(message);
    setActive((s) => Math.min(s + 1, LAST_STEP));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveBasics = useMutation({
    mutationFn: async (form: BasicsForm) => {
      if (!p) return productsApi.create(form);
      return isDraft ? productsApi.step1(p.id, form) : productsApi.basic(p.id, form);
    },
    onSuccess: (saved) => {
      if (!p) {
        qc.setQueryData(['product', saved.id], saved);
        setInitialised(saved.id);
        setActive(1);
        void qc.invalidateQueries({ queryKey: ['products'] });
        toastSuccess('Draft created — now add photos');
        navigate(`/products/${saved.id}`, { replace: true });
        return;
      }
      afterSave(saved, 'Basics saved');
    },
    onError: (e) => setServerError(friendly(e)),
  });

  const savePhotos = useMutation({
    mutationFn: (images: PhotoItem[]) => {
      const body = {
        images: images.map((img, i) => ({ cdnUrl: img.url, sortOrder: i, isPrimary: img.primary })),
        // Replace semantics: keep an existing video.
        video: p!.video ? { cdnUrl: p!.video.cdnUrl, durationSeconds: p!.video.durationSeconds, posterCdnUrl: p!.video.posterCdnUrl } : null,
      };
      return isDraft ? productsApi.step2(p!.id, body) : productsApi.images(p!.id, body);
    },
    onSuccess: (saved) => afterSave(saved, 'Photos saved'),
    onError: (e) => setServerError(friendly(e)),
  });

  const savePricing = useMutation({
    mutationFn: (form: PricingForm) => {
      const body = toPricingRequest(form, (p?.options.length ?? 0) > 0);
      return isDraft ? productsApi.step3(p!.id, body) : productsApi.pricing(p!.id, body);
    },
    onSuccess: (saved) => afterSave(saved, 'Prices saved'),
    onError: (e) => setServerError(friendly(e)),
  });

  const saveShipping = useMutation({
    mutationFn: (form: ShippingForm) => {
      const body = toShippingRequest(form);
      return isDraft ? productsApi.step4(p!.id, body) : productsApi.shipping(p!.id, body);
    },
    onSuccess: (saved) => afterSave(saved, 'Delivery saved'),
    onError: (e) => setServerError(friendly(e)),
  });

  const publish = useMutation({
    mutationFn: () => productsApi.publish(p!.id),
    onSuccess: (saved) => {
      qc.setQueryData(['product', saved.id], saved);
      void qc.invalidateQueries({ queryKey: ['products'] });
      toastSuccess('Your product is live on StyleMint');
    },
    onError: (e) => toastError(e, 'Could not publish'),
  });

  const archive = useMutation({
    mutationFn: () => productsApi.archive(p!.id),
    onSuccess: (saved) => {
      qc.setQueryData(['product', saved.id], saved);
      void qc.invalidateQueries({ queryKey: ['products'] });
      toastSuccess(saved.state === ProductState.Archived ? 'Product archived' : 'Done');
      navigate('/products');
    },
    onError: (e) => toastError(e, 'Could not archive'),
  });

  const onArchive = async () => {
    const ok = await confirmAction({
      title: isDraft ? 'Delete this draft?' : 'Archive this product?',
      body: isDraft
        ? 'The draft is archived and disappears from your list. This cannot be undone.'
        : 'Customers can no longer buy it. Archiving cannot be undone — to sell it again you would add it as a new product.',
      confirmLabel: isDraft ? 'Delete draft' : 'Archive',
      danger: true,
    });
    if (ok) archive.mutate();
  };

  if (id && product.isPending) {
    return (
      <>
        <PageHeader title="Edit product" back={{ to: '/products', label: 'Products' }} />
        <ListSkeleton rows={5} height={56} />
      </>
    );
  }
  if (id && (product.error || !p)) {
    return (
      <>
        <PageHeader title="Edit product" back={{ to: '/products', label: 'Products' }} />
        <ErrorBlock error={product.error ?? new Error('Not found')} onRetry={() => void product.refetch()} title="Could not load this product" />
      </>
    );
  }

  const canOpen = (i: number) => !isDraft || i === 0 || (p !== null && (i <= reached || (i >= TRYON_STEP && reached >= 4)));
  const gate = p ? tryOnGate(p, readiness) : { block: null, warn: null };
  const goToTryOn = () => {
    setActive(TRYON_STEP);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const readOnly = p?.state === ProductState.Archived || p?.state === ProductState.Suspended;
  const setStep = (i: number) => {
    if (canOpen(i)) {
      setServerError(null);
      setActive(i);
    }
  };

  const stepBody = () => {
    switch (active) {
      case 0:
        return <BasicsStep key={p?.id ?? 'new'} product={p} onSave={(f) => saveBasics.mutate(f)} saving={saveBasics.isPending} serverError={serverError} />;
      case 1:
        return <PhotosStep key={p!.updatedUtc} product={p!} onSave={(f) => savePhotos.mutate(f)} saving={savePhotos.isPending} serverError={serverError} />;
      case 2:
        return <PricingStep key={p!.updatedUtc} product={p!} onSave={(f) => savePricing.mutate(f)} saving={savePricing.isPending} serverError={serverError} />;
      case 3:
        return <ShippingStep key={p!.updatedUtc} product={p!} onSave={(f) => saveShipping.mutate(f)} saving={saveShipping.isPending} serverError={serverError} />;
      case TRYON_STEP:
        return <TryOnStep product={p!} onContinue={() => setStep(LAST_STEP)} />;
      default:
        return (
          <Stack gap="md">
            <AttributesCard product={p!} />
            <EmiCard product={p!} />
            {gate.block && (
              <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} title="Size chart needed" role="alert">
                <Stack gap="xs" align="flex-start">
                  <Text size="sm">{gate.block}</Text>
                  <Button size="xs" variant="light" color="signal" onClick={goToTryOn}>
                    Go to Try-on &amp; sizes
                  </Button>
                </Stack>
              </Alert>
            )}
            {!gate.block && gate.warn && (
              <Alert color="amber" variant="light" icon={<IconAlertTriangle size={16} />}>
                <Stack gap="xs" align="flex-start">
                  <Text size="sm">{gate.warn}</Text>
                  <Button size="xs" variant="subtle" onClick={goToTryOn}>
                    Add a try-on image
                  </Button>
                </Stack>
              </Alert>
            )}
            {isDraft && (
              <Card>
                <Group justify="space-between" wrap="wrap" gap="sm">
                  <div>
                    <Text fw={650}>Ready to sell?</Text>
                    <Text size="sm" c="dimmed">
                      {gate.block ? 'Add the size chart first.' : reached >= 4 ? 'Publishing puts the product on StyleMint for customers to buy.' : 'Finish the earlier steps first.'}
                    </Text>
                  </div>
                  <Button leftSection={<IconRocket size={16} />} onClick={() => publish.mutate()} loading={publish.isPending} disabled={reached < 4 || !!gate.block || readiness.isLoading}>
                    Publish product
                  </Button>
                </Group>
              </Card>
            )}
          </Stack>
        );
    }
  };

  return (
    <>
      <PageHeader
        title={p ? p.name : 'Add a product'}
        back={{ to: '/products', label: 'Products' }}
        meta={
          p ? (
            <Group gap="xs">
              <Badge color={productStateColor[p.state]} variant="light">
                {productStateLabel[p.state]}
              </Badge>
              {readiness.data && <TryOnBadge readiness={readiness.data} />}
              {isDraft && (
                <Text size="sm" c="dimmed">
                  Step {Math.min(reached + 1, 5)} of {STEPS.length}
                </Text>
              )}
            </Group>
          ) : (
            <Text size="sm" c="dimmed">
              Six short steps. Your progress is saved as a draft after each one.
            </Text>
          )
        }
        actions={
          p && !readOnly ? (
            <Button variant="subtle" color="signal" leftSection={<IconArchive size={16} />} onClick={() => void onArchive()} loading={archive.isPending}>
              {isDraft ? 'Delete draft' : 'Archive'}
            </Button>
          ) : undefined
        }
      />

      {readOnly ? (
        <Alert color="gray" variant="light" title={`This product is ${productStateLabel[p!.state].toLowerCase()}`}>
          {p!.state === ProductState.Suspended ? 'StyleMint suspended this product. Contact support to find out why.' : 'Archived products cannot be edited.'}
        </Alert>
      ) : (
        <Card>
          {isPhone ? (
            <Stack gap={6} mb="md">
              <Group justify="space-between">
                <Text fw={650}>
                  {active + 1}. {STEPS[active]}
                </Text>
                <Text size="sm" c="dimmed">
                  {active + 1} / {STEPS.length}
                </Text>
              </Group>
              <Progress value={((active + 1) / STEPS.length) * 100} size="sm" />
              <Group gap={4}>
                {STEPS.map((s, i) => (
                  <Button key={s} size="compact-xs" variant={i === active ? 'filled' : 'default'} disabled={!canOpen(i)} onClick={() => setStep(i)} aria-label={`Step ${i + 1}: ${s}`}>
                    {i + 1}
                  </Button>
                ))}
              </Group>
            </Stack>
          ) : (
            <Stepper active={active} onStepClick={setStep} size="sm" mb="xl" allowNextStepsSelect={!isDraft} completedIcon={<IconCircleCheck size={18} />}>
              {STEPS.map((s, i) => (
                <Stepper.Step key={s} label={s} allowStepSelect={canOpen(i)} />
              ))}
            </Stepper>
          )}
          {stepBody()}
        </Card>
      )}
    </>
  );
}
