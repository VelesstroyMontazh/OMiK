import { create } from 'zustand'

export interface MainDbColumn {
  name: string
  index: number
  is_key: boolean
}

export interface MainDbStatus {
  loaded: boolean
  file_path: string | null
  source_excel?: string | null
  sheet_name: string | null
  columns: string[]
  key_columns: string[]
  row_count: number
  col_count: number
  loaded_at: string | null
  detected_excel?: string | null
  upload_dir?: string | null
  data_dir?: string | null
  message?: string | null
  error?: string | null
}

export interface MainDbFilters {
  [columnName: string]: string
}

interface MainDbState {
  // Status
  status: MainDbStatus | null
  columns: MainDbColumn[]
  isLoadingDb: boolean
  isLoaded: boolean

  // Data
  data: Array<Array<{ row: number; col: number; value: unknown; type: string; column: string }>>
  totalRows: number
  totalUnfilteredRows: number
  offset: number
  limit: number
  hasMore: boolean
  displayedColumns: string[]
  keyColumnsOnly: boolean

  // Filters & Search
  searchQuery: string
  filters: MainDbFilters
  sortColumn: string | null
  sortAscending: boolean

  // Loading states
  isLoadingData: boolean
  isSearching: boolean

  // Stats
  stats: Record<string, unknown> | null

  // Actions
  setStatus: (status: MainDbStatus | null) => void
  setColumns: (columns: MainDbColumn[]) => void
  setIsLoadingDb: (loading: boolean) => void
  setIsLoaded: (loaded: boolean) => void
  setData: (data: MainDbState['data'], totalRows: number, totalUnfilteredRows: number, offset: number, hasMore: boolean, displayedColumns: string[]) => void
  setSearchQuery: (query: string) => void
  setFilters: (filters: MainDbFilters) => void
  addFilter: (column: string, value: string) => void
  removeFilter: (column: string) => void
  clearFilters: () => void
  setSortColumn: (column: string | null) => void
  setSortAscending: (ascending: boolean) => void
  setKeyColumnsOnly: (only: boolean) => void
  setOffset: (offset: number) => void
  setLimit: (limit: number) => void
  setIsLoadingData: (loading: boolean) => void
  setIsSearching: (searching: boolean) => void
  setStats: (stats: Record<string, unknown> | null) => void
  reset: () => void
}

const initialState = {
  status: null,
  columns: [],
  isLoadingDb: false,
  isLoaded: false,
  data: [],
  totalRows: 0,
  totalUnfilteredRows: 0,
  offset: 0,
  limit: 200,
  hasMore: false,
  displayedColumns: [],
  keyColumnsOnly: false,
  searchQuery: '',
  filters: {},
  sortColumn: null,
  sortAscending: true,
  isLoadingData: false,
  isSearching: false,
  stats: null,
}

export const useMainDbStore = create<MainDbState>((set) => ({
  ...initialState,

  setStatus: (status) => set({ status, isLoaded: status?.loaded ?? false }),
  setColumns: (columns) => set({ columns }),
  setIsLoadingDb: (loading) => set({ isLoadingDb: loading }),
  setIsLoaded: (loaded) => set({ isLoaded: loaded }),
  setData: (data, totalRows, totalUnfilteredRows, offset, hasMore, displayedColumns) =>
    set({ data, totalRows, totalUnfilteredRows, offset, hasMore, displayedColumns }),
  setSearchQuery: (query) => set({ searchQuery: query, offset: 0 }),
  setFilters: (filters) => set({ filters, offset: 0 }),
  addFilter: (column, value) =>
    set((state) => ({ filters: { ...state.filters, [column]: value }, offset: 0 })),
  removeFilter: (column) =>
    set((state) => {
      const { [column]: _, ...rest } = state.filters
      return { filters: rest, offset: 0 }
    }),
  clearFilters: () => set({ filters: {}, searchQuery: '', offset: 0 }),
  setSortColumn: (column) => set({ sortColumn: column, offset: 0 }),
  setSortAscending: (ascending) => set({ sortAscending: ascending, offset: 0 }),
  setKeyColumnsOnly: (only) => set({ keyColumnsOnly: only, offset: 0 }),
  setOffset: (offset) => set({ offset }),
  setLimit: (limit) => set({ limit }),
  setIsLoadingData: (loading) => set({ isLoadingData: loading }),
  setIsSearching: (searching) => set({ isSearching: searching }),
  setStats: (stats) => set({ stats }),
  reset: () => set(initialState),
}))