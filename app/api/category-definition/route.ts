import { NextRequest, NextResponse } from 'next/server'
import { getCategoryDefinition } from '@/lib/category-definitions'
import { getCategoryTypeLabel } from '@/lib/category-definition-content'
import type { Category, CategoryType } from '@/lib/types'

const VALID_TYPES = new Set<CategoryType>([
  'platform',
  'genre',
  'developer',
  'publisher',
  'decade',
  'tag',
  'company',
  'game_mode',
  'theme',
  'perspective',
])

function parseCategory(request: NextRequest): Category | null {
  const params = request.nextUrl.searchParams
  const type = params.get('type')
  const id = params.get('id')
  const name = params.get('name')
  const slug = params.get('slug')

  if (!type || !VALID_TYPES.has(type as CategoryType) || !id || !name) {
    return null
  }

  return {
    type: type as CategoryType,
    id,
    name,
    slug: slug ?? undefined,
  }
}

export async function GET(request: NextRequest) {
  const category = parseCategory(request)

  if (!category) {
    return NextResponse.json({ error: 'Invalid category parameters' }, { status: 400 })
  }

  const definition = await getCategoryDefinition(category)

  return NextResponse.json({
    title: category.name,
    typeLabel: getCategoryTypeLabel(category.type),
    ...definition,
  })
}
