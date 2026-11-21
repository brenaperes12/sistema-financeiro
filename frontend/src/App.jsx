
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Dashboard from './components/Dashboard'

function App() {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [user, setUser] = useState(null)

  // Verificar sessão e acompanhar autenticação
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Alternar entre login e cadastro
  function changeMode(newMode) {
    setMode(newMode)
    setMessage('')
    setError('')
    setPassword('')
  }

  // Login e cadastro
  async function handleSubmit(event) {
    event.preventDefault()

    setError('')
    setMessage('')

    if (!email.trim() || !password) {
      setError('Preencha o e-mail e a senha.')
      return
    }

    if (mode === 'register' && !name.trim()) {
      setError('Informe seu nome.')
      return
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setLoading(true)

    try {
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            // Redireciona para o endereço atual do Finance Gold.
            // Na produção, será o domínio da Vercel.
            emailRedirectTo: window.location.origin,
            data: {
              name: name.trim(),
            },
          },
        })

        if (error) throw error

        if (data.session) {
          setMessage(
            'Conta criada com sucesso! Você já pode acessar o sistema.'
          )
        } else {
          setMessage(
            'Cadastro realizado! Confira seu e-mail e clique no link de confirmação para ativar sua conta.'
          )

          setMode('login')
          setPassword('')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (error) throw error

        setMessage('Login realizado com sucesso!')
      }
    } catch (err) {
      const errorMessages = {
        'Invalid login credentials': 'E-mail ou senha incorretos.',
        'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
        'User already registered': 'Este e-mail já possui uma conta.',
        'Password should be at least 6 characters':
          'A senha deve ter pelo menos 6 caracteres.',
      }

      setError(errorMessages[err.message] || err.message)
    } finally {
      setLoading(false)
    }
  }

  // Encerrar sessão
  async function handleLogout() {
    setLoading(true)

    const { error } = await supabase.auth.signOut()

    if (error) {
      setError(error.message)
    } else {
      setMessage('Você saiu da sua conta.')
      setPassword('')
    }

    setLoading(false)
  }

  // Se existir usuário autenticado, mostrar Dashboard
  if (user) {
    return (
      <Dashboard
        user={user}
        onLogout={handleLogout}
      />
    )
  }

  // Página de login e cadastro
  return (
    <main className="premium-page">
      <div className="login-layout">

        {/* PAINEL DA MARCA */}
        <section className="brand-panel">

          <div className="brand-top">
            <div className="brand-symbol">
              <i className="bi bi-gem"></i>
            </div>

            <span>FINANCE GOLD</span>
          </div>

          <div className="brand-content">

            <span className="eyebrow">
              CONTROLE • ORGANIZAÇÃO • LIBERDADE
            </span>

            <h1>
              Seu dinheiro,
              <br />
              suas <span>conquistas.</span>
            </h1>

            <p>
              Tenha uma visão mais inteligente da sua vida financeira.
              Organize suas receitas, acompanhe suas despesas e
              mantenha seus objetivos sempre em foco.
            </p>

            <div className="brand-features">

              <div>
                <i className="bi bi-shield-check"></i>
                <span>Seus dados protegidos</span>
              </div>

              <div>
                <i className="bi bi-graph-up-arrow"></i>
                <span>Controle financeiro simplificado</span>
              </div>

            </div>
          </div>

          <div className="brand-footer">
            FINANCE GOLD © 2026
          </div>

        </section>

        {/* PAINEL DE LOGIN */}
        <section className="form-panel">

          <div className="mobile-brand">
            <i className="bi bi-gem"></i>
            FINANCE GOLD
          </div>

          <div className="form-container">

            <div className="form-heading">

              <span className="eyebrow">
                ÁREA DO CLIENTE
              </span>

              <h2>
                {mode === 'login'
                  ? 'Bem-vindo de volta.'
                  : 'Crie sua conta.'}
              </h2>

              <p>
                {mode === 'login'
                  ? 'Entre para acessar seu controle financeiro.'
                  : 'Comece a organizar sua vida financeira.'}
              </p>

            </div>

            {/* ABAS */}
            <div className="form-tabs">

              <button
                type="button"
                className={mode === 'login' ? 'active' : ''}
                onClick={() => changeMode('login')}
              >
                Entrar
              </button>

              <button
                type="button"
                className={mode === 'register' ? 'active' : ''}
                onClick={() => changeMode('register')}
              >
                Criar conta
              </button>

            </div>

            {/* FORMULÁRIO */}
            <form onSubmit={handleSubmit}>

              {/* NOME */}
              {mode === 'register' && (
                <div className="field-group">

                  <label htmlFor="name">
                    Nome completo
                  </label>

                  <div className="input-wrapper">

                    <i className="bi bi-person"></i>

                    <input
                      id="name"
                      type="text"
                      placeholder="Digite seu nome"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      required
                    />

                  </div>
                </div>
              )}

              {/* E-MAIL */}
              <div className="field-group">

                <label htmlFor="email">
                  E-mail
                </label>

                <div className="input-wrapper">

                  <i className="bi bi-envelope"></i>

                  <input
                    id="email"
                    type="email"
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />

                </div>
              </div>

              {/* SENHA */}
              <div className="field-group">

                <label htmlFor="password">
                  Senha
                </label>

                <div className="input-wrapper">

                  <i className="bi bi-lock"></i>

                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={
                      mode === 'login'
                        ? 'current-password'
                        : 'new-password'
                    }
                    minLength={6}
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword
                        ? 'Ocultar senha'
                        : 'Mostrar senha'
                    }
                  >
                    <i
                      className={`bi ${
                        showPassword
                          ? 'bi-eye-slash'
                          : 'bi-eye'
                      }`}
                    ></i>
                  </button>

                </div>
              </div>

              {/* PROTEÇÃO DE ACESSO */}
              {mode === 'login' && (
                <div className="form-options">
                  <span>Proteção de acesso</span>
                  <i className="bi bi-shield-lock"></i>
                </div>
              )}

              {/* MENSAGEM DE ERRO */}
              {error && (
                <div className="feedback error-feedback">

                  <i className="bi bi-exclamation-circle"></i>

                  {error}

                </div>
              )}

              {/* MENSAGEM DE SUCESSO */}
              {message && (
                <div className="feedback success-feedback">

                  <i className="bi bi-check-circle"></i>

                  {message}

                </div>
              )}

              {/* BOTÃO DE ENVIO */}
              <button
                type="submit"
                className="gold-button"
                disabled={loading}
              >
                {loading
                  ? 'Aguarde...'
                  : mode === 'login'
                    ? 'Entrar na minha conta'
                    : 'Criar minha conta'}

                {!loading && (
                  <i className="bi bi-arrow-right"></i>
                )}

              </button>

            </form>

            <div className="form-bottom">

              <i className="bi bi-shield-lock"></i>

              Seus dados são protegidos e armazenados com segurança.

            </div>

          </div>

          <div className="copyright">
            © 2026 Finance Gold. Todos os direitos reservados.
          </div>

        </section>

      </div>
    </main>
  )
}

export default App
