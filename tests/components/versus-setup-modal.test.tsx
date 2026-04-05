import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  VersusSetupModal,
  type VersusCategoryFilters,
  type VersusStealRule,
} from '@/components/game/versus-setup-modal'
import { CURATED_VERSUS_CATEGORY_FAMILIES } from '@/lib/versus-category-options'

const companyFamily = CURATED_VERSUS_CATEGORY_FAMILIES.find((family) => family.key === 'company')

if (!companyFamily) {
  throw new Error('Missing company family for versus setup modal tests.')
}

function renderModal(options?: {
  filters?: VersusCategoryFilters
  stealRule?: VersusStealRule
  objectionRule?: 'off' | 'one' | 'three'
  timerOption?: 'none' | 20 | 60 | 120 | 300
  disableDraws?: boolean
}) {
  return render(
    <VersusSetupModal
      isOpen
      onClose={() => {}}
      mode="versus"
      filters={options?.filters ?? {}}
      stealRule={options?.stealRule ?? 'fewer_reviews'}
      timerOption={options?.timerOption ?? 300}
      disableDraws={options?.disableDraws ?? true}
      objectionRule={options?.objectionRule ?? 'one'}
      onApply={() => {}}
    />
  )
}

describe('VersusSetupModal', () => {
  it('uses the standard versus defaults for rules', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByRole('button', { name: /Rules/i }))

    const selects = screen.getAllByRole('combobox')
    expect(selects[0]).toHaveTextContent('Fewer reviews')
    expect(selects[1]).toHaveTextContent('1 each')
    expect(selects[2]).toHaveTextContent('Disabled')
    expect(selects[3]).toHaveTextContent('5 min')
    expect(screen.queryAllByText('Custom')).toHaveLength(0)
  })

  it('shows Check All for families that default some fun categories off', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByRole('button', { name: /Categories/i }))
    await user.click(screen.getByRole('button', { name: /Companies/i }))

    const companiesHeading = screen.getByText('Companies')
    const companiesSection = companiesHeading.closest('section')

    expect(companiesSection).not.toBeNull()
    expect(within(companiesSection!).getByText('10 of 16 enabled')).toBeInTheDocument()
    expect(within(companiesSection!).getByRole('button', { name: 'Check All' })).toBeInTheDocument()
  })

  it('marks Rules as custom when any versus rule differs from the defaults', async () => {
    const user = userEvent.setup()
    renderModal({
      stealRule: 'off',
      objectionRule: 'off',
      timerOption: 60,
      disableDraws: false,
    })

    await user.click(screen.getByRole('button', { name: /Rules/i }))

    expect(screen.getAllByText('Custom').length).toBeGreaterThan(0)
  })

  it('marks Categories as custom when a family differs from its default selection even if all are enabled', async () => {
    const user = userEvent.setup()
    renderModal({
      filters: {
        company: companyFamily.categories.map((category) => category.id),
      },
    })

    await user.click(screen.getByRole('button', { name: /Categories/i }))
    await user.click(screen.getByRole('button', { name: /Companies/i }))

    const companiesHeading = screen.getByText('Companies')
    const companiesSection = companiesHeading.closest('section')

    expect(screen.getAllByText('Custom').length).toBeGreaterThan(0)
    expect(companiesSection).not.toBeNull()
    expect(within(companiesSection!).getByText('All 16 enabled')).toBeInTheDocument()
    expect(
      within(companiesSection!).queryByRole('button', { name: 'Check All' })
    ).not.toBeInTheDocument()
  })
})
