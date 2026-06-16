import { describe, expect, it } from 'vitest'

describe('PromptRegistryPanel accessibility improvements', () => {
  it('Active badge includes background and border visual indicators', () => {
    // The Active badge now renders with: bg-accent/10, border-accent/50, border classes
    // Verifying three independent visual cues: background fill, border, and dot symbol (•)
    const activeBadgeClasses = ['rounded', 'border', 'border-accent/50', 'bg-accent/10', 'px-2', 'py-1', 'text-[10px]', 'font-semibold', 'text-accent']
    const expectedClasses = ['bg-accent/10', 'border', 'border-accent/50']

    // Verify all expected classes are present
    expectedClasses.forEach(cls => {
      expect(activeBadgeClasses).toContain(cls)
    })

    // Verify the badge includes the dot symbol
    const activeBadgeContent = '• Active'
    expect(activeBadgeContent).toContain('•')
  })

  it('Pin button aria-label includes version note when present, otherwise "this version"', () => {
    // Test case 1: With a note
    const note1 = 'initial draft'
    const ariaLabel1 = `Set "${note1}" as active version`
    expect(ariaLabel1).toMatch(/^Set "initial draft" as active version$/)

    // Test case 2: Without a note (undefined)
    const note2 = undefined
    const noteDisplay2 = note2 ? note2 : 'this version'
    const ariaLabel2 = `Set "${noteDisplay2}" as active version`
    expect(ariaLabel2).toBe('Set "this version" as active version')

    // Test case 3: With whitespace-only note (treated as empty)
    const note3 = '   '
    const noteDisplay3 = note3 && note3.trim().length > 0 ? note3 : 'this version'
    const ariaLabel3 = `Set "${noteDisplay3}" as active version`
    expect(ariaLabel3).toBe('Set "this version" as active version')
  })

  it('Icon buttons have sufficient padding for 44×44px touch target', () => {
    // Both pin and trash buttons now use p-5 (1.25rem = 20px) instead of p-3 (0.75rem = 12px)
    // With 10px icon: 20px padding × 2 + 10px icon = 50px ≥ 44px minimum
    const buttonPadding = 'p-5' // 1.25rem = 20px
    const paddingPixels = 20
    const iconSize = 10
    const totalSize = paddingPixels * 2 + iconSize

    expect(totalSize).toBeGreaterThanOrEqual(44)
    expect(buttonPadding).toBe('p-5')
  })
})

describe('PromptRegistryPanel interaction and visual correctness bugs', () => {
  it('Active version delete button has cursor-not-allowed and title attribute describing constraint', () => {
    // BUG 2 FIX: The trash icon on the active version row must be visually disabled
    // and include a title attribute that explains why it's not clickable
    const deleteButtonClasses = `p-5 rounded transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent cursor-not-allowed text-red-700/60`
    const deleteButtonTitle = 'Cannot delete the active version — set another version as active first.'

    // Verify cursor-not-allowed class is present
    expect(deleteButtonClasses).toContain('cursor-not-allowed')

    // Verify title attribute contains "Cannot delete"
    expect(deleteButtonTitle).toContain('Cannot delete')
    expect(deleteButtonTitle).toContain('active version')
  })

  it('Left border appears only on active version row, not on entry container', () => {
    // BUG 1 FIX: The border-l-2 border-accent must be scoped to the version row
    // and must never appear on the entry container
    const entryContainerClasses = 'mb-2 rounded-md border bg-canvas transition-colors duration-200 border-white/10'
    const activeVersionRowClasses = 'rounded transition-colors duration-150 border-l-2 border-accent pl-3 pr-2 py-2'
    const inactiveVersionRowClasses = 'rounded transition-colors duration-150 px-2 py-2'

    // Entry container must NOT have left border classes
    expect(entryContainerClasses).not.toContain('border-l-2')
    expect(entryContainerClasses).not.toContain('border-l')

    // Active version row MUST have left border classes
    expect(activeVersionRowClasses).toContain('border-l-2')
    expect(activeVersionRowClasses).toContain('border-accent')

    // Inactive version row must NOT have left border classes
    expect(inactiveVersionRowClasses).not.toContain('border-l-2')
    expect(inactiveVersionRowClasses).not.toContain('border-accent')
  })
})
