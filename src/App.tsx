import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  CATEGORIES,
  STATUSES,
  createTodo,
  deleteTodo,
  fetchTodos,
  updateTodo,
  type Category,
  type Status,
  type Todo,
} from './api/todos'
import './App.css'

type CategoryFilter = 'all' | Category
type ViewFilter = 'all' | Status

type FormState = {
  title: string
  dueDate: string
  category: Category
  memo: string
}

const STATUS_META: Record<Status, { key: Status; label: string }> = {
  todo: { key: 'todo', label: 'To do' },
  doing: { key: 'doing', label: 'In Progress' },
  done: { key: 'done', label: 'Done' },
}

const CATEGORY_META: Record<
  Category,
  { key: Category; label: string; icon: string }
> = {
  work: { key: 'work', label: '업무', icon: '▣' },
  study: { key: 'study', label: '공부', icon: '▤' },
  exercise: { key: 'exercise', label: '운동', icon: '◈' },
  personal: { key: 'personal', label: '개인', icon: '◇' },
  hobby: { key: 'hobby', label: '취미', icon: '☆' },
}

const emptyForm: FormState = {
  title: '',
  dueDate: '',
  category: 'personal',
  memo: '',
}

function toDateInputValue(value: string | Date | null | undefined) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function isOverdue(todo: Pick<Todo, 'dueDate' | 'status'>) {
  if (!todo.dueDate || todo.status === 'done') return false
  const due = new Date(todo.dueDate)
  if (Number.isNaN(due.getTime())) return false
  due.setHours(0, 0, 0, 0)
  return due < startOfToday()
}

function formatDday(value: string | null | undefined) {
  if (!value) return ''
  const due = new Date(value)
  if (Number.isNaN(due.getTime())) return ''
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.round(
    (due.getTime() - startOfToday().getTime()) / 86400000,
  )
  if (diffDays === 0) return 'd-day'
  if (diffDays > 0) return `d-${diffDays}`
  return `d+${Math.abs(diffDays)}`
}

function resolveStatus(todo: Todo): Status {
  if (STATUSES.includes(todo.status)) return todo.status
  return todo.completed ? 'done' : 'todo'
}

