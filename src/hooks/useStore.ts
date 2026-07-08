import { useSyncExternalStore } from 'react'
import { getSnapshot, subscribe, type StoreState } from '../lib/store'

export function useStore(): StoreState {
  return useSyncExternalStore(subscribe, getSnapshot)
}
