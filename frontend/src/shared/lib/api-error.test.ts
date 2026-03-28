import { describe, it, expect } from 'vitest'
import { AxiosError } from 'axios'
import { getErrorMessage } from './api-error'

describe('getErrorMessage', () => {
  it('extracts detail from AxiosError response', () => {
    const error = new AxiosError('Network Error', '400', undefined, undefined, {
      data: { detail: 'Invalid request' },
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
    })
    expect(getErrorMessage(error)).toBe('Invalid request')
  })

  it('falls back to AxiosError message when no detail', () => {
    const error = new AxiosError('Network Error')
    expect(getErrorMessage(error)).toBe('Network Error')
  })

  it('extracts message from generic Error', () => {
    const error = new Error('Something broke')
    expect(getErrorMessage(error)).toBe('Something broke')
  })

  it('returns default for unknown error types', () => {
    expect(getErrorMessage('string error')).toBe('Something went wrong')
    expect(getErrorMessage(42)).toBe('Something went wrong')
    expect(getErrorMessage(null)).toBe('Something went wrong')
  })
})
