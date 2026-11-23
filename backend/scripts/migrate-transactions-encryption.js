
import { supabaseAdmin } from '../config/supabase.js'
import {
  encryptText,
  decryptText,
} from '../utils/encryption.js'

async function migrateTransactions() {
  console.log('Iniciando migração das transações...\n')

  // Busca os registros sem alterar nenhum dado.
  const { data: transactions, error } = await supabaseAdmin
    .from('transactions')
    .select(`
      id,
      user_id,
      description,
      amount,
      description_encrypted,
      amount_encrypted
    `)

  if (error) {
    throw new Error(
      `Erro ao consultar transações: ${error.message}`
    )
  }

  let migrated = 0
  let alreadyEncrypted = 0

  for (const transaction of transactions) {
    const {
      id,
      user_id,
      description,
      amount,
      description_encrypted,
      amount_encrypted,
    } = transaction

    const updateData = {}

    // Criptografa a descrição somente se ainda não existir
    // uma versão criptografada.
    if (!description_encrypted) {
      if (typeof description !== 'string') {
        throw new Error(
          `Transação ${id}: descrição original indisponível.`
        )
      }

      const encryptedDescription = encryptText(description)

      if (decryptText(encryptedDescription) !== description) {
        throw new Error(
          `Transação ${id}: falha na validação da descrição.`
        )
      }

      updateData.description_encrypted = encryptedDescription
    }

    // Criptografa o valor somente se ainda não existir
    // uma versão criptografada.
    if (!amount_encrypted) {
      if (amount === null || amount === undefined) {
        throw new Error(
          `Transação ${id}: valor original indisponível.`
        )
      }

      const originalAmount = String(amount)
      const encryptedAmount = encryptText(originalAmount)

      if (decryptText(encryptedAmount) !== originalAmount) {
        throw new Error(
          `Transação ${id}: falha na validação do valor.`
        )
      }

      updateData.amount_encrypted = encryptedAmount
    }

    // Se os dois campos já estiverem criptografados,
    // não precisamos atualizar esse registro.
    if (Object.keys(updateData).length === 0) {
      alreadyEncrypted++
      continue
    }

    // Atualiza somente as colunas criptografadas.
    // Os dados originais permanecem intactos.
    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user_id)

    if (updateError) {
      throw new Error(
        `Erro ao migrar transação ${id}: ${updateError.message}`
      )
    }

    // Confere o que realmente foi salvo no banco.
    const { data: savedTransaction, error: verifyError } =
      await supabaseAdmin
        .from('transactions')
        .select(`
          description,
          amount,
          description_encrypted,
          amount_encrypted
        `)
        .eq('id', id)
        .eq('user_id', user_id)
        .single()

    if (verifyError) {
      throw new Error(
        `Erro ao verificar transação ${id}: ${verifyError.message}`
      )
    }

    if (
      decryptText(savedTransaction.description_encrypted) !==
        String(savedTransaction.description) ||
      decryptText(savedTransaction.amount_encrypted) !==
        String(savedTransaction.amount)
    ) {
      throw new Error(
        `Transação ${id}: os dados salvos não passaram na verificação.`
      )
    }

    migrated++

    console.log(`Transação ${id}: migrada e verificada.`)
  }

  console.log('\nMigração concluída!')
  console.log(`Registros migrados: ${migrated}`)
  console.log(`Registros já criptografados: ${alreadyEncrypted}`)
  console.log(`Total analisado: ${transactions.length}`)
  console.log('\nOs dados originais foram preservados.')
}

migrateTransactions().catch((error) => {
  console.error('\nA migração foi interrompida.')
  console.error(error.message)
  process.exitCode = 1
})
