
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import './Configuracoes.css'

function Configuracoes({ user, onLogout }) {
  const [name, setName] = useState(user?.user_metadata?.name || '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [loadingPassword, setLoadingPassword] = useState(false)
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function clearFeedback() {
    setMessage('')
    setError('')
  }

  async function handleProfileSubmit(event) {
    event.preventDefault()
    clearFeedback()

    if (!name.trim()) {
      setError('Informe seu nome.')
      return
    }

    setLoadingProfile(true)

    const { error: updateError } = await supabase.auth.updateUser({
      data: { name: name.trim() },
    })

    setLoadingProfile(false)

    if (updateError) {
      setError('Não foi possível atualizar o perfil: ' + updateError.message)
      return
    }

    setMessage('Nome atualizado com sucesso!')
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault()
    clearFeedback()

    if (newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('A confirmação da senha não corresponde.')
      return
    }

    setLoadingPassword(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    setLoadingPassword(false)

    if (updateError) {
      setError('Não foi possível alterar a senha: ' + updateError.message)
      return
    }

    setNewPassword('')
    setConfirmPassword('')
    setMessage('Senha alterada com sucesso!')
  }

  async function handleDeleteAccount() {
    clearFeedback()

    if (deleteConfirmation !== 'EXCLUIR') {
      setError('Digite EXCLUIR para confirmar a exclusão da conta.')
      return
    }

    const confirmed = window.confirm(
      'Esta ação é permanente. Sua conta e seus dados serão excluídos. Deseja continuar?'
    )

    if (!confirmed) return

    setLoadingDelete(true)

    const { error: functionError } = await supabase.functions.invoke('delete-account')

    setLoadingDelete(false)

    if (functionError) {
      setError(
        'A exclusão segura ainda não está disponível. É necessário configurar a função delete-account no Supabase antes de usar esta opção.'
      )
      return
    }

    await onLogout()
  }

  return (
    <div className="dashboard-content configuracoes-page">

      <div className="welcome-section">
        <div>
          <span className="header-overline">PREFERÊNCIAS DA CONTA</span>
          <h2>Configurações.</h2>
          <p>Gerencie seus dados de perfil e a segurança da sua conta.</p>
        </div>
      </div>

      {error && (
        <div className="dashboard-error configuracoes-feedback">
          <i className="bi bi-exclamation-circle"></i>
          {error}
        </div>
      )}

      {message && (
        <div className="configuracoes-success">
          <i className="bi bi-check-circle"></i>
          {message}
        </div>
      )}

      <section className="dashboard-panel configuracoes-panel">
        <div className="panel-heading">
          <div>
            <span className="header-overline">DADOS PESSOAIS</span>
            <h3>Perfil</h3>
          </div>
          <i className="bi bi-person-circle configuracoes-panel-icon"></i>
        </div>

        <form className="configuracoes-form" onSubmit={handleProfileSubmit}>
          <div className="configuracoes-field">
            <label htmlFor="config-name">Nome</label>
            <input
              id="config-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Seu nome"
              maxLength={100}
              required
            />
          </div>

          <div className="configuracoes-field">
            <label htmlFor="config-email">E-mail da conta</label>
            <input
              id="config-email"
              type="email"
              value={user?.email || ''}
              readOnly
              disabled
            />
            <span className="configuracoes-hint">
              O e-mail é exibido aqui como identificação da conta.
            </span>
          </div>

          <button
            className="dashboard-back-button configuracoes-action"
            type="submit"
            disabled={loadingProfile}
          >
            {loadingProfile ? 'Salvando...' : 'Salvar perfil'}
          </button>
        </form>
      </section>

      <section className="dashboard-panel configuracoes-panel">
        <div className="panel-heading">
          <div>
            <span className="header-overline">PROTEÇÃO DA CONTA</span>
            <h3>Alterar senha</h3>
          </div>
          <i className="bi bi-shield-lock configuracoes-panel-icon"></i>
        </div>

        <form className="configuracoes-form" onSubmit={handlePasswordSubmit}>
          <div className="configuracoes-field">
            <label htmlFor="config-new-password">Nova senha</label>
            <input
              id="config-new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Digite a nova senha"
              minLength={6}
              required
            />
          </div>

          <div className="configuracoes-field">
            <label htmlFor="config-confirm-password">Confirmar nova senha</label>
            <input
              id="config-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Digite novamente a nova senha"
              minLength={6}
              required
            />
          </div>

          <button
            className="dashboard-back-button configuracoes-action"
            type="submit"
            disabled={loadingPassword}
          >
            {loadingPassword ? 'Atualizando...' : 'Alterar senha'}
          </button>
        </form>
      </section>

      <section className="dashboard-panel configuracoes-panel">
        <div className="panel-heading">
          <div>
            <span className="header-overline">SESSÃO</span>
            <h3>Acesso à conta</h3>
          </div>
          <i className="bi bi-box-arrow-right configuracoes-panel-icon"></i>
        </div>

        <p className="configuracoes-description">
          Encerre sua sessão neste dispositivo. Seus dados financeiros continuarão salvos.
        </p>

        <button
          className="dashboard-back-button configuracoes-action"
          type="button"
          onClick={onLogout}
        >
          <i className="bi bi-box-arrow-left"></i>
          Sair da conta
        </button>
      </section>

      <section className="dashboard-panel configuracoes-panel configuracoes-danger">
        <div className="panel-heading">
          <div>
            <span className="header-overline">AÇÃO PERMANENTE</span>
            <h3>Excluir conta</h3>
          </div>
          <i className="bi bi-exclamation-triangle configuracoes-danger-icon"></i>
        </div>

        <p className="configuracoes-description">
          A exclusão é permanente e remove a conta. Antes de disponibilizar esta ação,
          é necessário configurar uma função segura no Supabase, pois a chave administrativa
          nunca deve ficar no código do navegador.
        </p>

        <div className="configuracoes-field">
          <label htmlFor="config-delete-confirmation">
            Digite EXCLUIR para confirmar
          </label>
          <input
            id="config-delete-confirmation"
            type="text"
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
            placeholder="EXCLUIR"
            autoComplete="off"
          />
        </div>

        <button
          className="configuracoes-delete-button"
          type="button"
          onClick={handleDeleteAccount}
          disabled={loadingDelete || deleteConfirmation !== 'EXCLUIR'}
        >
          {loadingDelete ? 'Processando...' : 'Excluir minha conta'}
        </button>
      </section>

      <div className="dashboard-footer">
        FINANCE GOLD © 2026 — CONTROLE FINANCEIRO INTELIGENTE
      </div>

    </div>
  )
}

export default Configuracoes
