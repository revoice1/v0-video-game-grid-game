'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { IndexBadge } from '@/components/index-badge'
import { getFamilyDisplayLabel } from '@/lib/category-display'
import { sanitizeMinValidOptionsOverride } from '@/lib/min-valid-options'
import type { CategoryType } from '@/lib/types'
import {
  CURATED_VERSUS_CATEGORY_FAMILIES,
  type VersusCategoryFamilyOption,
} from '@/lib/versus-category-options'

type VersusFamilyKey = Extract<
  CategoryType,
  'platform' | 'genre' | 'decade' | 'company' | 'game_mode' | 'theme' | 'perspective'
>

export type VersusCategoryFilters = Partial<Record<VersusFamilyKey, string[]>>
export type VersusStealRule = 'off' | 'lower' | 'higher' | 'fewer_reviews' | 'more_reviews'
export type VersusTurnTimerOption = 'none' | 20 | 60 | 120 | 300
export type VersusObjectionRule = 'off' | 'one' | 'three'
export type MinimumValidOptionsOverride = number | null

interface VersusSetupModalProps {
  isOpen: boolean
  onClose: () => void
  mode?: 'versus' | 'practice'
  errorMessage?: string | null
  filters: VersusCategoryFilters
  stealRule: VersusStealRule
  timerOption: VersusTurnTimerOption
  disableDraws: boolean
  objectionRule: VersusObjectionRule
  minimumValidOptionsDefault: number
  minimumValidOptionsOverride: MinimumValidOptionsOverride
  onApply: (
    filters: VersusCategoryFilters,
    stealRule: VersusStealRule,
    timerOption: VersusTurnTimerOption,
    disableDraws: boolean,
    objectionRule: VersusObjectionRule,
    minimumValidOptionsOverride: MinimumValidOptionsOverride
  ) => void
}

const TIMER_OPTIONS: Array<{ value: VersusTurnTimerOption; label: string }> = [
  { value: 'none', label: 'No timer' },
  { value: 20, label: '20 sec' },
  { value: 60, label: '1 min' },
  { value: 120, label: '2 min' },
  { value: 300, label: '5 min' },
]

const STEAL_RULE_OPTIONS: Array<{ value: VersusStealRule; label: string }> = [
  { value: 'off', label: 'Off' },
  { value: 'lower', label: 'Lower score' },
  { value: 'higher', label: 'Higher score' },
  { value: 'fewer_reviews', label: 'Fewer reviews' },
  { value: 'more_reviews', label: 'More reviews' },
]

const OBJECTION_RULE_OPTIONS: Array<{ value: VersusObjectionRule; label: string }> = [
  { value: 'off', label: 'Off' },
  { value: 'one', label: '1 each' },
  { value: 'three', label: '3 each' },
]

