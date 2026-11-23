
import express from 'express'
import cors from 'cors'
import 'dotenv/config'

import { supabaseAdmin } from './config/supabase.js'
import { authMiddleware } from './middleware/auth.js'

import categoriesRoutes from './routes/categories.js'
import transactionsRoutes from './routes/transactions.js'

const app = express()
const PORT = process.env.PORT || 3001

// Origens autorizadas
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
].filter(Boolean)

// Configuração do CORS
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true)
    }

    return callback(
      new Error(`Origem não permitida pelo CORS: ${origin}`)
    )
  },
}))

app.use(express.json())

// Rota inicial
app.get('/', (req, res) => {
  res.json({
    application: 'Finance Gold API',
    message: 'Backend funcionando corretamente!',
    status: 'online',
  })
})

// Verificação do servidor
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API Finance Gold está funcionando!',
    timestamp: new Date().toISOString(),
  })
})

// Verificação da conexão com Supabase
app.get('/api/health/database', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .select('id', { head: true, count: 'exact' })
      .limit(1)

    if (error) {
      console.error('Erro no Supabase:', error.message)

      return res.status(500).json({
        success: false,
        message: 'Não foi possível consultar o banco de dados.',
      })
    }

    return res.json({
      success: true,
      message: 'Conexão com Supabase estabelecida!',
      database: 'online',
    })
  } catch (error) {
    console.error('Erro inesperado:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Erro inesperado ao conectar com o banco.',
    })
  }
})

// Identificar usuário autenticado
app.get('/api/auth/me', authMiddleware, (req, res) => {
  return res.json({
    success: true,
    message: 'Usuário autenticado com sucesso!',
    user: {
      id: req.user.id,
      email: req.user.email,
    },
  })
})

// Rotas de categorias
app.use('/api/categories', categoriesRoutes)

// Rotas de transações
app.use('/api/transactions', transactionsRoutes)

// Rotas inexistentes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada.',
  })
})

// Iniciar servidor local
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Finance Gold API rodando na porta ${PORT}`)
    console.log(`Acesse: http://localhost:${PORT}`)
  })
}

export default app
