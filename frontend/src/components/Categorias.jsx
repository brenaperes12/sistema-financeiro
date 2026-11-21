
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './Categorias.css'

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3001'
).replace(/\/$/, '')

function Categorias({ user }) {
  const [categories, setCategories] = useState([])
  const [name, setName] = useState('')
  const [type, setType] = useState('expense')
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // Obtém o token da sessão autenticada
  async function getAuthHeaders(includeContentType = false) {
    const { data, error: sessionError } =
      await supabase.auth.getSession()

    if (sessionError) {
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

  // Carrega as categorias pela API
  useEffect(() => {
    if (user?.id) {
      loadCategories()
    }
  }, [user?.id])

  async function loadCategories() {
    setLoading(true)
    setError('')

    try {
      const headers = await getAuthHeaders()

      const response = await fetch(
        `${API_URL}/api/categories`,
        { headers }
      )

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Não foi possível carregar as categorias.'
        )
      }

      setCategories(result.categories || [])
    } catch (err) {
      setError('Não foi possível carregar as categorias: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const categoryName = name.trim()

    if (!categoryName) {
      setError('Informe o nome da categoria.')
      return
    }

    if (!type) {
      setError('Selecione o tipo da categoria.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    try {
      const headers = await getAuthHeaders(true)

      const url = editingId
        ? `${API_URL}/api/categories/${editingId}`
        : `${API_URL}/api/categories`

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify({
          name: categoryName,
          type,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Não foi possível salvar a categoria.'
        )
      }

      setMessage(
        editingId
          ? 'Categoria atualizada com sucesso!'
          : 'Categoria cadastrada com sucesso!'
      )

      setName('')
      setType('expense')
      setEditingId(null)

      await loadCategories()
    } catch (err) {
      setError('Erro ao salvar categoria: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(category) {
    setName(category.name)
    setType(category.type)
    setEditingId(category.id)
    setError('')
    setMessage('')

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setName('')
    setType('expense')
    setEditingId(null)
    setError('')
    setMessage('')
  }

  async function handleDelete(id) {
    const confirmed = window.confirm(
      'Deseja realmente excluir esta categoria?'
    )

    if (!confirmed) return

    setError('')
    setMessage('')

    try {
      const headers = await getAuthHeaders()

      const response = await fetch(
        `${API_URL}/api/categories/${id}`,
        {
          method: 'DELETE',
          headers,
        }
      )

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Não foi possível excluir a categoria.'
        )
      }

      if (editingId === id) {
        cancelEdit()
      }

      setMessage('Categoria excluída com sucesso!')
      await loadCategories()
    } catch (err) {
      setError('Não foi possível excluir: ' + err.message)
    }
  }

  function getTypeLabel(categoryType) {
    return categoryType === 'income' ? 'Receita' : 'Despesa'
  }

  return (
    <div className="dashboard-content categories-page">

      <div className="welcome-section">
        <div>
          <span className="header-overline">
            ORGANIZAÇÃO FINANCEIRA
          </span>

          <h2>Gerenciar categorias.</h2>

          <p>
            Organize suas movimentações financeiras por categorias.
          </p>
        </div>

        <div className="month-indicator">
          <i className="bi bi-tags"></i>
          {categories.length} categorias
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

      <div className="categories-grid">

        <section className="dashboard-panel category-form-panel">

          <div className="panel-heading">
            <div>
              <span className="header-overline">
                {editingId ? 'EDIÇÃO' : 'NOVO CADASTRO'}
              </span>

              <h3>
                {editingId ? 'Editar categoria' : 'Nova categoria'}
              </h3>
            </div>

            <div className="category-heading-icon">
              <i className="bi bi-tag"></i>
            </div>
          </div>

          <form onSubmit={handleSubmit}>

            <div className="category-field">
              <label htmlFor="categoryName">
                Nome da categoria
              </label>

              <div className="category-input-wrapper">
                <i className="bi bi-bookmark"></i>

                <input
                  id="categoryName"
                  type="text"
                  placeholder="Ex.: Alimentação, Transporte..."
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={60}
                  required
                />
              </div>
            </div>

            <div className="category-field">
              <label htmlFor="categoryType">
                Tipo da categoria
              </label>

              <div className="category-input-wrapper">
                <i className="bi bi-arrow-left-right"></i>

                <select
                  id="categoryType"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  required
                  style={{
                    width: '100%',
                    height: '100%',
                    minHeight: '46px',
                    background: 'transparent',
                    color: '#ffffff',
                    border: 'none',
                    outline: 'none',
                    padding: '0 12px',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  <option value="expense" style={{ color: '#111' }}>
                    Despesa
                  </option>

                  <option value="income" style={{ color: '#111' }}>
                    Receita
                  </option>
                </select>
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
                  : 'Cadastrar categoria'}
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

        <section className="dashboard-panel category-list-panel">

          <div className="panel-heading">
            <div>
              <span className="header-overline">
                SUAS CATEGORIAS
              </span>

              <h3>Categorias cadastradas</h3>
            </div>

            <div className="category-count">
              {categories.length}
            </div>
          </div>

          {loading ? (
            <div className="category-empty">
              <i className="bi bi-arrow-repeat"></i>
              Carregando categorias...
            </div>
          ) : categories.length === 0 ? (
            <div className="category-empty">
              <i className="bi bi-tags"></i>

              <strong>Nenhuma categoria cadastrada</strong>

              <span>
                Comece adicionando sua primeira categoria.
              </span>
            </div>
          ) : (
            <div className="category-list">

              {categories.map((category) => (
                <div
                  className="category-item"
                  key={category.id}
                >

                  <div className="category-item-icon">
                    <i className="bi bi-tag"></i>
                  </div>

                  <div className="category-item-info">
                    <strong>{category.name}</strong>
                    <span>{getTypeLabel(category.type)}</span>
                  </div>

                  <div className="category-actions">

                    <button
                      type="button"
                      title="Editar categoria"
                      onClick={() => handleEdit(category)}
                    >
                      <i className="bi bi-pencil-square"></i>
                    </button>

                    <button
                      type="button"
                      title="Excluir categoria"
                      className="category-delete"
                      onClick={() => handleDelete(category.id)}
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

export default Categorias
