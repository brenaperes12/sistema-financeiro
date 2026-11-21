
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import './Despesas.css'

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3001'
).replace(/\/$/, '')

async function getAuthHeaders(includeContentType = false) {
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw new Error('Não foi possível verificar sua sessão.')
  }

  const token = data.session?.access_token

  if (!token) {
    throw new Error('Sua sessão expirou. Faça login novamente.')
  }

  const headers = {
    Authorization: `Bearer ${token}`,
  }

  if (includeContentType) {
    headers['Content-Type'] = 'application/json'
  }

  return headers
}

async function apiRequest(path, options = {}) {
  const headers = await getAuthHeaders(Boolean(options.body))

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  })

  const result = await response.json()

  if (!response.ok || !result.success) {
    throw new Error(
      result.message || result.error || 'Não foi possível concluir a operação.'
    )
  }

  return result
}

function Despesas({ user, onTransactionChange }) {
  const [despesas, setDespesas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [periodo, setPeriodo] = useState('mes')
  const [editingId, setEditingId] = useState(null)

  const [form, setForm] = useState({
    description: '',
    amount: '',
    category_id: '',
    transaction_date: new Date().toISOString().slice(0, 10),
  })

  useEffect(() => {
    if (user?.id) {
      loadData()
    }
  }, [user?.id])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [transactionsResult, categoriesResult] = await Promise.all([
        apiRequest('/api/transactions?type=expense'),
        apiRequest('/api/categories'),
      ])

      const categoriesData = categoriesResult.categories || []
      const transactionsData = transactionsResult.transactions || []

      const expenseCategories = categoriesData
        .filter((category) => category.type === 'expense')
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

      setCategorias(expenseCategories)

      const categoryMap = new Map(
        expenseCategories.map((category) => [
          String(category.id),
          category.name,
        ])
      )

      setDespesas(
        transactionsData
          .filter((item) => item.type === 'expense')
          .map((item) => ({
            ...item,
            category_name:
              categoryMap.get(String(item.category_id)) || 'Sem categoria',
          }))
      )
    } catch (err) {
      setError('Não foi possível carregar as despesas: ' + err.message)
      setDespesas([])
      setCategorias([])
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm({
      description: '',
      amount: '',
      category_id: '',
      transaction_date: new Date().toISOString().slice(0, 10),
    })

    setEditingId(null)
  }

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const amount = Number(String(form.amount).replace(',', '.'))

    if (!form.description.trim()) {
      setError('Informe a descrição da despesa.')
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Informe um valor válido maior que zero.')
      return
    }

    if (!form.category_id) {
      setError('Selecione uma categoria.')
      return
    }

    if (!form.transaction_date) {
      setError('Informe a data da despesa.')
      return
    }

    setSaving(true)

    const data = {
      description: form.description.trim(),
      amount,
      category_id: Number(form.category_id),
      type: 'expense',
      transaction_date: form.transaction_date,
    }

    try {
      if (editingId) {
        await apiRequest(`/api/transactions/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        })
      } else {
        await apiRequest('/api/transactions', {
          method: 'POST',
          body: JSON.stringify(data),
        })
      }

      setSuccess(
        editingId
          ? 'Despesa atualizada com sucesso!'
          : 'Despesa cadastrada com sucesso!'
      )

      resetForm()
      await loadData()

      if (onTransactionChange) {
        await onTransactionChange()
      }
    } catch (err) {
      setError('Não foi possível salvar a despesa: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(despesa) {
    setForm({
      description: despesa.description || '',
      amount: String(despesa.amount ?? ''),
      category_id: String(despesa.category_id ?? ''),
      transaction_date:
        despesa.transaction_date || new Date().toISOString().slice(0, 10),
    })

    setEditingId(despesa.id)
    setError('')
    setSuccess('')

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id) {
    const confirmed = window.confirm(
      'Tem certeza de que deseja excluir esta despesa?'
    )

    if (!confirmed) return

    setError('')
    setSuccess('')

    try {
      await apiRequest(`/api/transactions/${id}`, {
        method: 'DELETE',
      })

      setSuccess('Despesa excluída com sucesso!')

      if (editingId === id) {
        resetForm()
      }

      await loadData()

      if (onTransactionChange) {
        await onTransactionChange()
      }
    } catch (err) {
      setError('Não foi possível excluir a despesa: ' + err.message)
    }
  }

  const despesasFiltradas = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    return despesas.filter((item) => {
      if (periodo === 'todas') return true

      const date = new Date(`${item.transaction_date}T12:00:00`)

      if (Number.isNaN(date.getTime())) return false

      if (periodo === 'mes') {
        return (
          date.getMonth() === currentMonth &&
          date.getFullYear() === currentYear
        )
      }

      if (periodo === 'ano') {
        return date.getFullYear() === currentYear
      }

      return true
    })
  }, [despesas, periodo])

  const totalPeriodo = despesasFiltradas.reduce(
    (total, item) => total + Number(item.amount || 0),
    0
  )

  const totalGeral = despesas.reduce(
    (total, item) => total + Number(item.amount || 0),
    0
  )

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function formatDate(value) {
    if (!value) return '—'

    const date = new Date(`${value}T12:00:00`)

    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString('pt-BR')
  }

  return (
    <section className="despesas-page">
      <div className="despesas-heading">
        <div>
          <span className="despesas-eyebrow">CONTROLE FINANCEIRO</span>
          <h1>Despesas.</h1>
          <p>Acompanhe seus gastos e mantenha seu orçamento sob controle.</p>
        </div>

        <div className="despesas-heading-icon">
          <i className="bi bi-wallet2" aria-hidden="true"></i>
        </div>
      </div>

      <div className="despesas-summary">
        <article className="despesas-summary-card">
          <div className="despesas-summary-icon">
            <i className="bi bi-calendar2-month"></i>
          </div>
          <div>
            <span>Despesas no período</span>
            <strong>{formatCurrency(totalPeriodo)}</strong>
          </div>
        </article>

        <article className="despesas-summary-card">
          <div className="despesas-summary-icon">
            <i className="bi bi-receipt"></i>
          </div>
          <div>
            <span>Total de lançamentos</span>
            <strong>{despesasFiltradas.length}</strong>
          </div>
        </article>

        <article className="despesas-summary-card">
          <div className="despesas-summary-icon">
            <i className="bi bi-graph-down-arrow"></i>
          </div>
          <div>
            <span>Total de despesas cadastradas</span>
            <strong>{formatCurrency(totalGeral)}</strong>
          </div>
        </article>
      </div>

      <div className="despesas-content-grid">
        <section className="despesas-panel despesas-form-panel">
          <div className="despesas-panel-heading">
            <div>
              <h2>{editingId ? 'Editar despesa' : 'Nova despesa'}</h2>
              <p>Preencha os dados do gasto.</p>
            </div>
            <i className="bi bi-pencil-square"></i>
          </div>

          {error && (
            <div className="despesas-alert despesas-alert-error">
              {error}
            </div>
          )}

          {success && (
            <div className="despesas-alert despesas-alert-success">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="despesas-form">
            <label htmlFor="despesa-description">Descrição</label>
            <input
              id="despesa-description"
              name="description"
              type="text"
              placeholder="Ex.: Conta de energia"
              value={form.description}
              onChange={handleChange}
              maxLength={120}
            />

            <div className="despesas-form-row">
              <div>
                <label htmlFor="despesa-amount">Valor (R$)</label>
                <input
                  id="despesa-amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0,00"
                  value={form.amount}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="despesa-date">Data</label>
                <input
                  id="despesa-date"
                  name="transaction_date"
                  type="date"
                  value={form.transaction_date}
                  onChange={handleChange}
                />
              </div>
            </div>

            <label htmlFor="despesa-category">Categoria</label>
            <select
              id="despesa-category"
              name="category_id"
              value={form.category_id}
              onChange={handleChange}
            >
              <option value="">Selecione uma categoria</option>

              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.name}
                </option>
              ))}
            </select>

            {categorias.length === 0 && (
              <p className="despesas-help">
                Você ainda não tem categorias de despesas. Cadastre uma em
                Categorias antes de continuar.
              </p>
            )}

            <div className="despesas-form-actions">
              {editingId && (
                <button
                  type="button"
                  className="despesas-button despesas-button-secondary"
                  onClick={resetForm}
                >
                  Cancelar
                </button>
              )}

              <button
                type="submit"
                className="despesas-button"
                disabled={saving || categorias.length === 0}
              >
                {saving
                  ? 'Salvando...'
                  : editingId
                    ? 'Salvar alterações'
                    : 'Cadastrar despesa'}
              </button>
            </div>
          </form>
        </section>

        <section className="despesas-panel despesas-list-panel">
          <div className="despesas-list-heading">
            <div>
              <h2>Histórico de despesas</h2>
              <p>Consulte, edite ou exclua seus lançamentos.</p>
            </div>

            <select
              aria-label="Filtrar despesas por período"
              value={periodo}
              onChange={(event) => setPeriodo(event.target.value)}
              className="despesas-period-select"
            >
              <option value="mes">Este mês</option>
              <option value="ano">Este ano</option>
              <option value="todas">Todas</option>
            </select>
          </div>

          {loading ? (
            <div className="despesas-empty">Carregando despesas...</div>
          ) : despesasFiltradas.length === 0 ? (
            <div className="despesas-empty">
              <i className="bi bi-inbox"></i>
              <strong>Nenhuma despesa encontrada</strong>
              <span>Cadastre uma despesa ou altere o filtro de período.</span>
            </div>
          ) : (
            <div className="despesas-table-wrap">
              <table className="despesas-table">
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Data</th>
                    <th>Valor</th>
                    <th>Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {despesasFiltradas.map((despesa) => (
                    <tr key={despesa.id}>
                      <td data-label="Descrição">{despesa.description}</td>

                      <td data-label="Categoria">
                        <span className="despesas-category">
                          {despesa.category_name}
                        </span>
                      </td>

                      <td data-label="Data">
                        {formatDate(despesa.transaction_date)}
                      </td>

                      <td data-label="Valor" className="despesas-value">
                        {formatCurrency(despesa.amount)}
                      </td>

                      <td data-label="Ações">
                        <div className="despesas-row-actions">
                          <button
                            type="button"
                            aria-label="Editar despesa"
                            onClick={() => handleEdit(despesa)}
                          >
                            <i className="bi bi-pencil"></i>
                          </button>

                          <button
                            type="button"
                            aria-label="Excluir despesa"
                            onClick={() => handleDelete(despesa.id)}
                          >
                            <i className="bi bi-trash3"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <footer className="despesas-footer">
        FINANCE GOLD © 2026 — CONTROLE FINANCEIRO INTELIGENTE
      </footer>
    </section>
  )
}

export default Despesas
