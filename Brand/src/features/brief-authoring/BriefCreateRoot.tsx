import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useDraftBrief } from '@/api/mutations/useDraftBrief'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CampaignGoal } from '@/lib/enums'
import type { ValueOf } from '@/lib/types'

const Schema = z.object({
  title:       z.string().min(1, 'Title is required').max(120),
  primaryGoal: z.number({ required_error: 'Select a goal' }) as z.ZodType<ValueOf<typeof CampaignGoal>>,
})

type Values = z.infer<typeof Schema>

const goalLabels: Record<ValueOf<typeof CampaignGoal>, string> = {
  1: 'Drive First Purchase',
  2: 'Reintroduce Dormant',
  3: 'Launch New Variant',
  4: 'Clear Slow Inventory',
  5: 'Build Seasonal Awareness',
  6: 'Educate On Use',
  7: 'Test New Audience',
}

export function BriefCreateRoot() {
  const draftBrief = useDraftBrief()

  const { register, control, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(Schema),
  })

  function onSubmit(values: Values) {
    draftBrief.mutate(values)
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="mb-6 text-xl font-semibold text-[var(--text-primary)]">New Brief</h1>

      <div className="max-w-lg rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              Title
            </label>
            <Input id="title" {...register('title')} error={errors.title?.message} />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Campaign Goal</p>
            <Controller
              name="primaryGoal"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-1 gap-2">
                  {(Object.entries(goalLabels) as [string, string][]).map(([value, label]) => (
                    <label key={value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 hover:bg-[var(--surface-2)]">
                      <input
                        type="radio"
                        name="primaryGoal"
                        value={value}
                        checked={field.value === Number(value)}
                        onChange={() => field.onChange(Number(value))}
                        className="accent-[var(--primary)]"
                      />
                      <span className="text-sm text-[var(--text-primary)]">{label}</span>
                    </label>
                  ))}
                </div>
              )}
            />
            {errors.primaryGoal && (
              <span role="alert" className="mt-1 block text-xs text-red-400">
                {errors.primaryGoal.message}
              </span>
            )}
          </div>

          <Button type="submit" loading={draftBrief.isPending} className="w-full">
            Create Brief
          </Button>
        </form>
      </div>
    </div>
  )
}
