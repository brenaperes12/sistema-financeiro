
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './Receitas.css'

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3001'
).replace(/\/$/, '')

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dateFormat = new Intl.DateTimeFormat('pt-BR')

function getToday() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getMonthStart() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')

  return `${year}-${month}-01`
}

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

function Receitas({ user, onTransactionChange }) {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [transactionDate, setTransactionDate] = useState(getToday())

  const [period, setPeriod] = useState('month')
  const [editingId, setEditingId] = useState(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

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
        apiRequest('/api/transactions?type=income'),
        apiRequest('/api/categories'),
      ])

      const transactionsData = transactionsResult.transactions || []
      const categoriesData = categoriesResult.categories || []

      setTransactions(
        transactionsData
          .filter((transaction) => transaction.type === 'income')
          .sort((a, b) => {
            return (
              b.transaction_date.localeCompare(a.transaction_date)
            )
          })
      )

      setCategories(
        categoriesData
          .filter((category) => category.type === 'income')
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      )
    } catch (err) {
      setError('Não foi possível carregar os dados: ' + err.message)
      setTransactions([])
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  const filteredTransactions = transactions.filter((transaction) => {
    const date = transaction.transaction_date

    if (period === 'month') {
      return date >= getMonthStart() && date <= getToday()
    }

    if (period === 'year') {
      return date.startsWith(String(new Date().getFullYear()))
    }

    return true
  })

  const totalAll = transactions.reduce(
    (total, item) => total + Number(item.amount),
    0
  )

  const totalPeriod = filteredTransactions.reduce(
    (total, item) => total + Number(item.amount),
    0
  )

  const availableCategories = categories

  function resetForm() {
    setDescription('')
    setAmount('')
    setCategoryId('')
    setTransactionDate(getToday())
    setEditingId(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const numericAmount = Number(amount)

    if (!description.trim()) {
      setError('Informe a descrição da receita.')
      return
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Informe um valor válido maior que zero.')
      return
    }

    if (!transactionDate) {
      setError('Informe a data da receita.')
      return
    }

    if (categoryId) {
      const selectedCategory = categories.find(
        (category) => String(category.id) === String(categoryId)
      )

      if (!selectedCategory) {
        setError('Selecione uma categoria de receita válida.')
        return
      }
    }

    setSaving(true)
    setError('')
    setMessage('')

    const transactionData = {
      description: description.trim(),
      amount: numericAmount,
      type: 'income',
      transaction_date: transactionDate,
      category_id: categoryId ? Number(categoryId) : null,
    }

    try {
      if (editingId) {
        await apiRequest(`/api/transactions/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(transactionData),
        })

        setMessage('Receita atualizada com sucesso!')
      } else {
        await apiRequest('/api/transactions', {
          method: 'POST',
          body: JSON.stringify(transactionData),
        })

        setMessage('Receita cadastrada com sucesso!')
      }

      resetForm()
      await loadData()

      if (onTransactionChange) {
        await onTransactionChange()
      }
    } catch (err) {
      setError('Erro ao salvar receita: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(transaction) {
    setDescription(transaction.description)
    setAmount(String(transaction.amount))
    setCategoryId(
      transaction.category_id ? String(transaction.category_id) : ''
    )
    setTransactionDate(transaction.transaction_date)
    setEditingId(transaction.id)
    setError('')
    setMessage('')

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    resetForm()
    setError('')
    setMessage('')
  }

  async function handleDelete(id) {
    const confirmed = window.confirm(
      'Deseja realmente excluir esta receita?'
    )

    if (!confirmed) return

    setError('')
    setMessage('')

    try {
      await apiRequest(`/api/transactions/${id}`, {
        method: 'DELETE',
      })

      if (editingId === id) {
        resetForm()
      }

      setMessage('Receita excluída com sucesso!')

      await loadData()

      if (onTransactionChange) {
        await onTransactionChange()
      }
    } catch (err) {
      setError('Não foi possível excluir a receita: ' + err.message)
    }
  }

  function formatDate(date) {
    return dateFormat.format(new Date(`${date}T12:00:00`))
  }

  function getCategoryName(id) {
    const category = categories.find(
      (item) => String(item.id) === String(id)
    )

    return category?.name || 'Sem categoria'
  }

  return (
    <div className="dashboard-content revenues-page">

      <div className="welcome-section">
        <div>
          <span className="header-overline">
            ENTRADAS FINANCEIRAS
          </span>

          <h2>Suas receitas.</h2>

          <p>
            Acompanhe seus recebimentos e todas as entradas financeiras.
          </p>
        </div>

        <div className="month-indicator">
          <i className="bi bi-graph-up-arrow"></i>
          {transactions.length} receitas
        </div>
      </div>

      {error && (
        <div className="categories-feedback categories-error">
          <i className="bi bi-exclamation-circle"></i>
          {error}
        </div>
      )}

      {message && (
        <div className="categories-feedback categories-success">
          <i className="bi bi-check-circle"></i>
          {message}
        </div>
      )}

      <section className="revenue-summary">

        <article className="revenue-summary-card">
          <div>
            <span>Total de receitas</span>
            <strong className="income-value">
              {currency.format(totalAll)}
            </strong>
          </div>

          <div className="revenue-summary-icon">
            <i className="bi bi-wallet2"></i>
          </div>
        </article>

        <article className="revenue-summary-card">
          <div>
            <span>
              {period === 'month'
                ? 'Recebido neste mês'
                : period === 'year'
                  ? 'Recebido neste ano'
                  : 'Recebimentos no período'}
            </span>

            <strong className="income-value">
              {currency.format(totalPeriod)}
            </strong>
          </div>

          <div className="revenue-summary-icon">
            <i className="bi bi-calendar-check"></i>
          </div>
        </article>

        <article className="revenue-summary-card">
          <div>
            <span>Quantidade de receitas</span>
            <strong>{filteredTransactions.length}</strong>
          </div>

          <div className="revenue-summary-icon">
            <i className="bi bi-receipt"></i>
          </div>
        </article>

      </section>

      <div className="revenues-grid">

        <section className="dashboard-panel revenue-form-panel">

          <div className="panel-heading">
            <div>
              <span className="header-overline">
                {editingId ? 'EDIÇÃO' : 'NOVO RECEBIMENTO'}
              </span>

              <h3>
                {editingId ? 'Editar receita' : 'Nova receita'}
              </h3>
            </div>

            <div className="category-heading-icon">
              <i className="bi bi-graph-up-arrow"></i>
            </div>
          </div>

          <form onSubmit={handleSubmit}>

            <div className="category-field">
              <label htmlFor="revenueDescription">
                Descrição
              </label>

              <div className="category-input-wrapper">
                <i className="bi bi-card-text"></i>

                <input
                  id="revenueDescription"
                  type="text"
                  placeholder="Ex.: Salário, serviço realizado..."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={120}
                  required
                />
              </div>
            </div>

            <div className="category-field">
              <label htmlFor="revenueAmount">
                Valor recebido (R$)
              </label>

              <div className="category-input-wrapper">
                <i className="bi bi-currency-dollar"></i>

                <input
                  id="revenueAmount"
                  type="number"
                  placeholder="0,00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>
            </div>

            <div className="category-field">
              <label htmlFor="revenueCategory">
                Categoria
              </label>

              <div className="category-input-wrapper">
                <i className="bi bi-tags"></i>

                <select
                  id="revenueCategory"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Sem categoria</option>

                  {availableCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {availableCategories.length === 0 && (
                <small className="revenue-field-hint">
                  Nenhuma categoria de receita cadastrada.
                  Você pode adicionar uma na seção Categorias.
                </small>
              )}
            </div>

            <div className="category-field">
              <label htmlFor="revenueDate">
                Data do recebimento
              </label>

              <div className="category-input-wrapper">
                <i className="bi bi-calendar3"></i>

                <input
                  id="revenueDate"
                  type="date"
                  value={transactionDate}
                  onChange={(event) => setTransactionDate(event.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="category-submit"
              disabled={saving}
            >
              <i className={`bi ${editingId ? 'bi-check-lg' : 'bi-plus-lg'}`}></i>

              {saving
                ? 'Salvando...'
                : editingId
                  ? 'Salvar alterações'
                  : 'Cadastrar receita'}
            </button>

            {editingId && (
              <button
                type="button"
                className="category-cancel"
                onClick={cancelEdit}
                disabled={saving}
              >
                Cancelar edição
              </button>
            )}

          </form>
        </section>

        <section className="dashboard-panel revenue-list-panel">

          <div className="panel-heading">
            <div>
              <span className="header-overline">
                HISTÓRICO DE ENTRADAS
              </span>

              <h3>Receitas cadastradas</h3>
            </div>

            <div className="category-count">
              {filteredTransactions.length}
            </div>
          </div>

          <div className="revenue-filters">

            <button
              type="button"
              className={period === 'month' ? 'active' : ''}
              onClick={() => setPeriod('month')}
            >
              Este mês
            </button>

            <button
              type="button"
              className={period === 'year' ? 'active' : ''}
              onClick={() => setPeriod('year')}
            >
              Este ano
            </button>

            <button
              type="button"
              className={period === 'all' ? 'active' : ''}
              onClick={() => setPeriod('all')}
            >
              Todas
            </button>

          </div>

          {loading ? (
            <div className="category-empty">
              <i className="bi bi-arrow-repeat"></i>
              Carregando receitas...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="category-empty">
              <i className="bi bi-graph-up-arrow"></i>

              <strong>Nenhuma receita encontrada</strong>

              <span>
                Cadastre uma receita ou escolha outro período.
              </span>
            </div>
          ) : (
            <div className="revenue-list">

              {filteredTransactions.map((transaction) => (
                <div
                  className="revenue-item"
                  key={transaction.id}
                >

                  <div className="revenue-item-icon">
                    <i className="bi bi-arrow-down-left"></i>
                  </div>

                  <div className="revenue-item-info">
                    <strong>{transaction.description}</strong>

                    <span>
                      {getCategoryName(transaction.category_id)}
                      {' • '}
                      {formatDate(transaction.transaction_date)}
                    </span>
                  </div>

                  <strong className="income-value revenue-item-amount">
                    +{currency.format(Number(transaction.amount))}
                  </strong>

                  <div className="revenue-actions">

                    <button
                      type="button"
                      title="Editar receita"
                      onClick={() => handleEdit(transaction)}
                    >
                      <i className="bi bi-pencil-square"></i>
                    </button>

                    <button
                      type="button"
                      title="Excluir receita"
                      className="category-delete"
                      onClick={() => handleDelete(transaction.id)}
                    >
                      <i className="bi bi-trash3"></i>
                    </button>

                  </div>

                </div>
              ))}

            </div>
          )}

        </section>

      </div>

      <div className="dashboard-footer">
        FINANCE GOLD © 2026 — CONTROLE FINANCEIRO INTELIGENTE
      </div>

    </div>
  )
}

export default Receitas