function resolveCategory(todo: Todo): Category {
  return CATEGORIES.includes(todo.category) ? todo.category : 'personal'
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [addStatus, setAddStatus] = useState<Status>('todo')
  const [addForm, setAddForm] = useState<FormState>(emptyForm)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailForm, setDetailForm] = useState<FormState>(emptyForm)
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    toDateInputValue(new Date()),
  )

  useEffect(() => {
    let cancelled = false

    async function loadTodos() {
      try {
        setLoading(true)
        setError('')
        const data = await fetchTodos()
        if (!cancelled) setTodos(data)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : '목록을 불러오지 못했습니다.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadTodos()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    document.body.style.overflow = addOpen || detailId ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [addOpen, detailId])

  const normalizedTodos = useMemo(
    () =>
      todos.map((todo) => ({
        ...todo,
        status: resolveStatus(todo),
        category: resolveCategory(todo),
        memo: todo.memo ?? '',
      })),
    [todos],
  )

  const visibleTodos = useMemo(
    () =>
      normalizedTodos.filter((todo) => {
        if (categoryFilter !== 'all' && todo.category !== categoryFilter) {
          return false
        }
        return true
      }),
    [normalizedTodos, categoryFilter],
  )

  const grouped = useMemo(
    () => ({
      todo: visibleTodos.filter((todo) => todo.status === 'todo'),
      doing: visibleTodos.filter((todo) => todo.status === 'doing'),
      done: visibleTodos.filter((todo) => todo.status === 'done'),
    }),
    [visibleTodos],
  )

  const selectedDayTodos = useMemo(
    () =>
      visibleTodos.filter(
        (todo) =>
          todo.dueDate && toDateInputValue(todo.dueDate) === selectedDateKey,
      ),
    [visibleTodos, selectedDateKey],
  )

  const dueDateSet = useMemo(() => {
    const set = new Set<string>()
    for (const todo of visibleTodos) {
      if (todo.dueDate) set.add(toDateInputValue(todo.dueDate))
    }
    return set
  }, [visibleTodos])

  const calendarCells = useMemo(() => {
    const { year, month } = calendarCursor
    const firstDay = new Date(year, month, 1)
    const startWeekday = firstDay.getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const prevMonthDays = new Date(year, month, 0).getDate()
    const cells: { date: Date; muted: boolean }[] = []

    for (let i = startWeekday - 1; i >= 0; i -= 1) {
      cells.push({ date: new Date(year, month - 1, prevMonthDays - i), muted: true })
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ date: new Date(year, month, day), muted: false })
    }
    while (cells.length % 7 !== 0) {
      const nextDay = cells.length - (startWeekday + daysInMonth) + 1
      cells.push({ date: new Date(year, month + 1, nextDay), muted: true })
    }
    return cells
  }, [calendarCursor])

  const detailTodo = normalizedTodos.find((todo) => todo._id === detailId)
  const detailOverdue = detailForm.dueDate
    ? isOverdue({ dueDate: detailForm.dueDate, status: 'todo' })
    : false

  function openAddModal(status: Status = 'todo') {
    setDetailId(null)
    setAddStatus(status)
    setAddForm(emptyForm)
    setAddOpen(true)
  }

  function closeAddModal() {
    if (saving) return
    setAddOpen(false)
    setAddForm(emptyForm)
  }

  function openDetailModal(todo: Todo) {
    setAddOpen(false)
    setDetailId(todo._id)
    setDetailForm({
      title: todo.title,
      dueDate: toDateInputValue(todo.dueDate),
      category: resolveCategory(todo),
      memo: todo.memo ?? '',
    })
  }

  function closeDetailModal() {
    if (saving) return
    setDetailId(null)
    setDetailForm(emptyForm)
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    const title = addForm.title.trim()
    if (!title) {
      setError('할일 내용을 입력해 주세요.')
      return
    }
    if (!addForm.dueDate) {
      setError('마감일을 선택해 주세요.')
      return
    }

    try {
      setSaving(true)
      setError('')
      const created = await createTodo({
        title,
        status: addStatus,
        category: addForm.category,
        dueDate: addForm.dueDate,
        memo: addForm.memo.trim(),
      })
      setTodos((prev) => [created, ...prev])
      setAddOpen(false)
      setAddForm(emptyForm)
    } catch (err) {
      setError(err instanceof Error ? err.message : '추가에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveDetail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!detailId || saving) return

    const title = detailForm.title.trim()
    if (!title) {
      setError('할일 내용을 입력해 주세요.')
      return
    }
    if (!detailForm.dueDate) {
      setError('마감일을 선택해 주세요.')
      return
    }

    try {
      setSaving(true)
      setError('')
      const updated = await updateTodo(detailId, {
        title,
        dueDate: detailForm.dueDate,
        memo: detailForm.memo.trim(),
        category: detailForm.category,
      })
      setTodos((prev) =>
        prev.map((item) => (item._id === detailId ? updated : item)),
      )
      setDetailId(null)
      setDetailForm(emptyForm)
    } catch (err) {
      setError(err instanceof Error ? err.message : '수정에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      setSaving(true)
      setError('')
      await deleteTodo(id)
      setTodos((prev) => prev.filter((item) => item._id !== id))
      if (detailId === id) {
        setDetailId(null)
        setDetailForm(emptyForm)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleMove(todo: Todo, status: Status) {
    if (todo.status === status) return
    try {
      setError('')
      const updated = await updateTodo(todo._id, { status })
      setTodos((prev) =>
        prev.map((item) => (item._id === todo._id ? updated : item)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 변경에 실패했습니다.')
    }
  }

  async function handleToggleDone(todo: Todo) {
    const nextStatus: Status = todo.status === 'done' ? 'todo' : 'done'
    await handleMove(todo, nextStatus)
  }

  function renderColumn(status: Status, title: string) {
    const items = grouped[status]
    const hidden = viewFilter !== 'all' && viewFilter !== status

    return (
      <div
        className={`column${hidden ? ' is-hidden' : ''}`}
        data-status={status}
        key={status}
      >
        <div className="column-header">
          <h2>{title}</h2>
          <button
            type="button"
            className="btn btn-add-column"
            aria-label={`${title}에 추가`}
            onClick={() => openAddModal(status)}
          >
            +
          </button>
        </div>
        <ul className="column-list">
          {items.map((todo) => {
            const overdue = isOverdue(todo)
            return (
              <li
                key={todo._id}
                className={[
                  'todo-item',
                  'is-clickable',
                  `status-${todo.status}`,
                  todo.status === 'done' ? 'is-done' : '',
                  overdue ? 'is-overdue' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                role="button"
                tabIndex={0}
                aria-label={`${todo.title} 상세 보기`}
                onClick={() => openDetailModal(todo)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openDetailModal(todo)
                  }
                }}
              >
                <div className="todo-card-top">
                  <input
                    type="checkbox"
                    className="todo-check"
                    checked={todo.status === 'done'}
                    aria-label="완료 표시"
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => void handleToggleDone(todo)}
                  />
                  <div className="todo-card-heading">
                    <h3 className="todo-text">{todo.title}</h3>
                    <span className={`todo-category cat-${todo.category}`}>
                      {CATEGORY_META[todo.category].label}
                    </span>
                    <p
                      className={`todo-subtitle${
                        overdue ? ' is-overdue-label' : ''
                      }`}
                    >
                      {todo.dueDate
                        ? overdue
                          ? `${formatDday(todo.dueDate)} · 마감 지남`
                          : formatDday(todo.dueDate)
                        : `등록 ${formatDate(todo.createdAt) || '-'}`}
                    </p>
                  </div>
                </div>

                <div
                  className="todo-move"
                  onClick={(event) => event.stopPropagation()}
                >
                  {STATUSES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`btn btn-move${
                        item === todo.status ? ' is-current' : ''
                      }`}
                      disabled={item === todo.status}
                      onClick={() => void handleMove(todo, item)}
                    >
                      {STATUS_META[item].label}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
        <p className={`column-empty${items.length > 0 ? ' is-hidden' : ''}`}>
          항목 없음
        </p>
      </div>
    )
  }

  const todayKey = toDateInputValue(new Date())

  return (
    <>
      <div className="bg-glow" aria-hidden="true" />

      <div className="shell">
        <aside className="sidebar" aria-label="카테고리">
          <header className="sidebar-header">
            <button type="button" className="menu-btn" aria-label="메뉴">
              <span />
              <span />
              <span />
            </button>
            <h1 className="app-title">Todo App</h1>
          </header>

          <nav className="side-nav" aria-label="카테고리 목록">
            <button
              type="button"
              className={`side-nav-item${
                categoryFilter === 'all' ? ' is-active' : ''
              }`}
              onClick={() => setCategoryFilter('all')}
            >
              <span className="side-nav-icon" aria-hidden="true">
                ◎
              </span>
              <span className="side-nav-label">전체</span>
              <span className="side-nav-arrow" aria-hidden="true">
                ›
              </span>
            </button>
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                className={`side-nav-item${
                  categoryFilter === category ? ' is-active' : ''
                }`}
                onClick={() => setCategoryFilter(category)}
              >
                <span className="side-nav-icon" aria-hidden="true">
                  {CATEGORY_META[category].icon}
                </span>
                <span className="side-nav-label">
                  {CATEGORY_META[category].label}
                </span>
                <span className="side-nav-arrow" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="app">
          <div className="view-bar">
            <nav className="view-tabs" aria-label="상태 보기">
              {(
                [
                  ['all', 'All'],
                  ['todo', 'To do'],
                  ['doing', 'In Progress'],
                  ['done', 'Done'],
                ] as const
              ).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  className={`view-tab${viewFilter === view ? ' is-active' : ''}`}
                  aria-selected={viewFilter === view}
                  onClick={() => setViewFilter(view)}
                >
                  {label}
                </button>
              ))}
            </nav>

            <button
              type="button"
              className="btn btn-open-add"
              onClick={() => openAddModal('todo')}
            >
              + 추가하기
            </button>
          </div>

          {error ? (
            <p className="form-hint" role="alert" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          ) : null}
          {loading ? <p className="form-hint">할일을 불러오는 중입니다…</p> : null}

          <section
            className={`board${viewFilter !== 'all' ? ' is-single' : ''}`}
            aria-label="칸반 보드"
          >
            {renderColumn('todo', 'To do List')}
            {renderColumn('doing', 'In Progress')}
            {renderColumn('done', 'Done')}
          </section>
        </main>

        <aside className="calendar-panel" aria-label="캘린더">
          <section className="calendar-card">
            <div className="calendar-header">
              <button
                type="button"
                className="btn btn-ghost calendar-nav"
                aria-label="이전 달"
                onClick={() =>
                  setCalendarCursor((prev) => {
                    const date = new Date(prev.year, prev.month - 1, 1)
                    return { year: date.getFullYear(), month: date.getMonth() }
                  })
                }
              >
                ‹
              </button>
              <h2 className="calendar-title">
                {calendarCursor.year}년 {calendarCursor.month + 1}월
              </h2>
              <button
                type="button"
                className="btn btn-ghost calendar-nav"
                aria-label="다음 달"
                onClick={() =>
                  setCalendarCursor((prev) => {
                    const date = new Date(prev.year, prev.month + 1, 1)
                    return { year: date.getFullYear(), month: date.getMonth() }
                  })
                }
              >
                ›
              </button>
            </div>
            <div className="calendar-weekdays" aria-hidden="true">
              <span>일</span>
              <span>월</span>
              <span>화</span>
              <span>수</span>
              <span>목</span>
              <span>금</span>
              <span>토</span>
            </div>
            <div className="calendar-grid">
              {calendarCells.map(({ date, muted }) => {
                const key = toDateInputValue(date)
                return (
                  <button
                    key={`${key}-${muted ? 'm' : 'd'}`}
                    type="button"
                    className={[
                      'calendar-day',
                      muted ? 'is-muted' : '',
                      key === todayKey ? 'is-today' : '',
                      dueDateSet.has(key) ? 'has-todo' : '',
                      key === selectedDateKey ? 'is-selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      setSelectedDateKey(key)
                      setCalendarCursor({
                        year: date.getFullYear(),
                        month: date.getMonth(),
                      })
                    }}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="today-panel">
            <h3 className="today-title">선택한 날짜 할일</h3>
            <ul className="today-list">
              {selectedDayTodos.map((todo) => (
                <li
                  key={todo._id}
                  className="today-item is-clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => openDetailModal(todo)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openDetailModal(todo)
                    }
                  }}
                >
                  <span className="today-item-title">{todo.title}</span>
                  <span className="today-item-meta">
                    {CATEGORY_META[todo.category].label} ·{' '}
                    {STATUS_META[todo.status].label}
                  </span>
                </li>
              ))}
            </ul>
            <p
              className={`today-empty${
                selectedDayTodos.length > 0 ? ' is-hidden' : ''
              }`}
            >
              이 날짜의 할일이 없습니다.
            </p>
          </section>
        </aside>
      </div>

      <div className="modal" hidden={!addOpen}>
        <div className="modal-backdrop" onClick={closeAddModal} />
        <div
          className="modal-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-modal-title"
        >
          <div className="modal-header">
            <h2 id="add-modal-title">새 할일 추가</h2>
            <button
              type="button"
              className="btn btn-ghost modal-close"
              aria-label="닫기"
              onClick={closeAddModal}
            >
              ✕
            </button>
          </div>

          <form className="modal-form" onSubmit={handleAdd} autoComplete="off">
            <label className="modal-field">
              <input
                className="todo-input"
                type="text"
                value={addForm.title}
                onChange={(event) =>
                  setAddForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="할일"
                maxLength={200}
                required
                autoFocus
              />
            </label>

            <label className="modal-field">
              <textarea
                className="memo-input"
                value={addForm.memo}
                onChange={(event) =>
                  setAddForm((prev) => ({ ...prev, memo: event.target.value }))
                }
                rows={2}
                maxLength={500}
                placeholder="메모 (선택)"
              />
            </label>

            <div className="modal-row">
              <label className="modal-field">
                <input
                  className="date-input"
                  type="date"
                  value={addForm.dueDate}
                  onChange={(event) =>
                    setAddForm((prev) => ({
                      ...prev,
                      dueDate: event.target.value,
                    }))
                  }
                  required
                  aria-label="마감일"
                />
              </label>

              <label className="modal-field">
                <select
                  className="status-select"
                  value={addForm.category}
                  onChange={(event) =>
                    setAddForm((prev) => ({
                      ...prev,
                      category: event.target.value as Category,
                    }))
                  }
                  aria-label="카테고리"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {CATEGORY_META[category].label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeAddModal}
              >
                취소
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? '추가 중…' : '추가하기'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="modal" hidden={!detailId}>
        <div className="modal-backdrop" onClick={closeDetailModal} />
        <div
          className="modal-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-modal-title"
        >
          <div className="modal-header">
            <h2 id="detail-modal-title">할일 상세</h2>
            <button
              type="button"
              className="btn btn-ghost modal-close"
              aria-label="닫기"
              onClick={closeDetailModal}
            >
              ✕
            </button>
          </div>

          <form
            className="modal-form"
            onSubmit={handleSaveDetail}
            autoComplete="off"
          >
            <p className={`detail-dday${detailOverdue ? ' is-overdue' : ''}`}>
              {!detailForm.dueDate
                ? '마감일을 선택해 주세요'
                : detailOverdue
                  ? `${formatDday(detailForm.dueDate)} · 마감 지남 · ${formatDate(detailForm.dueDate)}`
                  : `${formatDday(detailForm.dueDate)} · 마감 ${formatDate(detailForm.dueDate)}`}
            </p>

            <label className="modal-field">
              <input
                className="todo-input"
                type="text"
                value={detailForm.title}
                onChange={(event) =>
                  setDetailForm((prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
                placeholder="할일"
                maxLength={200}
                required
              />
            </label>

            <label className="modal-field">
              <textarea
                className="memo-input"
                value={detailForm.memo}
                onChange={(event) =>
                  setDetailForm((prev) => ({
                    ...prev,
                    memo: event.target.value,
                  }))
                }
                rows={3}
                maxLength={500}
                placeholder="메모 (선택)"
              />
            </label>

            <div className="modal-row">
              <label className="modal-field">
                <input
                  className="date-input"
                  type="date"
                  value={detailForm.dueDate}
                  onChange={(event) =>
                    setDetailForm((prev) => ({
                      ...prev,
                      dueDate: event.target.value,
                    }))
                  }
                  required
                  aria-label="마감일"
                />
              </label>

              <label className="modal-field">
                <select
                  className="status-select"
                  value={detailForm.category}
                  onChange={(event) =>
                    setDetailForm((prev) => ({
                      ...prev,
                      category: event.target.value as Category,
                    }))
                  }
                  aria-label="카테고리"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {CATEGORY_META[category].label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="modal-actions modal-actions-split">
              <button
                type="button"
                className="btn btn-danger"
                disabled={saving || !detailTodo}
                onClick={() => {
                  if (detailId) void handleDelete(detailId)
                }}
              >
                삭제
              </button>
              <div className="modal-actions-right">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeDetailModal}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? '저장 중…' : '저장'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

export default App
