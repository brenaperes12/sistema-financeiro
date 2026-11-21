
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

import Categorias from './Categorias'
import Transacoes from './Transacoes'
import Receitas from './Receitas'
import Despesas from './Despesas'
import Configuracoes from './Configuracoes'

import './Dashboard.css'

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3001'
).replace(/\/$/, '')

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'bi-grid-1x2' },
  { id: 'transacoes', label: 'Transações', icon: 'bi-arrow-left-right' },
  { id: 'receitas', label: 'Receitas', icon: 'bi-graph-up-arrow' },
  { id: 'despesas', label: 'Despesas', icon: 'bi-graph-down-arrow' },
  { id: 'categorias', label: 'Categorias', icon: 'bi-tags' },
  { id: 'configuracoes', label: 'Configurações', icon: 'bi-gear' },
]

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dateFormat = new Intl.DateTimeFormat('pt-BR')

async function getAuthHeaders() {
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

  return {
    Authorization: `Bearer ${session.access_token}`,
  }
}

async function apiRequest(endpoint) {
  const headers = await getAuthHeaders()

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'GET',
    headers,
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
      'Não foi possível carregar os dados.'
    )
  }

  return result
}

function Dashboard({ user, onLogout }) {
  const displayName = user?.user_metadata?.name?.trim() || 'Minha conta'

  const avatarInitial = displayName !== 'Minha conta'
    ? displayName[0].toUpperCase()
    : (user?.email || 'U')[0].toUpperCase()

  const [activeSection, setActiveSection] = useState('dashboard')

  const [transactions, setTransactions] = useState([])

  const [balance, setBalance] = useState(0)
  const [income, setIncome] = useState(0)
  const [expenses, setExpenses] = useState(0)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [sidebarOpen, setSidebarOpen] = useState(false)

  const today = new Date()

  const monthName = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(today)

  useEffect(() => {
    if (user?.id) {
      loadFinancialData()
    }
  }, [user?.id])

  async function loadFinancialData() {
    setLoading(true)
    setError('')

    try {
      const [transactionsResult, categoriesResult] = await Promise.all([
        apiRequest('/api/transactions'),
        apiRequest('/api/categories'),
      ])

      const allTransactions = transactionsResult.transactions || []
      const allCategories = categoriesResult.categories || []

      const year = new Date().getFullYear()
      const month = new Date().getMonth()

      const monthTransactions = allTransactions.filter((transaction) => {
        const transactionDate = new Date(
          `${transaction.transaction_date}T12:00:00`
        )

        return (
          transactionDate.getFullYear() === year &&
          transactionDate.getMonth() === month
        )
      })

      const totalBalance = allTransactions.reduce((total, item) => {
        const amount = Number(item.amount)

        return total + (
          item.type === 'income' ? amount : -amount
        )
      }, 0)

      const totalIncome = monthTransactions
        .filter((item) => item.type === 'income')
        .reduce((total, item) => total + Number(item.amount), 0)

      const totalExpenses = monthTransactions
        .filter((item) => item.type === 'expense')
        .reduce((total, item) => total + Number(item.amount), 0)

      const categoryMap = Object.fromEntries(
        allCategories.map((category) => [
          String(category.id),
          category.name,
        ])
      )

      const recent = [...allTransactions]
        .sort((a, b) => {
          const dateComparison = b.transaction_date.localeCompare(
            a.transaction_date
          )

          if (dateComparison !== 0) return dateComparison

          return Number(b.id) - Number(a.id)
        })
        .slice(0, 6)
        .map((item) => ({
          ...item,
          categoryName:
            categoryMap[String(item.category_id)] || 'Sem categoria',
        }))

      setBalance(totalBalance)
      setIncome(totalIncome)
      setExpenses(totalExpenses)
      setTransactions(recent)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function selectSection(section) {
    setActiveSection(section)
    setSidebarOpen(false)
  }

  const monthlyResult = income - expenses
  const maxValue = Math.max(income, expenses, 1)

  return (
    <div className="dashboard-layout">

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`dashboard-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>

        <div className="sidebar-brand">

          <div className="sidebar-logo">
            <i className="bi bi-gem"></i>
          </div>

          <div>
            <strong>FINANCE GOLD</strong>
            <span>GESTÃO FINANCEIRA</span>
          </div>

          <button
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            <i className="bi bi-x-lg"></i>
          </button>

        </div>

        <div className="sidebar-section-title">
          MENU PRINCIPAL
        </div>

        <nav className="sidebar-navigation">

          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`sidebar-link ${
                activeSection === item.id ? 'active' : ''
              }`}
              onClick={() => selectSection(item.id)}
            >
              <i className={`bi ${item.icon}`}></i>

              <span>{item.label}</span>

              {activeSection === item.id && (
                <i className="bi bi-chevron-right active-arrow"></i>
              )}
            </button>
          ))}

        </nav>

        <div className="sidebar-bottom">

          <div className="sidebar-user">

            <div className="user-avatar">
              {avatarInitial}
            </div>

            <div className="sidebar-user-info">
              <strong>{displayName}</strong>
              <span>{user.email}</span>
            </div>

          </div>

          <button
            className="sidebar-logout"
            onClick={onLogout}
          >
            <i className="bi bi-box-arrow-left"></i>
            Sair da conta
          </button>

        </div>

      </aside>

      <main className="dashboard-main">

        <header className="dashboard-header">

          <div className="header-left">

            <button
              className="mobile-menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <i className="bi bi-list"></i>
            </button>

            <div>
              <span className="header-overline">
                FINANCE GOLD / PAINEL
              </span>

              <h1>
                {menuItems.find(
                  (item) => item.id === activeSection
                )?.label}
              </h1>
            </div>

          </div>

          <div className="header-right">

            <div className="header-date">
              <i className="bi bi-calendar3"></i>
              {dateFormat.format(today)}
            </div>

            <div className="header-avatar">
              {avatarInitial}
            </div>

          </div>

        </header>

        {activeSection === 'dashboard' ? (

          <div className="dashboard-content">

            <div className="welcome-section">

              <div>
                <span className="header-overline">
                  VISÃO GERAL
                </span>

                <h2>Seu financeiro em foco.</h2>

                <p>
                  Acompanhe suas movimentações e seu desempenho financeiro.
                </p>
              </div>

              <div className="month-indicator">
                <i className="bi bi-calendar-month"></i>
                {monthName}
              </div>

            </div>

            {error && (
              <div className="dashboard-error">
                <i className="bi bi-exclamation-circle"></i>

                Não foi possível carregar os dados: {error}

                <button onClick={loadFinancialData}>
                  Tentar novamente
                </button>
              </div>
            )}

            <section className="financial-cards">

              <article className="financial-card balance-card">

                <div className="card-top">
                  <span>Saldo acumulado</span>

                  <div className="card-icon gold-icon">
                    <i className="bi bi-wallet2"></i>
                  </div>
                </div>

                <strong className="card-value">
                  {loading ? 'Carregando...' : currency.format(balance)}
                </strong>

                <span className="card-description">
                  Resultado de todas as movimentações
                </span>

              </article>

              <article className="financial-card">

                <div className="card-top">
                  <span>Receitas do mês</span>

                  <div className="card-icon income-icon">
                    <i className="bi bi-arrow-down-left"></i>
                  </div>
                </div>

                <strong className="card-value income-value">
                  {loading ? 'Carregando...' : currency.format(income)}
                </strong>

                <span className="card-description">
                  Entradas registradas neste mês
                </span>

              </article>

              <article className="financial-card">

                <div className="card-top">
                  <span>Despesas do mês</span>

                  <div className="card-icon expense-icon">
                    <i className="bi bi-arrow-up-right"></i>
                  </div>
                </div>

                <strong className="card-value expense-value">
                  {loading ? 'Carregando...' : currency.format(expenses)}
                </strong>

                <span className="card-description">
                  Saídas registradas neste mês
                </span>

              </article>

              <article className="financial-card">

                <div className="card-top">
                  <span>Resultado do mês</span>

                  <div className="card-icon result-icon">
                    <i className="bi bi-graph-up"></i>
                  </div>
                </div>

                <strong
                  className={`card-value ${
                    monthlyResult < 0 ? 'expense-value' : 'income-value'
                  }`}
                >
                  {loading ? 'Carregando...' : currency.format(monthlyResult)}
                </strong>

                <span className="card-description">
                  Receitas menos despesas
                </span>

              </article>

            </section>

            <section className="dashboard-panels">

              <article className="dashboard-panel chart-panel">

                <div className="panel-heading">

                  <div>
                    <span className="header-overline">
                      DESEMPENHO
                    </span>

                    <h3>Fluxo financeiro</h3>
                  </div>

                  <span className="panel-period">
                    Este mês
                  </span>

                </div>

                {loading ? (
                  <p className="empty-message">
                    Carregando informações...
                  </p>
                ) : (
                  <div className="comparison-chart">

                    <div className="chart-row">

                      <div className="chart-label">
                        <span>Receitas</span>
                        <strong>{currency.format(income)}</strong>
                      </div>

                      <div className="chart-track">
                        <div
                          className="chart-bar income-bar"
                          style={{
                            width: `${(income / maxValue) * 100}%`,
                          }}
                        />
                      </div>

                    </div>

                    <div className="chart-row">

                      <div className="chart-label">
                        <span>Despesas</span>
                        <strong>{currency.format(expenses)}</strong>
                      </div>

                      <div className="chart-track">
                        <div
                          className="chart-bar expense-bar"
                          style={{
                            width: `${(expenses / maxValue) * 100}%`,
                          }}
                        />
                      </div>

                    </div>

                    <div className="chart-legend">

                      <span>
                        <i className="legend-dot income-dot"></i>
                        Receitas
                      </span>

                      <span>
                        <i className="legend-dot expense-dot"></i>
                        Despesas
                      </span>

                    </div>

                  </div>
                )}

              </article>

              <article className="dashboard-panel">

                <div className="panel-heading">
                  <div>
                    <span className="header-overline">
                      RESUMO
                    </span>

                    <h3>Resultado mensal</h3>
                  </div>
                </div>

                <div className="monthly-result">

                  <span>Saldo do período</span>

                  <strong
                    className={
                      monthlyResult < 0
                        ? 'expense-value'
                        : 'income-value'
                    }
                  >
                    {loading ? '...' : currency.format(monthlyResult)}
                  </strong>

                  <p>
                    {monthlyResult >= 0
                      ? 'Suas receitas superaram suas despesas.'
                      : 'Suas despesas superaram suas receitas.'}
                  </p>

                </div>

              </article>

            </section>

            <section className="dashboard-panel transactions-panel">

              <div className="panel-heading">

                <div>
                  <span className="header-overline">
                    MOVIMENTAÇÕES
                  </span>

                  <h3>Últimas transações</h3>
                </div>

                <button
                  className="text-action"
                  onClick={() => selectSection('transacoes')}
                >
                  Ver todas <i className="bi bi-arrow-right"></i>
                </button>

              </div>

              {loading ? (
                <p className="empty-message">
                  Carregando transações...
                </p>
              ) : transactions.length === 0 ? (
                <div className="empty-state">
                  <i className="bi bi-receipt"></i>

                  <strong>Nenhuma movimentação encontrada</strong>

                  <span>
                    Suas receitas e despesas aparecerão aqui.
                  </span>
                </div>
              ) : (
                <div className="transaction-list">

                  {transactions.map((transaction) => (
                    <div
                      className="transaction-row"
                      key={transaction.id}
                    >

                      <div
                        className={`transaction-icon ${
                          transaction.type === 'income'
                            ? 'transaction-income'
                            : 'transaction-expense'
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

                      <div className="transaction-description">

                        <strong>{transaction.description}</strong>

                        <span>
                          {transaction.categoryName}
                          {' • '}
                          {dateFormat.format(
                            new Date(
                              `${transaction.transaction_date}T12:00:00`
                            )
                          )}
                        </span>

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

                    </div>
                  ))}

                </div>
              )}

            </section>

            <div className="dashboard-footer">
              FINANCE GOLD © 2026 — CONTROLE FINANCEIRO INTELIGENTE
            </div>

          </div>

        ) : activeSection === 'transacoes' ? (

          <Transacoes
            user={user}
            onTransactionChange={loadFinancialData}
          />

        ) : activeSection === 'receitas' ? (

          <Receitas
            user={user}
            onTransactionChange={loadFinancialData}
          />

        ) : activeSection === 'despesas' ? (

          <Despesas
            user={user}
            onTransactionChange={loadFinancialData}
          />

        ) : activeSection === 'categorias' ? (

          <Categorias user={user} />

        ) : activeSection === 'configuracoes' ? (

          <Configuracoes
            user={user}
            onLogout={onLogout}
          />

        ) : (

          <div className="dashboard-content">

            <section className="dashboard-panel coming-soon">

              <div className="coming-icon">
                <i
                  className={`bi ${
                    menuItems.find(
                      (item) => item.id === activeSection
                    )?.icon
                  }`}
                ></i>
              </div>

              <span className="header-overline">
                FINANCE GOLD
              </span>

              <h2>
                {menuItems.find(
                  (item) => item.id === activeSection
                )?.label}
              </h2>

              <p>
                Este módulo será desenvolvido na próxima etapa.
              </p>

              <button
                className="dashboard-back-button"
                onClick={() => selectSection('dashboard')}
              >
                Voltar ao Dashboard
              </button>

            </section>

          </div>

        )}

      </main>

    </div>
  )
}

export default Dashboard
