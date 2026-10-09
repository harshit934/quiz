export function codingHints(challenge) {
  const first = challenge.testCases?.[0]
  const edge = challenge.testCases?.find(test => Array.isArray(test.input) && test.input.length === 0)
  return [
    `Break the task into a base result and the extra rule for this attempt. ${challenge.instructions}`,
    first?.assertion ? `Inspect the elements matching ${first.assertion.selector}. Check the requested count, text or style before changing the rest of the page.` : `Work through the first input by hand: ${JSON.stringify(first?.input ?? first?.stdin)}. Compare your steps with the expected output before coding them.`,
    edge ? 'Check the empty input separately. Apply this attempt’s extra rule even when the base result is zero or an empty list.' : 'Test the smallest input and any boundary values. Check output types, ordering and formatting as well as the computed value.',
  ]
}
