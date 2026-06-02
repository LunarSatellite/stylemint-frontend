import { useBoostOffer } from '@/api/queries/useBoostOffer'
import { BoostCountdown } from './BoostCountdown'
import { BoostOfferState } from '@/lib/enums'
import { useAcceptBoostOffer } from '@/api/mutations/useAcceptBoostOffer'
import { Button } from '@/components/ui/button'

interface BoostOfferBannerProps {
  offerId: string
  reelId: string
}

export function BoostOfferBanner({ offerId, reelId }: BoostOfferBannerProps) {
  const { data } = useBoostOffer(offerId)
  const { mutate: accept, isPending } = useAcceptBoostOffer(reelId)

  if (!data || data.state !== BoostOfferState.Pending) return null

  return (
    <div className="rounded-xl bg-bg-card p-4 border border-primary/20">
      <p className="font-medium text-text-primary">Boost your reel — FREE</p>
      <BoostCountdown serverNowUtc={data.serverNowUtc} expiresUtc={data.expiresAtUtc} />
      <Button
        className="mt-3"
        onClick={() => accept(offerId)}
        loading={isPending}
      >
        Accept Boost
      </Button>
    </div>
  )
}
