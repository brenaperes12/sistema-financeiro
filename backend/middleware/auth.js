
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

export async function authMiddleware(req, res, next) {
  try {
    const authorization = req.headers.authorization

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária.',
      })
    }

    const token = authorization.replace('Bearer ', '').trim()

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token não informado.',
      })
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY

    if (!supabaseUrl || !publishableKey) {
      console.error('Configuração de autenticação incompleta.')

      return res.status(500).json({
        success: false,
        message: 'Configuração do servidor incompleta.',
      })
    }

    
    const supabaseUser = createClient(
      supabaseUrl,
      publishableKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    
    const { data, error } = await supabaseUser.auth.getUser(token)

    if (error || !data.user) {
      return res.status(401).json({
        success: false,
        message: 'Sessão inválida ou expirada.',
      })
    }

    req.user = data.user
    req.supabase = supabaseUser

    next()
  } catch (error) {
    console.error('Erro na autenticação:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar autenticação.',
    })
  }
}
