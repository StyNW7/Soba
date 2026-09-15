import { useEffect, useRef, useState, useCallback } from 'react'
import { api, list } from '../../api/client'
export function useRemote<T>(path: string | null, collection = false) {
  const [state, setState] = useState<{
    path: string | null
    value?: T
    error: string
    revision: number
  }>({ path: null, error: '', revision: -1 })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    if (path) {
      const request = collection
        ? list(path, controller.signal)
        : api(path, { signal: controller.signal })
      request
        .then((value) => {
          if (!controller.signal.aborted)
            setState({ path, value: value as T, error: '', revision })
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setState({ path, error: e.message, revision })
        })
    }
    return () => controller.abort()
  }, [path, collection, revision])
  return {
    value:
      state.path === path && state.revision === revision
        ? state.value
        : undefined,
    error:
      state.path === path && state.revision === revision ? state.error : '',
    loading: !!path && (state.path !== path || state.revision !== revision),
    reload: useCallback(() => setRevision((n) => n + 1), []),
  }
}
export function useAction() {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const run = useCallback(
    async (work: () => Promise<unknown>, success = 'Saved.') => {
      if (lock.current) return false
      lock.current = true
      setBusy(true)
      setError('')
      setMessage('')
      try {
        await work()
        setMessage(success)
        return true
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Request failed. Please try again.',
        )
        return false
      } finally {
        lock.current = false
        setBusy(false)
      }
    },
    [],
  )
  return { busy, error, message, run }
}
export const inputClass =
  'w-full rounded-xl border border-line bg-background p-3 text-ink'
export const date = (value: string) => new Date(value).toLocaleString()
export const words = (value: string) => value.replaceAll('_', ' ')
export const moods = [
  'very_low',
  'low',
  'neutral',
  'good',
  'very_good',
  'unknown',
] as const
