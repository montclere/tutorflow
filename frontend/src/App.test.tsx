import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { App } from './App'

test('renders the TutorFlow start page', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'TutorFlow' }).textContent).toBe('TutorFlow')
})
