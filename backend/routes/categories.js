
import express from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

router.use(authMiddleware)


const validTypes = ['income', 'expense']


router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('id, name, type, created_at')
      .eq('user_id', req.user.id)
      .order('name', { ascending: true })

    if (error) {
      console.error('Erro ao listar categorias:', error.message)

      return res.status(500).json({
        success: false,
        message: 'Não foi possível carregar as categorias.',
      })
    }

    return res.json({
      success: true,
      categories: data,
    })
  } catch (error) {
    console.error('Erro inesperado:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Erro interno ao listar categorias.',
    })
  }
})


router.post('/', async (req, res) => {
  try {
    const { name, type } = req.body

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Informe o nome da categoria.',
      })
    }

    if (name.trim().length > 80) {
      return res.status(400).json({
        success: false,
        message: 'O nome deve ter no máximo 80 caracteres.',
      })
    }

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de categoria inválido.',
      })
    }

    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({
        user_id: req.user.id,
        name: name.trim(),
        type,
      })
      .select('id, name, type, created_at')
      .single()

    if (error) {
      console.error('Erro ao cadastrar categoria:', error.message)

      return res.status(500).json({
        success: false,
        message: 'Não foi possível cadastrar a categoria.',
      })
    }

    return res.status(201).json({
      success: true,
      message: 'Categoria cadastrada com sucesso!',
      category: data,
    })
  } catch (error) {
    console.error('Erro inesperado:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Erro interno ao cadastrar categoria.',
    })
  }
})


router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { name, type } = req.body

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Identificador de categoria inválido.',
      })
    }

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Informe o nome da categoria.',
      })
    }

    if (name.trim().length > 80) {
      return res.status(400).json({
        success: false,
        message: 'O nome deve ter no máximo 80 caracteres.',
      })
    }

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de categoria inválido.',
      })
    }

    const { data, error } = await supabaseAdmin
      .from('categories')
      .update({
        name: name.trim(),
        type,
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select('id, name, type, created_at')
      .maybeSingle()

    if (error) {
      console.error('Erro ao editar categoria:', error.message)

      return res.status(500).json({
        success: false,
        message: 'Não foi possível editar a categoria.',
      })
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Categoria não encontrada.',
      })
    }

    return res.json({
      success: true,
      message: 'Categoria atualizada com sucesso!',
      category: data,
    })
  } catch (error) {
    console.error('Erro inesperado:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Erro interno ao editar categoria.',
    })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Identificador de categoria inválido.',
      })
    }

    const { data, error } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Erro ao excluir categoria:', error.message)

      return res.status(500).json({
        success: false,
        message: 'Não foi possível excluir a categoria.',
      })
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Categoria não encontrada.',
      })
    }

    return res.json({
      success: true,
      message: 'Categoria excluída com sucesso!',
    })
  } catch (error) {
    console.error('Erro inesperado:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Erro interno ao excluir categoria.',
    })
  }
})

export default router
