
import express from 'express'

import { supabaseAdmin } from '../config/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  encryptText,
  decryptText,
} from '../utils/encryption.js'

const router = express.Router()

router.use(authMiddleware)

const validTypes = ['income', 'expense']

// Converte os dados do banco para o formato utilizado pelo frontend.
// Registros antigos são lidos pelas colunas originais.
// Registros novos são descriptografados pelas colunas protegidas.
function normalizeTransaction(transaction) {
  const description = transaction.description_encrypted
    ? decryptText(transaction.description_encrypted)
    : transaction.description

  const amountValue = transaction.amount_encrypted
    ? decryptText(transaction.amount_encrypted)
    : transaction.amount

  const amount = Number(amountValue)

  if (
    typeof description !== 'string' ||
    !description ||
    !Number.isFinite(amount)
  ) {
    throw new Error('Não foi possível interpretar os dados da transação.')
  }

  const {
    description_encrypted,
    amount_encrypted,
    ...otherFields
  } = transaction

  return {
    ...otherFields,
    description,
    amount,
  }
}

// LISTAR TRANSAÇÕES
router.get('/', async (req, res) => {
  try {
    const { type, category_id, month, year } = req.query

    let query = supabaseAdmin
      .from('transactions')
      .select(`
        id,
        user_id,
        category_id,
        description,
        amount,
        description_encrypted,
        amount_encrypted,
        type,
        transaction_date,
        created_at,
        categories (
          id,
          name,
          type
        )
      `)
      .eq('user_id', req.user.id)
      .order('transaction_date', { ascending: false })

    if (type) {
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Tipo de transação inválido.',
        })
      }

      query = query.eq('type', type)
    }

    if (category_id) {
      const categoryId = Number(category_id)

      if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Categoria inválida.',
        })
      }

      query = query.eq('category_id', categoryId)
    }

    if (month !== undefined || year !== undefined) {
      const monthNumber = Number(month)
      const yearNumber = Number(year)

      if (
        !Number.isInteger(monthNumber) ||
        monthNumber < 1 ||
        monthNumber > 12 ||
        !Number.isInteger(yearNumber) ||
        yearNumber < 2000 ||
        yearNumber > 9999
      ) {
        return res.status(400).json({
          success: false,
          message: 'Informe mês e ano válidos.',
        })
      }

      const startDate =
        `${yearNumber}-${String(monthNumber).padStart(2, '0')}-01`

      const endDate = new Date(
        Date.UTC(yearNumber, monthNumber, 1)
      ).toISOString().slice(0, 10)

      query = query
        .gte('transaction_date', startDate)
        .lt('transaction_date', endDate)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao listar transações:', error.message)

      return res.status(500).json({
        success: false,
        message: 'Não foi possível carregar as transações.',
      })
    }

    const transactions = data.map(normalizeTransaction)

    return res.json({
      success: true,
      transactions,
    })
  } catch (error) {
    console.error('Erro ao processar transações:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Erro interno ao listar transações.',
    })
  }
})

// CADASTRAR TRANSAÇÃO
router.post('/', async (req, res) => {
  try {
    const {
      category_id,
      description,
      amount,
      type,
      transaction_date,
    } = req.body

    if (
      typeof description !== 'string' ||
      !description.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Informe a descrição da transação.',
      })
    }

    if (description.trim().length > 150) {
      return res.status(400).json({
        success: false,
        message: 'A descrição deve ter no máximo 150 caracteres.',
      })
    }

    const numericAmount = Number(amount)

    if (
      amount === undefined ||
      amount === null ||
      amount === '' ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Informe um valor maior que zero.',
      })
    }

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de transação inválido.',
      })
    }

    if (
      typeof transaction_date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(transaction_date)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Informe uma data válida no formato AAAA-MM-DD.',
      })
    }

    const date = new Date(
      `${transaction_date}T00:00:00.000Z`
    )

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== transaction_date
    ) {
      return res.status(400).json({
        success: false,
        message: 'A data informada não existe.',
      })
    }

    let validatedCategoryId = null

    if (
      category_id !== null &&
      category_id !== undefined &&
      category_id !== ''
    ) {
      validatedCategoryId = Number(category_id)

      if (
        !Number.isSafeInteger(validatedCategoryId) ||
        validatedCategoryId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'Categoria inválida.',
        })
      }

      const { data: category, error: categoryError } =
        await supabaseAdmin
          .from('categories')
          .select('id, type')
          .eq('id', validatedCategoryId)
          .eq('user_id', req.user.id)
          .maybeSingle()

      if (categoryError) {
        console.error(
          'Erro ao validar categoria:',
          categoryError.message
        )

        return res.status(500).json({
          success: false,
          message: 'Não foi possível validar a categoria.',
        })
      }

      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Categoria não encontrada para este usuário.',
        })
      }

      if (category.type !== type) {
        return res.status(400).json({
          success: false,
          message: 'A categoria não corresponde ao tipo da transação.',
        })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: req.user.id,
        category_id: validatedCategoryId,

        // Os campos originais não recebem os dados em texto simples.
        description: null,
        amount: null,

        // Novos dados são armazenados criptografados.
        description_encrypted: encryptText(description.trim()),
        amount_encrypted: encryptText(String(numericAmount)),

        type,
        transaction_date,
      })
      .select(`
        id,
        user_id,
        category_id,
        description,
        amount,
        description_encrypted,
        amount_encrypted,
        type,
        transaction_date,
        created_at
      `)
      .single()

    if (error) {
      console.error('Erro ao cadastrar transação:', error.message)

      return res.status(500).json({
        success: false,
        message: 'Não foi possível cadastrar a transação.',
      })
    }

    return res.status(201).json({
      success: true,
      message: 'Transação cadastrada com sucesso!',
      transaction: normalizeTransaction(data),
    })
  } catch (error) {
    console.error('Erro ao cadastrar transação:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Erro interno ao cadastrar transação.',
    })
  }
})

