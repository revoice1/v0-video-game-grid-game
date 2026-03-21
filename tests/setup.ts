import '@testing-library/jest-dom/vitest'
import React from 'react'
import { vi } from 'vitest'

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // eslint-disable-next-line jsx-a11y/alt-text
    return React.createElement('img', props)
  },
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
})

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: vi.fn(),
})
