const API_BASE =
  import.meta.env.VITE_API_URL ||
  'https://vibe-todobackend-e1d04ea1f6f5.herokuapp.com/todos'

export const STATUSES = ['todo', 'doing', 'done'] as const
export const CATEGORIES = [
  'work',
  'study',
  'exercise',
  'personal',
  'hobby',
] as const

export type Status = (typeof STATUSES)[number]
export type Category = (typeof CATEGORIES)[number]

export type Todo = {
  _id: string
  title: string
  completed: boolean
  status: Status
  category: Category
  dueDate: string | null
  memo: string
  createdAt: string
  updatedAt: string
}

export type TodoInput = {
  title: string
  status?: Status
  category?: Category
  dueDate?: string | null
  memo?: string
}

export type TodoUpdate = {
  title?: string
  status?: Status
  category?: Category
  dueDate?: string | null
  memo?: string
  completed?: boolean
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { headers, ...rest } = options
  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : '요청에 실패했습니다.',
    )
  }

  return data as T
}

export function fetchTodos() {
  return request<Todo[]>('')
}

export function createTodo(payload: TodoInput) {
  return request<Todo>('', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTodo(id: string, updates: TodoUpdate) {
  return request<Todo>(`/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export function deleteTodo(id: string) {
  return request<Todo>(`/${id}`, {
    method: 'DELETE',
  })
}