// EDITAR TRANSAÇÃO
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Identificador de transação inválido.',
      })
    }

    const {
      category_id,
      description,
      amount,
      type,
      transaction_date,
    } = req.body

    if (
      typeof description !== 'string' ||
      !description.trim() ||
      description.trim().length > 150
    ) {
      return res.status(400).json({
        success: false,
        message: 'Informe uma descrição válida de até 150 caracteres.',
      })
    }

    const numericAmount = Number(amount)

    if (
      amount === undefined ||
      amount === null ||
      amount === '' ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Informe um valor maior que zero.',
      })
    }

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de transação inválido.',
      })
    }

    if (
      typeof transaction_date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(transaction_date)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Informe uma data válida no formato AAAA-MM-DD.',
      })
    }

    const date = new Date(
      `${transaction_date}T00:00:00.000Z`
    )

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== transaction_date
    ) {
      return res.status(400).json({
        success: false,
        message: 'A data informada não existe.',
      })
    }

    let validatedCategoryId = null

    if (
      category_id !== null &&
      category_id !== undefined &&
      category_id !== ''
    ) {
      validatedCategoryId = Number(category_id)

      if (
        !Number.isSafeInteger(validatedCategoryId) ||
        validatedCategoryId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'Categoria inválida.',
        })
      }

      const { data: category, error: categoryError } =
        await supabaseAdmin
          .from('categories')
          .select('id, type')
          .eq('id', validatedCategoryId)
          .eq('user_id', req.user.id)
          .maybeSingle()

      if (categoryError) {
        console.error(
          'Erro ao validar categoria:',
          categoryError.message
        )

        return res.status(500).json({
          success: false,
          message: 'Não foi possível validar a categoria.',
        })
      }

      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Categoria não encontrada para este usuário.',
        })
      }

      if (category.type !== type) {
        return res.status(400).json({
          success: false,
          message: 'A categoria não corresponde ao tipo da transação.',
        })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .update({
        category_id: validatedCategoryId,

        // Remove os valores em texto simples ao editar.
        description: null,
        amount: null,

        description_encrypted: encryptText(description.trim()),
        amount_encrypted: encryptText(String(numericAmount)),

        type,
        transaction_date,
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select(`
        id,
        user_id,
        category_id,
        description,
        amount,
        description_encrypted,
        amount_encrypted,
        type,
        transaction_date,
        created_at
      `)
      .maybeSingle()

    if (error) {
      console.error('Erro ao editar transação:', error.message)

      return res.status(500).json({
        success: false,
        message: 'Não foi possível editar a transação.',
      })
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Transação não encontrada.',
      })
    }

    return res.json({
      success: true,
      message: 'Transação atualizada com sucesso!',
      transaction: normalizeTransaction(data),
    })
  } catch (error) {
    console.error('Erro ao editar transação:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Erro interno ao editar transação.',
    })
  }
})

// EXCLUIR TRANSAÇÃO
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Identificador de transação inválido.',
      })
    }

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Erro ao excluir transação:', error.message)

      return res.status(500).json({
        success: false,
        message: 'Não foi possível excluir a transação.',
      })
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Transação não encontrada.',
      })
    }

    return res.json({
      success: true,
      message: 'Transação excluída com sucesso!',
    })
  } catch (error) {
    console.error('Erro ao excluir transação:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Erro interno ao excluir transação.',
    })
  }
})

export default router
