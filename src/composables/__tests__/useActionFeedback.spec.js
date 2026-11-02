import { afterEach, describe, expect, it, vi } from 'vitest'
import { useActionFeedback } from '../useActionFeedback'

afterEach(() => {
  vi.useRealTimers()
})

describe('important action feedback', () => {
  it('starts immediately, blocks duplicate work and stays visible for two seconds', async () => {
    vi.useFakeTimers()
    const { feedback, runAction } = useActionFeedback()
    const request = vi.fn().mockResolvedValue({ id: 'saved' })
    const duplicate = vi.fn()
    const result = runAction('Posting your food…', request)
    expect(request).toHaveBeenCalledOnce()
    expect(feedback.active).toBe(true)
    expect(feedback.label).toBe('Posting your food…')
    await expect(runAction('Another save', duplicate)).rejects.toThrow('Please wait')
    expect(duplicate).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1999)
    expect(feedback.active).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    await expect(result).resolves.toEqual({ id: 'saved' })
    expect(feedback.active).toBe(false)
  })

  it('keeps feedback visible when the request takes longer than two seconds', async () => {
    vi.useFakeTimers()
    const { feedback, runAction } = useActionFeedback()
    let completeRequest
    const request = new Promise((resolve) => {
      completeRequest = resolve
    })
    const result = runAction('Reserving portions…', () => request)
    await vi.advanceTimersByTimeAsync(2500)
    expect(feedback.active).toBe(true)
    completeRequest('reserved')
    await expect(result).resolves.toBe('reserved')
    expect(feedback.active).toBe(false)
  })

  it('clears feedback and returns the original error so the form can show it', async () => {
    vi.useFakeTimers()
    const { feedback, runAction } = useActionFeedback()
    const error = new Error('No portions left.')
    const result = runAction('Reserving portions…', () => Promise.reject(error)).catch((err) => err)
    await vi.advanceTimersByTimeAsync(2000)
    expect(await result).toBe(error)
    expect(feedback.active).toBe(false)
    expect(feedback.label).toBe('')
  })
})
