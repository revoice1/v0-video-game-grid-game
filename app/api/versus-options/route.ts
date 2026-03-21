import { NextResponse } from 'next/server'
import { getVersusCategoryFamilies } from '@/lib/igdb'

const PLATFORM_DISPLAY_LABELS: Record<string, string> = {
  'Nintendo Entertainment System': 'NES',
  'Super Nintendo Entertainment System': 'SNES',
}

export async function GET() {
  try {
    const families = await getVersusCategoryFamilies()

    return NextResponse.json({
      families: families.map((family) => ({
        key: family.key,
        source: family.source,
        categories: family.categories.map((category) => ({
          id: String(category.id),
          name:
            family.key === 'platform'
              ? (PLATFORM_DISPLAY_LABELS[category.name] ?? category.name)
              : category.name,
          type: category.type,
          defaultChecked: !(
            family.key === 'perspective' &&
            (String(category.id) === '5' || String(category.id) === '6' || String(category.id) === '7')
          ),
        })),
      })),
    })
  } catch (error) {
    console.error('[v0] versus-options error:', error)
    return NextResponse.json({ families: [] }, { status: 500 })
  }
}
