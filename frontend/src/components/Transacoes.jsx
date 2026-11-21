
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './Transacoes.css'

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

async function getAuthHeaders(includeContentType = false) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    throw new Error('Não foi possível verificar sua sessão.')
  }

  if (!session?.access_token) {
    throw new Error('Sua sessão expirou. Entre novamente na sua conta.')
  }

  const headers = {
    Authorization: `Bearer ${session.access_token}`,
  }

  if (includeContentType) {
    headers['Content-Type'] = 'application/json'
  }

  return headers
}

async function apiRequest(endpoint, options = {}) {
  const headers = await getAuthHeaders(
    options.method === 'POST' || options.method === 'PUT'
  )

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  })

  let result

  try {
    result = await response.json()
  } catch {
    throw new Error('O servidor retornou uma resposta inválida.')
  }

  if (!response.ok || !result.success) {
    throw new Error(
      result.message ||
      result.error ||
      'Não foi possível realizar a operação.'
    )
  }

  return result
}

function Transacoes({ user, onTransactionChange }) {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('expense')
  const [categoryId, setCategoryId] = useState('')
  const [transactionDate, setTransactionDate] = useState(getToday())

  const [filter, setFilter] = useState('all')
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
        apiRequest('/api/transactions'),
        apiRequest('/api/categories'),
      ])

      const loadedTransactions = transactionsResult.transactions || []
      const loadedCategories = categoriesResult.categories || []

      loadedTransactions.sort((a, b) => {
        const dateComparison = b.transaction_date.localeCompare(
          a.transaction_date
        )

        if (dateComparison !== 0) return dateComparison

        return Number(b.id) - Number(a.id)
      })

      setTransactions(loadedTransactions)
      setCategories(loadedCategories)
    } catch (err) {
      setError('Não foi possível carregar os dados: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const availableCategories = categories.filter(
    (category) => category.type === type
  )

  function resetForm() {
    setDescription('')
    setAmount('')
    setType('expense')
    setCategoryId('')
    setTransactionDate(getToday())
    setEditingId(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const numericAmount = Number(amount)

    if (!description.trim()) {
      setError('Informe a descrição da movimentação.')
      return
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Informe um valor válido maior que zero.')
      return
    }

    if (!transactionDate) {
      setError('Informe a data da movimentação.')
      return
    }

    if (categoryId) {
      const selectedCategory = categories.find(
        (category) => String(category.id) === String(categoryId)
      )

      if (!selectedCategory || selectedCategory.type !== type) {
        setError(
          'Selecione uma categoria compatível com o tipo da movimentação.'
        )
        return
      }
    }

    setSaving(true)
    setError('')
    setMessage('')

    const transactionData = {
      description: description.trim(),
      amount: numericAmount,
      type,
      transaction_date: transactionDate,
      category_id: categoryId ? Number(categoryId) : null,
    }

    try {
      if (editingId) {
        await apiRequest(`/api/transactions/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(transactionData),
        })

        setMessage('Transação atualizada com sucesso!')
      } else {
        await apiRequest('/api/transactions', {
          method: 'POST',
          body: JSON.stringify(transactionData),
        })

        setMessage('Transação cadastrada com sucesso!')
      }

      resetForm()
      await loadData()

      if (onTransactionChange) {
        await onTransactionChange()
      }
    } catch (err) {
      setError('Erro ao salvar transação: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(transaction) {
    setDescription(transaction.description)
    setAmount(String(transaction.amount))
    setType(transaction.type)
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
      'Deseja realmente excluir esta transação?'
    )

    if (!confirmed) return

    setError('')
    setMessage('')

    try {
      await apiRequest(`/api/transactions/${id}`, {
        method: 'DELETE',
      })

      if (String(editingId) === String(id)) {
        resetForm()
      }

      setMessage('Transação excluída com sucesso!')

      await loadData()

      if (onTransactionChange) {
        await onTransactionChange()
      }
    } catch (err) {
      setError('Não foi possível excluir a transação: ' + err.message)
    }
  }

  const filteredTransactions = transactions.filter((transaction) => {
    if (filter === 'all') return true
    return transaction.type === filter
  })

  const totalIncome = filteredTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((total, transaction) => total + Number(transaction.amount), 0)

  const totalExpenses = filteredTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((total, transaction) => total + Number(transaction.amount), 0)

  function formatDate(date) {
    return dateFormat.format(new Date(`${date}T12:00:00`))
  }

  function categoryName(id) {
    const category = categories.find(
      (item) => String(item.id) === String(id)
    )

    return category?.name || 'Sem categoria'
  }

  return (
    <div className="dashboard-content transactions-page">

      <div className="welcome-section">
        <div>
          <span className="header-overline">
            CONTROLE FINANCEIRO
          </span>

          <h2>Suas movimentações.</h2>

          <p>
            Registre e acompanhe todas as suas receitas e despesas.
          </p>
        </div>

        <div className="month-indicator">
          <i className="bi bi-arrow-left-right"></i>
          {transactions.length} movimentações
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

      <section className="transaction-summary">

        <article className="transaction-summary-card">
          <span>Receitas exibidas</span>

          <strong className="income-value">
            {currency.format(totalIncome)}
          </strong>

          <i className="bi bi-arrow-down-left"></i>
        </article>

        <article className="transaction-summary-card">
          <span>Despesas exibidas</span>

          <strong className="expense-value">
            {currency.format(totalExpenses)}
          </strong>

          <i className="bi bi-arrow-up-right"></i>
        </article>

        <article className="transaction-summary-card">
          <span>Resultado exibido</span>

          <strong
            className={
              totalIncome - totalExpenses >= 0
                ? 'income-value'
                : 'expense-value'
            }
          >
            {currency.format(totalIncome - totalExpenses)}
          </strong>

          <i className="bi bi-wallet2"></i>
        </article>

      </section>

      <div className="transactions-grid">

        <section className="dashboard-panel transaction-form-panel">

          <div className="panel-heading">
            <div>
              <span className="header-overline">
                {editingId ? 'EDIÇÃO' : 'NOVO LANÇAMENTO'}
              </span>

              <h3>
                {editingId ? 'Editar transação' : 'Nova transação'}
              </h3>
            </div>

            <div className="category-heading-icon">
              <i className="bi bi-receipt"></i>
            </div>
          </div>

          <form onSubmit={handleSubmit}>

            <div className="category-field">
              <label htmlFor="transactionType">
                Tipo de movimentação
              </label>

              <div className="category-input-wrapper">
                <i className="bi bi-arrow-left-right"></i>

                <select
                  id="transactionType"
                  value={type}
                  onChange={(event) => {
                    setType(event.target.value)
                    setCategoryId('')
                  }}
                  required
                >
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                </select>
              </div>
            </div>

            <div className="category-field">
              <label htmlFor="transactionDescription">
                Descrição
              </label>

              <div className="category-input-wrapper">
                <i className="bi bi-card-text"></i>

                <input
                  id="transactionDescription"
                  type="text"
                  placeholder="Ex.: Compra no supermercado..."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={120}
                  required
                />
              </div>
            </div>

            <div className="category-field">
              <label htmlFor="transactionAmount">
                Valor (R$)
              </label>

              <div className="category-input-wrapper">
                <i className="bi bi-currency-dollar"></i>

                <input
                  id="transactionAmount"
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
              <label htmlFor="transactionCategory">
                Categoria
              </label>

              <div className="category-input-wrapper">
                <i className="bi bi-tags"></i>

                <select
                  id="transactionCategory"
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
                <small className="transaction-field-hint">
                  Nenhuma categoria cadastrada para este tipo.
                  Você pode cadastrar uma na seção Categorias.
                </small>
              )}
            </div>

            <div className="category-field">
              <label htmlFor="transactionDate">
                Data da movimentação
              </label>

              <div className="category-input-wrapper">
                <i className="bi bi-calendar3"></i>

                <input
                  id="transactionDate"
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
              <i
                className={`bi ${
                  editingId ? 'bi-check-lg' : 'bi-plus-lg'
                }`}
              ></i>

              {saving
                ? 'Salvando...'
                : editingId
                  ? 'Salvar alterações'
                  : 'Cadastrar transação'}
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

        <section className="dashboard-panel transaction-list-panel">

          <div className="panel-heading">
            <div>
              <span className="header-overline">
                HISTÓRICO FINANCEIRO
              </span>

              <h3>Suas transações</h3>
            </div>

            <div className="category-count">
              {filteredTransactions.length}
            </div>
          </div>

          <div className="transaction-filters">

            <button
              type="button"
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              Todas
            </button>

            <button
              type="button"
              className={filter === 'income' ? 'active' : ''}
              onClick={() => setFilter('income')}
            >
              Receitas
            </button>

            <button
              type="button"
              className={filter === 'expense' ? 'active' : ''}
              onClick={() => setFilter('expense')}
            >
              Despesas
            </button>

          </div>

          {loading ? (
            <div className="category-empty">
              <i className="bi bi-arrow-repeat"></i>
              Carregando movimentações...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="category-empty">
              <i className="bi bi-receipt"></i>

              <strong>Nenhuma transação encontrada</strong>

              <span>
                Cadastre sua primeira movimentação financeira.
              </span>
            </div>
          ) : (
            <div className="transaction-management-list">

              {filteredTransactions.map((transaction) => (
                <div
                  className="transaction-management-item"
                  key={transaction.id}
                >

                  <div
                    className={`transaction-management-icon ${
                      transaction.type === 'income'
                        ? 'transaction-management-income'
                        : 'transaction-management-expense'
                    }`}
                  >
                    <i
                      className={`bi ${
                        transaction.type === 'income'
                          ? 'bi-arrow-down-left'
                          : 'bi-arrow-up-right'
                      }`}
                    ></i>
                  </div>

                  <div className="transaction-management-info">
                    <strong>{transaction.description}</strong>

                    <span>
                      {categoryName(transaction.category_id)}
                      {' • '}
                      {formatDate(transaction.transaction_date)}
                    </span>

                    <small>
                      {transaction.type === 'income' ? 'Receita' : 'Despesa'}
                    </small>
                  </div>

                  <strong
                    className={
                      transaction.type === 'income'
                        ? 'income-value'
                        : 'expense-value'
                    }
                  >
                    {transaction.type === 'income' ? '+' : '-'}
                    {currency.format(Number(transaction.amount))}
                  </strong>

                  <div className="transaction-management-actions">

                    <button
                      type="button"
                      title="Editar transação"
                      onClick={() => handleEdit(transaction)}
                    >
                      <i className="bi bi-pencil-square"></i>
                    </button>

                    <button
                      type="button"
                      title="Excluir transação"
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

export default Transacoes