export function VersusSetupModal({
  isOpen,
  onClose,
  mode = 'versus',
  errorMessage = null,
  filters,
  stealRule,
  timerOption,
  disableDraws,
  objectionRule,
  minimumValidOptionsDefault,
  minimumValidOptionsOverride,
  onApply,
}: VersusSetupModalProps) {
  const sanitizeOverride = (value: MinimumValidOptionsOverride) =>
    sanitizeMinValidOptionsOverride(value, minimumValidOptionsDefault)
  const initialMinimumOverride = sanitizeOverride(minimumValidOptionsOverride)
  const [draftFilters, setDraftFilters] = useState<VersusCategoryFilters>(filters)
  const [draftStealRule, setDraftStealRule] = useState<VersusStealRule>(stealRule)
  const [draftTimerOption, setDraftTimerOption] = useState<VersusTurnTimerOption>(timerOption)
  const [draftDisableDraws, setDraftDisableDraws] = useState(disableDraws)
  const [draftObjectionRule, setDraftObjectionRule] = useState<VersusObjectionRule>(objectionRule)
  const [draftMinimumValidOptionsOverride, setDraftMinimumValidOptionsOverride] =
    useState<MinimumValidOptionsOverride>(initialMinimumOverride)
  const [draftMinimumValidOptionsInput, setDraftMinimumValidOptionsInput] = useState(
    initialMinimumOverride === null ? '' : String(initialMinimumOverride)
  )
  const [expandedFamilies, setExpandedFamilies] = useState<
    Partial<Record<VersusFamilyKey, boolean>>
  >({})
  const lastSyncedConfigRef = useRef<string>('')
  const filtersKey = JSON.stringify(filters)

  useEffect(() => {
    if (!isOpen) {
      lastSyncedConfigRef.current = ''
      return
    }

    const sanitizedMinimumOverride = sanitizeOverride(minimumValidOptionsOverride)
    const nextConfigKey = `${filtersKey}::${stealRule}::${timerOption}::${disableDraws}::${objectionRule}::${sanitizedMinimumOverride}::${minimumValidOptionsDefault}`
    if (lastSyncedConfigRef.current === nextConfigKey) {
      return
    }

    lastSyncedConfigRef.current = nextConfigKey
    setDraftFilters(filters)
    setDraftStealRule(stealRule)
    setDraftTimerOption(timerOption)
    setDraftDisableDraws(disableDraws)
    setDraftObjectionRule(objectionRule)
    setDraftMinimumValidOptionsOverride(sanitizedMinimumOverride)
    setDraftMinimumValidOptionsInput(
      sanitizedMinimumOverride === null ? '' : String(sanitizedMinimumOverride)
    )
  }, [
    disableDraws,
    filters,
    filtersKey,
    isOpen,
    minimumValidOptionsDefault,
    minimumValidOptionsOverride,
    objectionRule,
    stealRule,
    timerOption,
  ])

  useEffect(() => {
    if (!isOpen) {
      setExpandedFamilies({})
    }
  }, [isOpen])

  const families = useMemo<VersusCategoryFamilyOption[]>(() => CURATED_VERSUS_CATEGORY_FAMILIES, [])

  const getDefaultSelection = (family: VersusCategoryFamilyOption) => {
    return family.categories
      .filter((category) => category.defaultChecked !== false)
      .map((category) => category.id)
  }

  const hasSameSelection = (left: string[], right: string[]) => {
    if (left.length !== right.length) {
      return false
    }

    const leftSet = new Set(left)
    return right.every((value) => leftSet.has(value))
  }

  const getEffectiveSelection = (family: VersusCategoryFamilyOption) => {
    return draftFilters[family.key] ?? getDefaultSelection(family)
  }

  const enabledFamilyCount = useMemo(() => {
    return families.filter((family) => getEffectiveSelection(family).length > 0).length
  }, [draftFilters, families])

  const totalSelectedCategories = useMemo(() => {
    return families.reduce((sum, family) => sum + getEffectiveSelection(family).length, 0)
  }, [draftFilters, families])

  const toggleCategory = (familyKey: VersusFamilyKey, categoryId: string, checked: boolean) => {
    setDraftFilters((current) => {
      const family = families.find((entry) => entry.key === familyKey)
      const existing = current[familyKey] ?? (family ? getDefaultSelection(family) : [])
      const nextValues = checked
        ? Array.from(new Set([...existing, categoryId]))
        : existing.filter((value) => value !== categoryId)

      if (!family) {
        return current
      }

      if (hasSameSelection(nextValues, getDefaultSelection(family))) {
        const { [familyKey]: removed, ...rest } = current
        void removed
        return rest
      }

      return {
        ...current,
        [familyKey]: nextValues,
      }
    })
  }

  const checkFamily = (familyKey: VersusFamilyKey) => {
    setDraftFilters((current) => {
      const family = families.find((entry) => entry.key === familyKey)
      if (!family) {
        return current
      }

      const nextValues = family.categories.map((category) => category.id)

      if (hasSameSelection(nextValues, getDefaultSelection(family))) {
        const { [familyKey]: removed, ...rest } = current
        void removed
        return rest
      }

      return {
        ...current,
        [familyKey]: nextValues,
      }
    })
  }

  const uncheckFamily = (familyKey: VersusFamilyKey) => {
    setDraftFilters((current) => ({
      ...current,
      [familyKey]: [],
    }))
  }

  const toggleFamilyExpanded = (familyKey: VersusFamilyKey) => {
    setExpandedFamilies((current) => ({
      ...current,
      [familyKey]: !current[familyKey],
    }))
  }

  const resetToDefault = () => {
    setDraftFilters({})
    setDraftStealRule('fewer_reviews')
    setDraftTimerOption(300)
    setDraftDisableDraws(true)
    setDraftObjectionRule('one')
    setDraftMinimumValidOptionsOverride(null)
    setDraftMinimumValidOptionsInput('')
  }

  const maxMinimumValidOptionsOverride = minimumValidOptionsDefault - 1
  const hasMinimumOverrideHeadroom = maxMinimumValidOptionsOverride >= 1
  const minimumOverrideInputIsValid =
    draftMinimumValidOptionsInput.trim() === '' ||
    draftMinimumValidOptionsOverride !== null ||
    !hasMinimumOverrideHeadroom
  const canApply = enabledFamilyCount >= 4 && totalSelectedCategories >= 6
  const canApplySettings = canApply && minimumOverrideInputIsValid
  const isVersusMode = mode === 'versus'
  const applyDisabledReason =
    enabledFamilyCount < 4
      ? `Enable at least 4 families to generate a board.`
      : totalSelectedCategories < 6
        ? `Enable at least 6 total categories to generate a board.`
        : null
  const minimumOverrideErrorMessage =
    hasMinimumOverrideHeadroom && !minimumOverrideInputIsValid
      ? `Use a whole number from 1 to ${maxMinimumValidOptionsOverride}.`
      : null

  const buildAppliedFilters = (): VersusCategoryFilters => {
    const nextFilters: VersusCategoryFilters = {}

    for (const family of families) {
      const selected = getEffectiveSelection(family)

      if (!hasSameSelection(selected, getDefaultSelection(family))) {
        nextFilters[family.key] = selected
      }
    }

    return nextFilters
  }

  const appliedFilters = buildAppliedFilters()
  const hasCustomCategories = Object.keys(appliedFilters).length > 0
  const hasCustomStealRule = draftStealRule !== 'fewer_reviews'
  const hasCustomObjectionRule = draftObjectionRule !== 'one'
  const hasCustomDrawRule = draftDisableDraws !== true
  const hasCustomTimerRule = draftTimerOption !== 300
  const hasCustomMinimumRule = draftMinimumValidOptionsOverride !== null
  const hasCustomRules =
    hasCustomStealRule ||
    hasCustomObjectionRule ||
    hasCustomDrawRule ||
    hasCustomTimerRule ||
    hasCustomMinimumRule

  const CustomIndicator = ({
    label = 'Custom',
    showDot = true,
  }: {
    label?: string
    showDot?: boolean
  }) => (
    <span
      className={`inline-flex items-center text-[10px] font-medium uppercase tracking-[0.12em] text-amber-200/80 ${
        label && showDot ? 'gap-1' : ''
      }`}
    >
      {showDot ? <span className="h-1.5 w-1.5 rounded-full bg-amber-300/80" /> : null}
      {label ? label : null}
    </span>
  )

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle>{isVersusMode ? 'Versus Setup' : 'Practice Setup'}</DialogTitle>
          <DialogDescription>
            Build your own category pool. You need at least 6 enabled categories across at least 4
            families to try generation. Some narrow combinations may take more attempts to validate,
            or may not be able to generate a board at all.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        <section className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/45 px-3 py-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">Minimum Answers Per Cell</h4>
              {hasCustomMinimumRule && <CustomIndicator label="" />}
            </div>
            <p className="text-xs text-muted-foreground">
              Raise for stricter boards, lower for wilder/rarer category combinations.
            </p>
          </div>
          <div className="w-[11rem] shrink-0">
            <Input
              inputMode="numeric"
              type="number"
              min={1}
              max={Math.max(maxMinimumValidOptionsOverride, 1)}
              step={1}
              placeholder={`Default (${minimumValidOptionsDefault})`}
              value={draftMinimumValidOptionsInput}
              disabled={!hasMinimumOverrideHeadroom}
              onChange={(event) => {
                const rawValue = event.target.value
                setDraftMinimumValidOptionsInput(rawValue)

                if (rawValue.trim() === '') {
                  setDraftMinimumValidOptionsOverride(null)
                  return
                }

                const numericValue = Number(rawValue)
                if (
                  Number.isInteger(numericValue) &&
                  numericValue >= 1 &&
                  numericValue <= maxMinimumValidOptionsOverride
                ) {
                  setDraftMinimumValidOptionsOverride(numericValue)
                } else {
                  setDraftMinimumValidOptionsOverride(null)
                }
              }}
            />
          </div>
        </section>
        {minimumOverrideErrorMessage ? (
          <p className="mt-1 text-xs text-destructive">{minimumOverrideErrorMessage}</p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            Leave blank for default ({minimumValidOptionsDefault}). You can only override lower than
            the default.
          </p>
        )}

        <Accordion type="multiple" defaultValue={[]} className="space-y-4">
          {isVersusMode && (
            <AccordionItem
              value="settings"
              className="rounded-2xl border border-border bg-secondary/20 px-4"
            >
              <AccordionTrigger className="py-4 text-sm font-semibold text-foreground hover:no-underline">
                <span className="flex items-center gap-2">
                  <span>Rules</span>
                  {hasCustomRules && <CustomIndicator showDot={false} />}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="grid gap-3">
                  <section className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/45 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground">Steals</h4>
                        {hasCustomStealRule && <CustomIndicator label="" />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Use rating score or review-count obscurity to decide whether a steal lands.
                      </p>
                    </div>
                    <Select
                      value={draftStealRule}
                      onValueChange={(value) => setDraftStealRule(value as VersusStealRule)}
                    >
                      <SelectTrigger className="w-[11rem] shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STEAL_RULE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </section>

                  <section className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/45 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground">Objections</h4>
                        {hasCustomObjectionRule && <CustomIndicator label="" />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Judge Gemini reviews available to each player.
                      </p>
                    </div>
                    <Select
                      value={draftObjectionRule}
                      onValueChange={(value) => setDraftObjectionRule(value as VersusObjectionRule)}
                    >
                      <SelectTrigger className="w-[11rem] shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OBJECTION_RULE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </section>

                  <section className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/45 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground">Draws</h4>
                        {hasCustomDrawRule && <CustomIndicator label="" />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Allow tied matches, or break them by claimed cell count.
                      </p>
                    </div>
                    <Select
                      value={draftDisableDraws ? 'disabled' : 'enabled'}
                      onValueChange={(value) => setDraftDisableDraws(value === 'disabled')}
                    >
                      <SelectTrigger className="w-[11rem] shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enabled">Enabled</SelectItem>
                        <SelectItem value="disabled">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </section>

                  <section className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/45 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground">Turn Timer</h4>
                        {hasCustomTimerRule && <CustomIndicator label="" />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Optional shot clock for each turn.
                      </p>
                    </div>
                    <Select
                      value={String(draftTimerOption)}
                      onValueChange={(value) =>
                        setDraftTimerOption(
                          value === 'none'
                            ? 'none'
                            : (Number(value) as Exclude<VersusTurnTimerOption, 'none'>)
                        )
                      }
                    >
                      <SelectTrigger className="w-[11rem] shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMER_OPTIONS.map((option) => (
                          <SelectItem key={option.label} value={String(option.value)}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </section>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem
            value="categories"
            className="rounded-2xl border border-border bg-secondary/20 px-4"
          >
            <AccordionTrigger className="py-4 text-sm font-semibold text-foreground hover:no-underline">
              <span className="flex items-center gap-2">
                <span>Categories</span>
                {hasCustomCategories && <CustomIndicator showDot={false} />}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-5">
                {families.map((family) => {
                  const selected = new Set(getEffectiveSelection(family))
                  const defaultSelection = getDefaultSelection(family)
                  const isCustom = !hasSameSelection(Array.from(selected), defaultSelection)
                  const hasAllSelected = selected.size === family.categories.length
                  const isExpanded = expandedFamilies[family.key] === true

                  return (
                    <section
                      key={family.key}
                      className="rounded-2xl border border-border bg-secondary/20 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => toggleFamilyExpanded(family.key)}
                          className="flex flex-1 items-center justify-between gap-3 text-left"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-foreground">
                                {getFamilyDisplayLabel(family.key)}
                              </h3>
                              {isCustom && <CustomIndicator label="" />}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {hasAllSelected
                                ? `All ${family.categories.length} enabled`
                                : `${selected.size} of ${family.categories.length} enabled`}
                            </p>
                          </div>
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {isExpanded ? 'Hide' : 'Show'}
                          </span>
                        </button>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => uncheckFamily(family.key)}
                          >
                            Uncheck All
                          </Button>
                          {!hasAllSelected && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => checkFamily(family.key)}
                            >
                              Check All
                            </Button>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {family.categories.map((category) => (
                            <label
                              key={`${family.key}-${category.id}`}
                              htmlFor={`${family.key}-${category.id}`}
                              className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/90 bg-background/65 px-3 py-2 text-sm transition-colors hover:bg-background/85"
                            >
                              <Checkbox
                                id={`${family.key}-${category.id}`}
                                checked={selected.has(category.id)}
                                onCheckedChange={(checked) =>
                                  toggleCategory(family.key, category.id, checked === true)
                                }
                              />
                              <span className="text-foreground">{category.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Current pool: {totalSelectedCategories} enabled categories across {enabledFamilyCount}{' '}
              families. Narrower pools can take longer to generate.
            </p>
            {applyDisabledReason && (
              <p className="text-xs font-medium text-amber-300">{applyDisabledReason}</p>
            )}
            <IndexBadge slot="setup" className="mt-2" />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={resetToDefault}>
              Reset to Default
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                onApply(
                  buildAppliedFilters(),
                  draftStealRule,
                  draftTimerOption,
                  draftDisableDraws,
                  draftObjectionRule,
                  sanitizeOverride(draftMinimumValidOptionsOverride)
                )
              }
              disabled={!canApplySettings}
              title={minimumOverrideErrorMessage ?? applyDisabledReason ?? undefined}
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
