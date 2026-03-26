import fs from 'node:fs/promises'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'

const projectRoot = process.cwd()
const outputPath = path.join(projectRoot, 'lib', 'curated-standard-pair-bans.ts')
const reportDir = path.join(projectRoot, 'scripts', 'generated')
const reportPath = path.join(reportDir, 'curated-standard-pair-ban-report.json')
const PREBAN_COUNT_THRESHOLD = 3
const LOW_RESULT_REASON = `${PREBAN_COUNT_THRESHOLD} or fewer catalog matches in curated pair table`

function buildFileContents(pairBanReasons: Record<string, string>) {
  return `// Generated via \`npm run regen:pair-bans\`\n// Canonical unordered pair keys for curated standard-family bans.\nexport const CURATED_STANDARD_PAIR_BAN_REASONS: Record<string, string> = ${JSON.stringify(pairBanReasons, null, 2)}\n\nexport function getCuratedStandardPairBanReason(pairKey: string): string | null {\n  return CURATED_STANDARD_PAIR_BAN_REASONS[pairKey] ?? null\n}\n`
}

function getFamilyPairs<
  TFamily extends {
    key: string
    categories: unknown[]
  },
>(curatedStandardCategoryFamilies: TFamily[]) {
  const pairs: Array<[TFamily, TFamily]> = []

  for (let leftIndex = 0; leftIndex < curatedStandardCategoryFamilies.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < curatedStandardCategoryFamilies.length;
      rightIndex += 1
    ) {
      pairs.push([
        curatedStandardCategoryFamilies[leftIndex],
        curatedStandardCategoryFamilies[rightIndex],
      ])
    }
  }

  return pairs
}

async function main() {
  loadEnvConfig(projectRoot)

  const [
    { getValidGameCountForCell },
    { getCanonicalCategoryPairKey, getIntrinsicPairRejectionReason },
    { CURATED_STANDARD_CATEGORY_FAMILIES },
  ] = await Promise.all([
    import('../lib/igdb'),
    import('../lib/igdb-validation'),
    import('../lib/versus-category-options'),
  ])

  const pairBanReasons: Record<string, string> = {}
  const reportRows: Array<Record<string, string>> = []
  const startedAt = new Date().toISOString()
  let checkedPairs = 0
  let intrinsicBans = 0
  let observedLowCountBans = 0

  for (const [rowFamily, colFamily] of getFamilyPairs(CURATED_STANDARD_CATEGORY_FAMILIES)) {
    for (const rowCategory of rowFamily.categories) {
      for (const colCategory of colFamily.categories) {
        checkedPairs += 1

        const pairKey = getCanonicalCategoryPairKey(rowCategory, colCategory)
        const intrinsicReason = getIntrinsicPairRejectionReason(rowCategory, colCategory)

        if (intrinsicReason) {
          pairBanReasons[pairKey] = intrinsicReason
          intrinsicBans += 1
          reportRows.push({
            pairKey,
            rowFamily: rowFamily.key,
            rowCategory: rowCategory.name,
            colFamily: colFamily.key,
            colCategory: colCategory.name,
            reason: intrinsicReason,
            source: 'intrinsic',
          })
          continue
        }

        const count = await getValidGameCountForCell(rowCategory, colCategory, {
          ignoreCuratedPairBans: true,
        })

        if (count <= PREBAN_COUNT_THRESHOLD) {
          pairBanReasons[pairKey] = LOW_RESULT_REASON
          observedLowCountBans += 1
          reportRows.push({
            pairKey,
            rowFamily: rowFamily.key,
            rowCategory: rowCategory.name,
            colFamily: colFamily.key,
            colCategory: colCategory.name,
            count: String(count),
            reason: LOW_RESULT_REASON,
            source: 'observed-low-count',
          })
        }

        if (checkedPairs % 100 === 0) {
          console.log(
            `[GG] regen:pair-bans checked ${checkedPairs} pairs (${intrinsicBans} intrinsic, ${observedLowCountBans} low-count)`
          )
        }
      }
    }
  }

  const sortedPairBanReasons = Object.fromEntries(
    Object.entries(pairBanReasons).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
  )

  await fs.mkdir(reportDir, { recursive: true })
  await fs.writeFile(outputPath, buildFileContents(sortedPairBanReasons), 'utf8')
  await fs.writeFile(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        startedAt,
        checkedPairs,
        totalBans: Object.keys(sortedPairBanReasons).length,
        intrinsicBans,
        prebanCountThreshold: PREBAN_COUNT_THRESHOLD,
        observedLowCountBans,
        rows: reportRows,
      },
      null,
      2
    ),
    'utf8'
  )

  console.log(
    `[GG] regen:pair-bans wrote ${Object.keys(sortedPairBanReasons).length} bans to ${path.relative(projectRoot, outputPath)}`
  )
  console.log(`[GG] regen:pair-bans wrote report to ${path.relative(projectRoot, reportPath)}`)
}

main().catch((error: unknown) => {
  console.error('[GG] regen:pair-bans failed:', error)
  process.exitCode = 1
})
