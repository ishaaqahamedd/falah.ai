import { describe, it, expect, beforeEach } from 'vitest'
import { useUserStore } from './store'

const TEST_USER = {
  id: '1',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'user',
  onboarding_status: 'completed' as const,
  onboarding_step: null,
}

describe('useUserStore', () => {
  beforeEach(() => {
    useUserStore.setState({ user: null, isAuthenticated: false })
  })

  it('starts unauthenticated', () => {
    const state = useUserStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('setAuth stores user and sets isAuthenticated', () => {
    useUserStore.getState().setAuth(TEST_USER)
    const state = useUserStore.getState()
    expect(state.user).toEqual(TEST_USER)
    expect(state.isAuthenticated).toBe(true)
  })

  it('setAuth(null) clears auth', () => {
    useUserStore.getState().setAuth(TEST_USER)
    useUserStore.getState().setAuth(null)
    const state = useUserStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('logout clears user and auth flag', () => {
    useUserStore.getState().setAuth(TEST_USER)
    useUserStore.getState().logout()
    const state = useUserStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })
})
