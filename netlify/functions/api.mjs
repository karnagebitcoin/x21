import { connectLambda, getStore } from '@netlify/blobs'
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { Invoice } from '@getalby/lightning-tools'
import { SimplePool, finalizeEvent, getPublicKey, kinds, nip19, verifyEvent } from 'nostr-tools'

let usersStore
let apiKeyStore
let transactionStore
let translationCacheStore
let adminConfigStore
let adminAuditStore

const TRANSLATION_LIGHTNING_ADDRESS =
  process.env.TRANSLATION_LIGHTNING_ADDRESS || 'translation@katvibes.com'
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
const TRANSLATION_ADMIN_TOKEN = process.env.TRANSLATION_ADMIN_TOKEN || ''
const OPENROUTER_MODEL =
  process.env.OPENROUTER_TRANSLATION_MODEL || 'google/gemini-2.0-flash-001'
const TRANSLATION_RECEIPT_NSEC = process.env.TRANSLATION_RECEIPT_NSEC || ''
const TRANSLATION_RECEIPT_EVENT_KIND = toSafeInt(
  process.env.TRANSLATION_RECEIPT_EVENT_KIND,
  15750,
  10_000,
  39_999
)
const TRANSLATION_RECEIPT_RELAYS = parseRelayList(
  process.env.TRANSLATION_RECEIPT_RELAYS,
  ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://relay.nostr.band']
)

const MODEL_INPUT_RATE_USD_PER_M = toPositiveNumber(
  process.env.TRANSLATION_INPUT_RATE_USD_PER_M,
  0.1
)
const MODEL_OUTPUT_RATE_USD_PER_M = toPositiveNumber(
  process.env.TRANSLATION_OUTPUT_RATE_USD_PER_M,
  0.4
)
const CHARS_PER_TOKEN = toPositiveNumber(process.env.TRANSLATION_CHARS_PER_TOKEN, 4)

const LEGACY_CHARS_PER_SAT = toPositiveNumber(process.env.TRANSLATION_LEGACY_CHARS_PER_SAT, 100)
const BASELINE_BTC_USD = toPositiveNumber(process.env.TRANSLATION_BASELINE_BTC_USD, 65000)
const BTC_USD_FALLBACK = toPositiveNumber(process.env.BTC_USD_FALLBACK, BASELINE_BTC_USD)
const BTC_PRICE_TTL_MS = 5 * 60 * 1000

const TRANSLATION_MAX_CHARS_PER_REQUEST = toPositiveNumber(
  process.env.TRANSLATION_MAX_CHARS_PER_REQUEST,
  12000
)

const PACKAGE_CHARACTERS = [100_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000]

let btcUsdCache = {
  fetchedAt: 0,
  value: BTC_USD_FALLBACK,
  source: 'fallback'
}

let openRouterKeyCache = {
  fetchedAt: 0,
  key: null,
  source: 'none',
  updatedAt: null
}
const OPENROUTER_KEY_CACHE_TTL_MS = 30 * 1000
const OPENROUTER_STATUS_CACHE_TTL_MS = 60 * 1000
let openRouterStatusCache = {
  fetchedAt: 0,
  keyHash: '',
  status: {
    state: 'unknown',
    message: 'Not checked yet',
    checkedAt: 0,
    remainingCredits: null,
    totalCredits: null,
    totalUsage: null
  }
}

const headers = {
  'Content-Type': 'application/json'
}

function refreshBlobStoresForRequest(request) {
  const blobsToken = request && typeof request.blobs === 'string' ? request.blobs : ''
  if (blobsToken) {
    const lambdaHeaders = {}
    if (request.headers && typeof request.headers.forEach === 'function') {
      request.headers.forEach((value, key) => {
        lambdaHeaders[key] = value
      })
    } else if (request.headers && typeof request.headers === 'object') {
      for (const [key, value] of Object.entries(request.headers)) {
        if (typeof value === 'string') lambdaHeaders[key] = value
      }
    }

    connectLambda({
      blobs: blobsToken,
      headers: lambdaHeaders
    })
  }

  // Important: stores must be created per request so they don't keep an expired blobs token
  // from a warm function instance.
  usersStore = getStore('translation-users')
  apiKeyStore = getStore('translation-api-keys')
  transactionStore = getStore('translation-transactions')
  translationCacheStore = getStore('translation-cache')
  adminConfigStore = getStore('translation-admin-config')
  adminAuditStore = getStore('translation-admin-audit')
}

export default async (request) => {
  try {
    refreshBlobStoresForRequest(request)

    const route = extractRoute(request.url)
    if (!route.startsWith('/v1/')) {
      return json(404, { error: 'Not found' })
    }

    if (request.method === 'GET' && route === '/v1/transactions/quote') {
      const quote = await buildTopUpQuote()
      return json(200, quote)
    }

    if (request.method === 'GET' && route === '/v1/admin/translation/config') {
      assertAdminRequest(request)
      const keyState = await resolveOpenRouterKey()
      const keyStatus = await getOpenRouterKeyStatus(keyState)
      const receiptPublisher = getReceiptPublisherStatus()
      return json(200, {
        model: OPENROUTER_MODEL,
        openrouterKey: {
          configured: Boolean(keyState.key),
          masked: maskSecret(keyState.key),
          source: keyState.source,
          updatedAt: keyState.updatedAt
        },
        openrouterStatus: keyStatus,
        receiptPublisher: {
          configured: receiptPublisher.configured,
          pubkey: receiptPublisher.pubkey,
          relayCount: TRANSLATION_RECEIPT_RELAYS.length,
          eventKind: TRANSLATION_RECEIPT_EVENT_KIND
        }
      })
    }

    if (request.method === 'GET' && route === '/v1/admin/translation/transactions') {
      assertAdminRequest(request)
      const url = new URL(request.url)
      const state = url.searchParams.get('state') || ''
      const pubkey = url.searchParams.get('pubkey') || ''
      const limit = toSafeInt(url.searchParams.get('limit'), 100, 1, 500)
      const data = await listTransactionsForAdmin({ state, pubkey, limit })
      return json(200, data)
    }

    if (request.method === 'GET' && route === '/v1/admin/translation/users') {
      assertAdminRequest(request)
      const url = new URL(request.url)
      const query = (url.searchParams.get('q') || '').toLowerCase().trim()
      const limit = toSafeInt(url.searchParams.get('limit'), 100, 1, 500)
      const data = await listUsersForAdmin({ query, limit })
      return json(200, data)
    }

    const txReconcileMatch = route.match(
      /^\/v1\/admin\/translation\/transactions\/([^/]+)\/reconcile$/
    )
    if (request.method === 'POST' && txReconcileMatch) {
      assertAdminRequest(request)
      const transactionId = txReconcileMatch[1]
      const body = await parseJson(request)
      const result = await adminReconcileTransaction(transactionId, body)
      return json(200, result)
    }

    const txSettleMatch = route.match(/^\/v1\/admin\/translation\/transactions\/([^/]+)\/settle$/)
    if (request.method === 'POST' && txSettleMatch) {
      assertAdminRequest(request)
      const transactionId = txSettleMatch[1]
      const body = await parseJson(request)
      const result = await adminForceSettleTransaction(transactionId, body)
      return json(200, result)
    }

    const txPublishReceiptMatch = route.match(
      /^\/v1\/admin\/translation\/transactions\/([^/]+)\/publish-receipt$/
    )
    if (request.method === 'POST' && txPublishReceiptMatch) {
      assertAdminRequest(request)
      const transactionId = txPublishReceiptMatch[1]
      const result = await adminPublishTransactionReceipt(transactionId)
      return json(200, result)
    }

    const userReissueMatch = route.match(
      /^\/v1\/admin\/translation\/users\/([0-9a-fA-F]{64})\/reissue-api-key$/
    )
    if (request.method === 'POST' && userReissueMatch) {
      assertAdminRequest(request)
      const userPubkey = userReissueMatch[1].toLowerCase()
      const result = await adminReissueApiKey(userPubkey)
      return json(200, result)
    }

    const userAdjustMatch = route.match(
      /^\/v1\/admin\/translation\/users\/([0-9a-fA-F]{64})\/adjust$/
    )
    if (request.method === 'POST' && userAdjustMatch) {
      assertAdminRequest(request)
      const userPubkey = userAdjustMatch[1].toLowerCase()
      const body = await parseJson(request)
      const result = await adminAdjustUser(userPubkey, body)
      return json(200, result)
    }

    const userDeleteMatch = route.match(
      /^\/v1\/admin\/translation\/users\/([0-9a-fA-F]{64})$/
    )
    if (request.method === 'DELETE' && userDeleteMatch) {
      assertAdminRequest(request)
      const userPubkey = userDeleteMatch[1].toLowerCase()
      const result = await adminDeleteUser(userPubkey)
      return json(200, result)
    }

    if (request.method === 'POST' && route === '/v1/admin/translation/openrouter-key') {
      assertAdminRequest(request)
      const body = await parseJson(request)
      const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : ''
      if (!apiKey) {
        return json(400, { error: 'Missing OpenRouter API key' })
      }
      if (apiKey.length < 12) {
        return json(400, { error: 'OpenRouter API key looks invalid' })
      }

      await adminConfigStore.setJSON('openrouter', {
        apiKey,
        updatedAt: Date.now()
      })
      invalidateOpenRouterCache()

      const nextState = await resolveOpenRouterKey()
      return json(200, {
        ok: true,
        openrouterKey: {
          configured: Boolean(nextState.key),
          masked: maskSecret(nextState.key),
          source: nextState.source,
          updatedAt: nextState.updatedAt
        }
      })
    }

    if (request.method === 'POST' && route === '/v1/transactions') {
      const body = await parseJson(request)
      return await createTransaction(request, body)
    }

    if (request.method === 'POST' && route.startsWith('/v1/transactions/') && route.endsWith('/check')) {
      const transactionId = route.replace('/v1/transactions/', '').replace('/check', '')
      return await checkTransaction(transactionId)
    }

    if (
      request.method === 'POST' &&
      route.startsWith('/v1/transactions/') &&
      route.endsWith('/confirm')
    ) {
      const transactionId = route.replace('/v1/transactions/', '').replace('/confirm', '')
      const body = await parseJson(request)
      return await confirmTransaction(transactionId, body)
    }

    if (request.method === 'GET' && route === '/v1/translation/account') {
      const auth = await authenticateRequest(request, route)
      return json(200, mapAccount(auth.user))
    }

    if (request.method === 'POST' && route === '/v1/translation/regenerate-api-key') {
      const auth = await authenticateRequest(request, route)
      const nextApiKey = createApiKey()
      await setApiKeyForUser(auth.user, nextApiKey)
      return json(200, { api_key: nextApiKey })
    }

    if (request.method === 'POST' && route === '/v1/translation/translate') {
      const auth = await authenticateRequest(request, route)
      const body = await parseJson(request)
      return await translateWithBilling(auth.user, body)
    }

    return json(404, { error: 'Not found' })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    if (typeof error?.statusCode === 'number') {
      const payload = { error: error.message || 'Request failed' }
      if (error.code) {
        payload.code = error.code
      }
      return json(error.statusCode, payload)
    }
    console.error('translation api error', error)
    return json(500, { error: error instanceof Error ? error.message : 'Internal server error' })
  }
}

async function createTransaction(request, body) {
  const signedPubkey = await authenticateOptionalNostrRequest(request, '/v1/transactions')
  const providedPubkey = typeof body?.pubkey === 'string' ? body.pubkey.toLowerCase() : ''
  if (signedPubkey && providedPubkey && signedPubkey !== providedPubkey) {
    return json(400, { error: 'Signed pubkey does not match requested pubkey' })
  }
  const pubkey = signedPubkey || providedPubkey
  const requestedCharacters = Number(body?.characters ?? 0)
  if (!isHexPubkey(pubkey)) {
    return json(400, { error: 'Invalid pubkey' })
  }

  if (!PACKAGE_CHARACTERS.includes(requestedCharacters)) {
    return json(400, { error: 'Invalid character package' })
  }

  const quote = await buildTopUpQuote()
  const pack = quote.packages.find((item) => item.characters === requestedCharacters)
  if (!pack) {
    return json(400, { error: 'Invalid character package' })
  }

  const transactionId = createId('tx')
  const invoiceComment = `x21 translation top-up ${transactionId}`

  const invoiceData = await createInvoiceForLightningAddress({
    lightningAddress: TRANSLATION_LIGHTNING_ADDRESS,
    sats: pack.sats,
    comment: invoiceComment
  })

  const tx = {
    id: transactionId,
    pubkey,
    sats: pack.sats,
    characters: pack.characters,
    state: 'pending',
    invoice: invoiceData.invoice,
    verify: invoiceData.verify ?? null,
    paymentHash: getPaymentHashFromInvoice(invoiceData.invoice),
    lightningAddress: TRANSLATION_LIGHTNING_ADDRESS,
    invoiceComment,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  await transactionStore.setJSON(`tx:${transactionId}`, tx)
  return json(200, {
    transactionId,
    invoiceId: invoiceData.invoice,
    sats: pack.sats,
    characters: pack.characters,
    canVerify: Boolean(invoiceData.verify),
    invoiceComment
  })
}

async function checkTransaction(transactionId) {
  const txKey = `tx:${transactionId}`
  const tx = await transactionStore.get(txKey, { type: 'json' })
  if (!tx) {
    return json(404, { error: 'Transaction not found' })
  }

  if (tx.state !== 'pending') {
    return json(200, {
      state: tx.state,
      canVerify: Boolean(tx.verify),
      transactionId: tx.id,
      sats: tx.sats,
      characters: tx.characters
    })
  }

  console.info('[translation tx] check:pending', {
    transactionId: tx.id,
    paymentHash: tx.paymentHash || null,
    hasVerify: Boolean(tx.verify),
    lightningAddress: tx.lightningAddress || null
  })
  const status = await getTransactionState(tx)
  console.info('[translation tx] check:status', {
    transactionId: tx.id,
    result: status.state,
    source: status.source || 'unknown',
    hasPreimage: Boolean(status.preimage)
  })
  if (status.state === 'settled') {
    if (status.preimage && !tx.preimage) {
      tx.preimage = status.preimage
    }
    await settleTransaction(tx)
  } else if (status.state === 'failed') {
    tx.state = 'failed'
    tx.updatedAt = Date.now()
    await transactionStore.setJSON(txKey, tx)
  }

  return json(200, {
    state: tx.state,
    canVerify: Boolean(tx.verify),
    transactionId: tx.id,
    sats: tx.sats,
    characters: tx.characters
  })
}

async function confirmTransaction(transactionId, body) {
  const txKey = `tx:${transactionId}`
  const tx = await transactionStore.get(txKey, { type: 'json' })
  if (!tx) {
    return json(404, { error: 'Transaction not found' })
  }

  if (tx.state === 'settled') {
    return json(200, {
      state: 'settled',
      canVerify: Boolean(tx.verify),
      transactionId: tx.id,
      sats: tx.sats,
      characters: tx.characters
    })
  }

  const preimage =
    typeof body?.preimage === 'string' ? body.preimage.trim().toLowerCase() : ''
  if (!/^[0-9a-f]{64}$/i.test(preimage)) {
    return json(400, { error: 'Invalid preimage' })
  }

  const expectedPaymentHash = tx.paymentHash || getPaymentHashFromInvoice(tx.invoice)
  const providedPaymentHash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex')

  if (!expectedPaymentHash || expectedPaymentHash !== providedPaymentHash) {
    return json(400, { error: 'Payment proof mismatch' })
  }

  tx.preimage = preimage
  tx.paymentHash = expectedPaymentHash
  await settleTransaction(tx)
  return json(200, {
    state: 'settled',
    canVerify: Boolean(tx.verify),
    transactionId: tx.id,
    sats: tx.sats,
    characters: tx.characters
  })
}

async function settleTransaction(tx) {
  if (tx.state === 'settled') {
    return
  }

  tx.state = 'settled'
  tx.updatedAt = Date.now()
  tx.settledAt = tx.settledAt || Date.now()
  let user = null

  if (!tx.creditedAt) {
    user = await ensureUser(tx.pubkey)
    user.balance = Number(user.balance || 0) + Number(tx.characters || 0)
    user.purchasedCredits = Number(user.purchasedCredits || 0) + Number(tx.characters || 0)
    user.totalSatsPaid = Number(user.totalSatsPaid || 0) + Number(tx.sats || 0)
    user.updatedAt = Date.now()
    await saveUser(user)
    tx.creditedAt = Date.now()
  }

  if (!user) {
    user = await ensureUser(tx.pubkey)
  }
  await publishTranslationReceipt(tx, user)
  await transactionStore.setJSON(`tx:${tx.id}`, tx)
}

async function publishTranslationReceipt(tx, user, options = {}) {
  const force = Boolean(options.force)
  if (!force && tx.receiptEventId) {
    return { ok: true, eventId: tx.receiptEventId }
  }

  const publisher = getReceiptPublisherStatus()
  if (!publisher.configured) {
    tx.receiptStatus = 'disabled'
    tx.receiptError = 'Receipt publisher key is not configured'
    tx.receiptUpdatedAt = Date.now()
    return { ok: false, error: tx.receiptError }
  }

  if (!TRANSLATION_RECEIPT_RELAYS.length) {
    tx.receiptStatus = 'disabled'
    tx.receiptError = 'No receipt relays configured'
    tx.receiptUpdatedAt = Date.now()
    return { ok: false, error: tx.receiptError }
  }

  const apiKeyFingerprint = createApiKeyFingerprint(user.apiKey || '') || ''
  const payerNpub = toNpub(tx.pubkey) || ''
  const event = finalizeEvent(
    {
      kind: TRANSLATION_RECEIPT_EVENT_KIND,
      created_at: Math.floor((tx.settledAt || Date.now()) / 1000),
      tags: [
        ['t', 'x21_translation_payment'],
        ['service', 'x21.translation'],
        ['tx', tx.id],
        ['p', tx.pubkey],
        ['amount', String(Number(tx.sats || 0) * 1000)],
        ['unit', 'msats'],
        ['chars', String(Number(tx.characters || 0))],
        ['hash', tx.paymentHash || ''],
        ['invoice_comment', tx.invoiceComment || ''],
        ['api_key_fingerprint', apiKeyFingerprint],
        ['payer_npub', payerNpub]
      ],
      content: JSON.stringify({
        v: 1,
        type: 'x21.translation.payment.receipt',
        txId: tx.id,
        payerPubkey: tx.pubkey,
        payerNpub: payerNpub || null,
        sats: Number(tx.sats || 0),
        characters: Number(tx.characters || 0),
        paymentHash: tx.paymentHash || null,
        invoiceComment: tx.invoiceComment || '',
        apiKeyFingerprint: apiKeyFingerprint || null,
        manualSettled: Boolean(tx.manualSettled),
        settledAt: Number(tx.settledAt || Date.now())
      })
    },
    publisher.secretKeyBytes
  )

  const pool = new SimplePool()
  try {
    const results = await Promise.allSettled(pool.publish(TRANSLATION_RECEIPT_RELAYS, event))
    const publishedTo = results.filter((result) => result.status === 'fulfilled').length
    if (!publishedTo) {
      const failedReasons = results
        .filter((result) => result.status === 'rejected')
        .map((result) => String(result.reason))
        .slice(0, 2)
      throw new Error(
        failedReasons[0] || 'Failed to publish translation receipt event to configured relays'
      )
    }

    tx.receiptStatus = 'published'
    tx.receiptEventId = event.id
    tx.receiptEventKind = TRANSLATION_RECEIPT_EVENT_KIND
    tx.receiptPublishedAt = Date.now()
    tx.receiptPublishedTo = publishedTo
    tx.receiptRelayCount = TRANSLATION_RECEIPT_RELAYS.length
    tx.receiptError = null
    tx.receiptUpdatedAt = Date.now()
    return { ok: true, eventId: event.id }
  } catch (error) {
    tx.receiptStatus = 'failed'
    tx.receiptError = error instanceof Error ? error.message : 'Failed to publish receipt event'
    tx.receiptUpdatedAt = Date.now()
    return { ok: false, error: tx.receiptError }
  } finally {
    try {
      pool.close(TRANSLATION_RECEIPT_RELAYS)
    } catch {
      // no-op
    }
  }
}

function getReceiptPublisherStatus() {
  const secretKeyBytes = decodeNostrPrivateKey(TRANSLATION_RECEIPT_NSEC)
  if (!secretKeyBytes) {
    return {
      configured: false,
      pubkey: null,
      secretKeyBytes: null
    }
  }
  return {
    configured: true,
    pubkey: getPublicKey(secretKeyBytes),
    secretKeyBytes
  }
}

async function getInvoiceVerificationState(tx) {
  try {
    const normalizedInvoice = normalizeBolt11(tx.invoice)
    if (!normalizedInvoice) {
      return { state: 'pending' }
    }
    const invoice = new Invoice({
      pr: normalizedInvoice,
      verify: typeof tx.verify === 'string' && tx.verify ? tx.verify : undefined
    })
    const paid = await withTimeout(invoice.verifyPayment(), 4000, false)
    if (paid) {
      const preimage =
        typeof invoice.preimage === 'string' && /^[0-9a-f]{64}$/i.test(invoice.preimage)
          ? invoice.preimage.toLowerCase()
          : undefined
      return { state: 'settled', preimage }
    }
    if (invoice.hasExpired()) {
      return { state: 'failed' }
    }
  } catch (error) {
    console.warn('invoice verify failed', error)
  }

  return { state: 'pending' }
}

async function listTransactionsForAdmin({ state, pubkey, limit }) {
  const transactions = await listJsonEntries(transactionStore, 'tx:', 5000)
  const normalizedState = state.toLowerCase().trim()
  const normalizedPubkey = pubkey.toLowerCase().trim()
  const filtered = transactions
    .filter((tx) =>
      normalizedState ? String(tx.state || '').toLowerCase() === normalizedState : true
    )
    .filter((tx) =>
      normalizedPubkey ? String(tx.pubkey || '').toLowerCase().includes(normalizedPubkey) : true
    )
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, limit)

  const userMap = await getUsersMap(filtered.map((tx) => tx.pubkey))
  const data = filtered.map((tx) => mapTransactionForAdmin(tx, userMap.get(tx.pubkey)))
  return {
    count: data.length,
    transactions: data
  }
}

async function listUsersForAdmin({ query, limit }) {
  const users = await listJsonEntries(usersStore, 'user:', 5000)
  const filtered = users
    .filter((user) => {
      if (!query) return true
      const apiKey = typeof user.apiKey === 'string' ? user.apiKey : ''
      return (
        String(user.pubkey || '')
          .toLowerCase()
          .includes(query) || apiKey.toLowerCase().includes(query)
      )
    })
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    .slice(0, limit)
    .map((user) => mapUserForAdmin(user))

  return {
    count: filtered.length,
    users: filtered
  }
}

async function adminReconcileTransaction(transactionId, body) {
  const tx = await getTransactionById(transactionId)
  const preimage = typeof body?.preimage === 'string' ? body.preimage.trim().toLowerCase() : ''
  if (preimage) {
    const result = await confirmTransaction(transactionId, { preimage })
    const payload = await result.json()
    await writeAdminAudit('transaction.reconcile_with_preimage', {
      transactionId,
      state: payload.state
    })
    return payload
  }

  if (tx.state === 'settled') {
    return {
      state: 'settled',
      canVerify: Boolean(tx.verify),
      transaction: mapTransactionForAdmin(tx)
    }
  }

  const status = await getTransactionState(tx)
  if (status.state === 'settled') {
    if (status.preimage && !tx.preimage) {
      tx.preimage = status.preimage
    }
    await settleTransaction(tx)
    await writeAdminAudit('transaction.reconcile_settled', { transactionId })
    const latest = await getTransactionById(transactionId)
    return {
      state: 'settled',
      canVerify: Boolean(latest.verify),
      transaction: mapTransactionForAdmin(latest)
    }
  }

  if (status.state === 'failed') {
    tx.state = 'failed'
    tx.updatedAt = Date.now()
    await transactionStore.setJSON(`tx:${tx.id}`, tx)
    await writeAdminAudit('transaction.reconcile_failed', { transactionId })
  }

  return {
    state: tx.state,
    canVerify: Boolean(tx.verify),
    transaction: mapTransactionForAdmin(tx)
  }
}

async function adminForceSettleTransaction(transactionId, body) {
  const tx = await getTransactionById(transactionId)
  if (tx.state !== 'settled') {
    if (typeof body?.preimage === 'string' && /^[0-9a-f]{64}$/i.test(body.preimage.trim())) {
      tx.preimage = body.preimage.trim().toLowerCase()
    }
    tx.manualSettled = true
    tx.manualReason =
      typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'manual_settle'
    await settleTransaction(tx)
  }

  await writeAdminAudit('transaction.force_settle', {
    transactionId,
    reason: tx.manualReason || 'manual_settle'
  })
  const latest = await getTransactionById(transactionId)
  return {
    state: latest.state,
    transaction: mapTransactionForAdmin(latest)
  }
}

async function adminPublishTransactionReceipt(transactionId) {
  const tx = await getTransactionById(transactionId)
  if (tx.state !== 'settled') {
    const err = new Error('Transaction must be settled before publishing a receipt event')
    err.statusCode = 400
    throw err
  }
  const user = await ensureUser(tx.pubkey)
  const receiptResult = await publishTranslationReceipt(tx, user, { force: true })
  tx.updatedAt = Date.now()
  await transactionStore.setJSON(`tx:${tx.id}`, tx)
  await writeAdminAudit('transaction.publish_receipt', {
    transactionId,
    ok: receiptResult.ok,
    eventId: receiptResult.eventId || null,
    error: receiptResult.error || null
  })
  return {
    ok: receiptResult.ok,
    transaction: mapTransactionForAdmin(tx)
  }
}

async function adminReissueApiKey(pubkey) {
  const user = await ensureUser(pubkey)
  const apiKey = createApiKey()
  await setApiKeyForUser(user, apiKey)
  await writeAdminAudit('user.reissue_api_key', { pubkey })
  return { user: mapUserForAdmin(user), api_key: apiKey }
}

async function adminAdjustUser(pubkey, body) {
  const user = await ensureUser(pubkey)
  const balanceDelta = toFiniteNumber(body?.balanceDelta, 0)
  const purchasedDelta = toFiniteNumber(body?.purchasedDelta, 0)
  const spentDelta = toFiniteNumber(body?.spentDelta, 0)
  const satsDelta = toFiniteNumber(body?.satsDelta, 0)
  const reset = Boolean(body?.reset)
  const reissueApiKey = Boolean(body?.reissueApiKey)

  if (reset) {
    user.balance = 0
    user.purchasedCredits = 0
    user.spentCredits = 0
    user.totalSatsPaid = 0
  }

  user.balance = Math.max(0, Number(user.balance || 0) + balanceDelta)
  user.purchasedCredits = Math.max(0, Number(user.purchasedCredits || 0) + purchasedDelta)
  user.spentCredits = Math.max(0, Number(user.spentCredits || 0) + spentDelta)
  user.totalSatsPaid = Math.max(0, Number(user.totalSatsPaid || 0) + satsDelta)
  user.updatedAt = Date.now()

  let nextApiKey = null
  if (reissueApiKey) {
    nextApiKey = createApiKey()
    await setApiKeyForUser(user, nextApiKey)
  } else {
    await saveUser(user)
  }

  await writeAdminAudit('user.adjust', {
    pubkey,
    reset,
    balanceDelta,
    purchasedDelta,
    spentDelta,
    satsDelta,
    reissueApiKey
  })

  return {
    user: mapUserForAdmin(user),
    api_key: nextApiKey
  }
}

async function adminDeleteUser(pubkey) {
  const user = await usersStore.get(`user:${pubkey}`, { type: 'json' })
  if (!user) {
    return { deleted: false, reason: 'not_found' }
  }
  if (user.apiKey) {
    await apiKeyStore.delete(`api:${user.apiKey}`)
  }
  await usersStore.delete(`user:${pubkey}`)
  await writeAdminAudit('user.delete', { pubkey })
  return { deleted: true }
}

async function getTransactionById(transactionId) {
  const tx = await transactionStore.get(`tx:${transactionId}`, { type: 'json' })
  if (!tx) {
    const err = new Error('Transaction not found')
    err.statusCode = 404
    throw err
  }
  return tx
}

async function translateWithBilling(user, body) {
  const openRouterConfig = await resolveOpenRouterKey()
  if (!openRouterConfig.key) {
    return json(500, { error: 'Translation service not configured' })
  }

  const text = typeof body?.q === 'string' ? body.q.trim() : ''
  const target = typeof body?.target === 'string' ? body.target.trim() : ''
  if (!text || !target) {
    return json(400, { error: 'Missing translation payload' })
  }

  if (text.length > TRANSLATION_MAX_CHARS_PER_REQUEST) {
    return json(400, {
      error: `Text too long. Max ${TRANSLATION_MAX_CHARS_PER_REQUEST.toLocaleString()} characters per request.`
    })
  }

  const cacheKey = createHashKey(`${user.pubkey}|${target}|${text}`)
  const cache = await translationCacheStore.get(`cache:${cacheKey}`, { type: 'json' })
  if (cache?.translatedText) {
    const cachedCharacters = Number(cache.chargedCredits || cache.sourceLength || text.length || 0)
    if (cachedCharacters > 0) {
      user.cachedCharacters = Number(user.cachedCharacters || 0) + cachedCharacters
      user.updatedAt = Date.now()
      await saveUser(user)
    }
    return json(200, { translatedText: cache.translatedText, cached: true })
  }

  const reserveCredits = Math.max(1, Math.ceil(text.length * 2))
  if (Number(user.balance || 0) < reserveCredits) {
    return json(402, {
      error: 'Not enough credits. Please top up your translation balance.',
      code: '00402'
    })
  }

  const translatedText = await callOpenRouterTranslate(text, target, openRouterConfig.key)
  const chargeCredits = Math.max(text.length, translatedText.length)
  if (Number(user.balance || 0) < chargeCredits) {
    return json(402, {
      error: 'Not enough credits for this translation.',
      code: '00402'
    })
  }

  user.balance = Number(user.balance || 0) - chargeCredits
  user.spentCredits = Number(user.spentCredits || 0) + chargeCredits
  user.updatedAt = Date.now()
  await saveUser(user)

  await translationCacheStore.setJSON(`cache:${cacheKey}`, {
    pubkey: user.pubkey,
    target,
    sourceLength: text.length,
    translatedLength: translatedText.length,
    chargedCredits: chargeCredits,
    translatedText,
    model: OPENROUTER_MODEL,
    createdAt: Date.now()
  })

  return json(200, { translatedText })
}

async function callOpenRouterTranslate(text, target, openRouterApiKey) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openRouterApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content:
            'You are a translation engine. Return only the translated text, with no explanations.'
        },
        {
          role: 'user',
          content: `Translate this into ${target}:\n\n${text}`
        }
      ]
    })
  })

  const data = await response.json()
  if (!response.ok) {
    const message = data?.error?.message || data?.error || 'OpenRouter request failed'
    throw new Error(message)
  }

  const translated = data?.choices?.[0]?.message?.content
  if (!translated || typeof translated !== 'string') {
    throw new Error('Invalid OpenRouter translation response')
  }

  return translated.trim()
}

async function resolveOpenRouterKey() {
  if (
    openRouterKeyCache.key !== null &&
    Date.now() - openRouterKeyCache.fetchedAt < OPENROUTER_KEY_CACHE_TTL_MS
  ) {
    return openRouterKeyCache
  }

  const stored = await adminConfigStore.get('openrouter', { type: 'json' })
  if (stored && typeof stored.apiKey === 'string' && stored.apiKey.trim()) {
    openRouterKeyCache = {
      fetchedAt: Date.now(),
      key: stored.apiKey.trim(),
      source: 'blob',
      updatedAt: Number(stored.updatedAt || 0) || null
    }
    return openRouterKeyCache
  }

  openRouterKeyCache = {
    fetchedAt: Date.now(),
    key: OPENROUTER_API_KEY || '',
    source: OPENROUTER_API_KEY ? 'env' : 'none',
    updatedAt: null
  }
  return openRouterKeyCache
}

function invalidateOpenRouterCache() {
  openRouterKeyCache = {
    fetchedAt: 0,
    key: null,
    source: 'none',
    updatedAt: null
  }
  openRouterStatusCache = {
    fetchedAt: 0,
    keyHash: '',
    status: {
      state: 'unknown',
      message: 'Not checked yet',
      checkedAt: 0,
      remainingCredits: null,
      totalCredits: null,
      totalUsage: null
    }
  }
}

async function getOpenRouterKeyStatus(keyState) {
  if (!keyState?.key) {
    return {
      state: 'missing',
      message: 'No OpenRouter key configured',
      checkedAt: Date.now(),
      remainingCredits: null,
      totalCredits: null,
      totalUsage: null
    }
  }

  const keyHash = createHashKey(keyState.key).slice(0, 16)
  if (
    openRouterStatusCache.keyHash === keyHash &&
    Date.now() - openRouterStatusCache.fetchedAt < OPENROUTER_STATUS_CACHE_TTL_MS
  ) {
    return openRouterStatusCache.status
  }

  let nextStatus = {
    state: 'unknown',
    message: 'Could not verify OpenRouter key status',
    checkedAt: Date.now(),
    remainingCredits: null,
    totalCredits: null,
    totalUsage: null
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: {
        Authorization: `Bearer ${keyState.key}`,
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    })
    const rawText = await response.text()
    let data = {}
    try {
      data = rawText ? JSON.parse(rawText) : {}
    } catch {
      data = {}
    }

    if (!response.ok) {
      const message =
        data?.error?.message ||
        data?.message ||
        data?.error ||
        `OpenRouter responded with ${response.status}`
      const normalized = String(message).toLowerCase()
      const isCreditIssue =
        normalized.includes('credit') ||
        normalized.includes('quota') ||
        normalized.includes('insufficient')
      nextStatus = {
        state: isCreditIssue ? 'depleted' : response.status === 401 ? 'invalid' : 'error',
        message: String(message),
        checkedAt: Date.now(),
        remainingCredits: null,
        totalCredits: null,
        totalUsage: null
      }
    } else {
      const payload = data?.data && typeof data.data === 'object' ? data.data : data
      const remainingCredits = pickFiniteNumber([
        payload?.remaining_credits,
        payload?.credits_remaining
      ])
      const totalCredits = pickFiniteNumber([payload?.total_credits, payload?.credits])
      const totalUsage = pickFiniteNumber([payload?.total_usage, payload?.usage])
      const computedRemaining =
        remainingCredits ??
        (Number.isFinite(totalCredits) && Number.isFinite(totalUsage)
          ? totalCredits - totalUsage
          : null)

      const depleted = Number.isFinite(computedRemaining) && computedRemaining <= 0
      nextStatus = {
        state: depleted ? 'depleted' : 'ok',
        message: depleted
          ? 'OpenRouter key has no remaining credits'
          : 'OpenRouter key is active',
        checkedAt: Date.now(),
        remainingCredits: Number.isFinite(computedRemaining) ? computedRemaining : null,
        totalCredits: Number.isFinite(totalCredits) ? totalCredits : null,
        totalUsage: Number.isFinite(totalUsage) ? totalUsage : null
      }
    }
  } catch (error) {
    nextStatus = {
      state: 'error',
      message:
        error instanceof Error ? error.message : 'Failed to check OpenRouter key status',
      checkedAt: Date.now(),
      remainingCredits: null,
      totalCredits: null,
      totalUsage: null
    }
  }

  openRouterStatusCache = {
    fetchedAt: Date.now(),
    keyHash,
    status: nextStatus
  }
  return nextStatus
}

function assertAdminRequest(request) {
  if (!TRANSLATION_ADMIN_TOKEN) {
    const err = new Error('Translation admin token not configured')
    err.statusCode = 500
    throw err
  }
  const authHeader = request.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    throw authError()
  }
  const providedToken = authHeader.slice(7).trim()
  if (!safeEqualConstantTime(providedToken, TRANSLATION_ADMIN_TOKEN)) {
    throw authError()
  }
}

async function authenticateRequest(request, routePath) {
  const authHeader = request.headers.get('authorization') || ''
  if (!authHeader) {
    throw authError()
  }

  if (authHeader.startsWith('Bearer ')) {
    const apiKey = authHeader.slice(7).trim()
    const pubkey = await apiKeyStore.get(`api:${apiKey}`)
    if (!pubkey) {
      throw authError()
    }
    const user = await ensureUser(pubkey)
    if (user.apiKey !== apiKey) {
      throw authError()
    }
    return { pubkey, user }
  }

  if (!authHeader.startsWith('Nostr ')) {
    throw authError()
  }

  let event
  try {
    event = JSON.parse(Buffer.from(authHeader.slice(6).trim(), 'base64').toString('utf8'))
  } catch {
    throw authError()
  }

  if (!event || !verifyEvent(event) || event.kind !== kinds.HTTPAuth) {
    throw authError()
  }

  const methodTag = getTag(event.tags, 'method')
  if (methodTag && methodTag.toUpperCase() !== request.method.toUpperCase()) {
    throw authError()
  }

  const urlTag = getTag(event.tags, 'u')
  if (urlTag) {
    try {
      const tagged = new URL(urlTag)
      if (!tagged.pathname.endsWith(routePath)) {
        throw authError()
      }
    } catch {
      throw authError()
    }
  }

  if (!isHexPubkey(event.pubkey)) {
    throw authError()
  }

  const user = await ensureUser(event.pubkey)
  return { pubkey: event.pubkey, user }
}

async function authenticateOptionalNostrRequest(request, routePath) {
  const authHeader = request.headers.get('authorization') || ''
  if (!authHeader) return ''
  if (!authHeader.startsWith('Nostr ')) {
    const err = new Error('Unsupported authorization scheme')
    err.statusCode = 400
    throw err
  }

  let event
  try {
    event = JSON.parse(Buffer.from(authHeader.slice(6).trim(), 'base64').toString('utf8'))
  } catch {
    throw authError()
  }

  if (!event || !verifyEvent(event) || event.kind !== kinds.HTTPAuth) {
    throw authError()
  }

  const methodTag = getTag(event.tags, 'method')
  if (methodTag && methodTag.toUpperCase() !== request.method.toUpperCase()) {
    throw authError()
  }

  const urlTag = getTag(event.tags, 'u')
  if (urlTag) {
    try {
      const tagged = new URL(urlTag)
      if (!tagged.pathname.endsWith(routePath)) {
        throw authError()
      }
    } catch {
      throw authError()
    }
  }

  if (!isHexPubkey(event.pubkey)) {
    throw authError()
  }

  return event.pubkey.toLowerCase()
}

async function ensureUser(pubkey) {
  const key = `user:${pubkey}`
  let user = await usersStore.get(key, { type: 'json' })
  if (user) {
    if (!user.apiKey) {
      user.apiKey = createApiKey()
      await setApiKeyForUser(user, user.apiKey)
    }
    return user
  }

  const apiKey = createApiKey()
  user = {
    pubkey,
    apiKey,
    balance: 0,
    purchasedCredits: 0,
    spentCredits: 0,
    cachedCharacters: 0,
    totalSatsPaid: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  await usersStore.setJSON(key, user)
  await apiKeyStore.set(`api:${apiKey}`, pubkey)
  return user
}

async function saveUser(user) {
  await usersStore.setJSON(`user:${user.pubkey}`, user)
}

async function setApiKeyForUser(user, nextApiKey) {
  if (user.apiKey) {
    await apiKeyStore.delete(`api:${user.apiKey}`)
  }
  user.apiKey = nextApiKey
  user.updatedAt = Date.now()
  await usersStore.setJSON(`user:${user.pubkey}`, user)
  await apiKeyStore.set(`api:${nextApiKey}`, user.pubkey)
}

async function buildTopUpQuote() {
  const btc = await getBtcPriceUsd()
  const usdPerSat = btc.value / 100_000_000
  const marginMultiplier = getLegacyMarginMultiplier()
  const packages = PACKAGE_CHARACTERS.map((characters) => {
    const modelCostUsd = getModelCostUsd(characters)
    const targetRevenueUsd = modelCostUsd * marginMultiplier
    const sats = Math.max(1, Math.ceil(targetRevenueUsd / usdPerSat))
    return {
      characters,
      sats,
      estimatedUsdCost: round(modelCostUsd, 6)
    }
  })

  return {
    model: OPENROUTER_MODEL,
    priceSource: btc.source,
    btcUsd: round(btc.value, 2),
    fallbackBtcUsd: BTC_USD_FALLBACK,
    marginMultiplier: round(marginMultiplier, 4),
    packages
  }
}

function getLegacyMarginMultiplier() {
  const legacyUsdPerChar = (BASELINE_BTC_USD / 100_000_000) / LEGACY_CHARS_PER_SAT
  const modelUsdPerChar = getModelCostUsd(1)
  if (modelUsdPerChar <= 0) return 1
  return legacyUsdPerChar / modelUsdPerChar
}

function getModelCostUsd(characters) {
  const tokenCount = characters / CHARS_PER_TOKEN
  const inputCost = (tokenCount / 1_000_000) * MODEL_INPUT_RATE_USD_PER_M
  const outputCost = (tokenCount / 1_000_000) * MODEL_OUTPUT_RATE_USD_PER_M
  return inputCost + outputCost
}

async function getBtcPriceUsd() {
  if (Date.now() - btcUsdCache.fetchedAt < BTC_PRICE_TTL_MS) {
    return btcUsdCache
  }

  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
      { headers: { Accept: 'application/json' } }
    )
    if (!response.ok) {
      throw new Error(`CoinGecko returned ${response.status}`)
    }
    const data = await response.json()
    const value = Number(data?.bitcoin?.usd)
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('Invalid CoinGecko payload')
    }
    btcUsdCache = {
      fetchedAt: Date.now(),
      value,
      source: 'coingecko'
    }
    return btcUsdCache
  } catch (error) {
    console.warn('coin gecko fallback', error)
    btcUsdCache = {
      fetchedAt: Date.now(),
      value: BTC_USD_FALLBACK,
      source: 'fallback'
    }
    return btcUsdCache
  }
}

async function createInvoiceForLightningAddress({ lightningAddress, sats, comment }) {
  const [name, domain] = lightningAddress.split('@')
  if (!name || !domain) {
    throw new Error('TRANSLATION_LIGHTNING_ADDRESS must be a lightning address')
  }

  const lnurlpUrl = new URL(`/.well-known/lnurlp/${name}`, `https://${domain}`).toString()
  const lnurlDataResponse = await fetch(lnurlpUrl, {
    headers: { Accept: 'application/json' }
  })
  const lnurlData = await lnurlDataResponse.json()
  if (!lnurlDataResponse.ok || !lnurlData?.callback) {
    throw new Error(lnurlData?.reason || 'Failed to fetch lightning address metadata')
  }

  const amountMsat = sats * 1000
  if (
    Number.isFinite(Number(lnurlData.minSendable)) &&
    amountMsat < Number(lnurlData.minSendable)
  ) {
    throw new Error('Amount too low for lightning address')
  }

  if (
    Number.isFinite(Number(lnurlData.maxSendable)) &&
    amountMsat > Number(lnurlData.maxSendable)
  ) {
    throw new Error('Amount too high for lightning address')
  }

  const callbackUrl = new URL(lnurlData.callback)
  callbackUrl.searchParams.set('amount', String(amountMsat))
  const commentAllowed = Number(lnurlData.commentAllowed || 0)
  if (commentAllowed > 0 && comment) {
    callbackUrl.searchParams.set('comment', comment.slice(0, commentAllowed))
  }

  const invoiceResponse = await fetch(callbackUrl.toString(), {
    headers: { Accept: 'application/json' }
  })
  const invoiceData = await invoiceResponse.json()

  if (!invoiceResponse.ok || !invoiceData?.pr) {
    throw new Error(invoiceData?.reason || invoiceData?.error || 'Failed to create invoice')
  }

  const paymentHash = getPaymentHashFromInvoice(invoiceData.pr)
  const verifyFromLnurl = typeof invoiceData.verify === 'string' ? invoiceData.verify : null
  const derivedVerify =
    paymentHash && name && domain
      ? `https://${domain}/.well-known/lnurlp/${encodeURIComponent(name)}/status/${paymentHash}`
      : null

  return {
    invoice: invoiceData.pr,
    verify: verifyFromLnurl || derivedVerify || null
  }
}

async function getTransactionState(tx) {
  const byInvoice = await getInvoiceVerificationState(tx)
  if (byInvoice.state !== 'pending') {
    return { ...byInvoice, source: 'invoice.verifyPayment' }
  }

  if (!tx.verify) {
    return await getFallbackTransactionState(tx)
  }

  try {
    const response = await fetch(tx.verify, {
      headers: { Accept: 'application/json' }
    })
    const data = await response.json()
    if (!response.ok) {
      return { state: 'pending' }
    }

    if (looksSettled(data)) {
      return {
        state: 'settled',
        source: 'verify.url',
        preimage:
          typeof data?.preimage === 'string' && /^[0-9a-f]{64}$/i.test(data.preimage)
            ? data.preimage.toLowerCase()
            : undefined
      }
    }

    if (looksFailed(data)) {
      return { state: 'failed', source: 'verify.url' }
    }
  } catch (error) {
    console.warn('verify transaction failed', error)
  }

  return { state: 'pending', source: 'verify.url' }
}

async function getFallbackTransactionState(tx) {
  const paymentHash = tx.paymentHash || getPaymentHashFromInvoice(tx.invoice)
  if (!paymentHash) {
    return { state: 'pending', source: 'fallback:no-payment-hash' }
  }

  const statusUrls = []
  const legacyDomains = new Set(['coinos.io'])
  if (typeof tx.lightningAddress === 'string' && tx.lightningAddress.includes('@')) {
    const [name, domain] = tx.lightningAddress.split('@')
    const normalizedName = name?.trim().toLowerCase()
    const normalizedDomain = domain?.trim().toLowerCase()
    if (normalizedDomain) {
      legacyDomains.add(normalizedDomain)
    }
    if (normalizedName && normalizedDomain) {
      statusUrls.push(
        `https://${normalizedDomain}/.well-known/lnurlp/${encodeURIComponent(normalizedName)}/status/${paymentHash}`,
        `https://${normalizedDomain}/lnurlp/${encodeURIComponent(normalizedName)}/status/${paymentHash}`
      )
    }
  }

  statusUrls.push(
    ...Array.from(legacyDomains).flatMap((domain) => [
      `https://${domain}/api/invoice/${paymentHash}`,
      `https://${domain}/api/v1/invoice/${paymentHash}`,
      `https://${domain}/api/payments/${paymentHash}`,
      `https://${domain}/api/payment/${paymentHash}`
    ])
  )

  for (const statusUrl of statusUrls) {
    try {
      const response = await fetch(statusUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(2000)
      })
      const rawText = await response.text()
      if (!rawText) continue

      // Skip SPA/HTML fallback responses.
      if (rawText.trim().toLowerCase().startsWith('<!doctype html')) {
        continue
      }

      try {
        const data = JSON.parse(rawText)
        if (looksSettled(data)) {
          console.info('[translation tx] fallback:settled', {
            transactionId: tx.id,
            statusUrl
          })
          return {
            state: 'settled',
            source: statusUrl,
            preimage:
              typeof data?.preimage === 'string' && /^[0-9a-f]{64}$/i.test(data.preimage)
                ? data.preimage.toLowerCase()
                : undefined
          }
        }
        if (looksFailed(data)) return { state: 'failed', source: statusUrl }
      } catch {
        const normalized = rawText.toLowerCase()
        if (/invoice not found|not found|unknown invoice/.test(normalized)) {
          continue
        }
        if (/\b(settled|paid|confirmed|complete)\b/.test(normalized)) {
          return { state: 'settled', source: statusUrl }
        }
        if (/\b(failed|expired|cancelled|canceled)\b/.test(normalized)) {
          return { state: 'failed', source: statusUrl }
        }
      }
    } catch {
      continue
    }
  }

  return { state: 'pending', source: 'fallback:all-pending' }
}

function looksSettled(data) {
  return (
    data?.paid === true ||
    data?.settled === true ||
    data?.state === 'SETTLED' ||
    data?.status === 'SETTLED' ||
    data?.status === 'PAID' ||
    data?.status === 'paid' ||
    Boolean(data?.preimage)
  )
}

function looksFailed(data) {
  return (
    data?.status === 'ERROR' ||
    data?.status === 'FAILED' ||
    data?.state === 'FAILED' ||
    data?.failed === true
  )
}

function getPaymentHashFromInvoice(invoice) {
  const normalizedInvoice = normalizeBolt11(invoice)
  if (!normalizedInvoice) {
    return null
  }
  try {
    const parsed = new Invoice({ pr: normalizedInvoice })
    return parsed.paymentHash || null
  } catch {
    return null
  }
}

function normalizeBolt11(input) {
  if (typeof input !== 'string') return ''
  let value = input.trim()
  if (!value) return ''
  if (value.toLowerCase().startsWith('lightning:')) {
    value = value.slice('lightning:'.length)
  }
  const match = value.match(/(ln[a-z0-9]+1[0-9a-z]+)/i)
  if (match?.[1]) {
    return match[1]
  }
  return value
}

async function listJsonEntries(store, prefix, limit = 200) {
  const out = []
  outer: for await (const page of store.list({ prefix, paginate: true })) {
    const keys = page.blobs.map((item) => item.key)
    const values = await Promise.all(keys.map((key) => store.get(key, { type: 'json' })))
    for (const value of values) {
      if (!value) continue
      out.push(value)
      if (out.length >= limit) break outer
    }
  }
  return out
}

async function getUsersMap(pubkeys) {
  const uniquePubkeys = Array.from(new Set(pubkeys.filter((value) => isHexPubkey(value))))
  const entries = await Promise.all(
    uniquePubkeys.map(async (pubkey) => {
      const user = await usersStore.get(`user:${pubkey}`, { type: 'json' })
      return [pubkey, user]
    })
  )
  return new Map(entries.filter(([, user]) => !!user))
}

function mapTransactionForAdmin(tx, user) {
  return {
    id: tx.id,
    pubkey: tx.pubkey,
    npub: toNpub(tx.pubkey),
    state: tx.state,
    sats: Number(tx.sats || 0),
    characters: Number(tx.characters || 0),
    invoiceComment: tx.invoiceComment || '',
    paymentHash: tx.paymentHash || null,
    canVerify: Boolean(tx.verify),
    verifyUrl: tx.verify || null,
    createdAt: Number(tx.createdAt || 0),
    updatedAt: Number(tx.updatedAt || 0),
    settledAt: Number(tx.settledAt || 0) || null,
    creditedAt: Number(tx.creditedAt || 0) || null,
    preimage: tx.preimage || null,
    manualSettled: Boolean(tx.manualSettled),
    manualReason: tx.manualReason || null,
    receiptStatus: tx.receiptStatus || null,
    receiptEventId: tx.receiptEventId || null,
    receiptEventKind: Number(tx.receiptEventKind || 0) || null,
    receiptPublishedAt: Number(tx.receiptPublishedAt || 0) || null,
    receiptPublishedTo: Number(tx.receiptPublishedTo || 0) || 0,
    receiptRelayCount: Number(tx.receiptRelayCount || 0) || 0,
    receiptError: tx.receiptError || null,
    user: user
      ? {
          pubkey: user.pubkey,
          npub: toNpub(user.pubkey),
          api_key_masked: maskSecret(user.apiKey || ''),
          balance: Number(user.balance || 0),
          purchased_credits: Number(user.purchasedCredits || 0),
          spent_credits: Number(user.spentCredits || 0),
          total_sats_paid: Number(user.totalSatsPaid || 0)
        }
      : null
  }
}

function mapUserForAdmin(user) {
  return {
    pubkey: user.pubkey,
    npub: toNpub(user.pubkey),
    api_key: user.apiKey || null,
    api_key_masked: maskSecret(user.apiKey || ''),
    api_key_fingerprint: createApiKeyFingerprint(user.apiKey || ''),
    balance: Number(user.balance || 0),
    purchased_credits: Number(user.purchasedCredits || 0),
    spent_credits: Number(user.spentCredits || 0),
    cached_characters: Number(user.cachedCharacters || 0),
    total_sats_paid: Number(user.totalSatsPaid || 0),
    createdAt: Number(user.createdAt || 0),
    updatedAt: Number(user.updatedAt || 0)
  }
}

async function writeAdminAudit(action, payload = {}) {
  const id = `${Date.now()}_${randomBytes(5).toString('hex')}`
  await adminAuditStore.setJSON(`audit:${id}`, {
    id,
    action,
    payload,
    createdAt: Date.now()
  })
}

function mapAccount(user) {
  return {
    pubkey: user.pubkey,
    npub: toNpub(user.pubkey),
    api_key: user.apiKey,
    api_key_fingerprint: createApiKeyFingerprint(user.apiKey || ''),
    balance: Number(user.balance || 0),
    purchased_credits: Number(user.purchasedCredits || 0),
    spent_credits: Number(user.spentCredits || 0),
    cached_characters: Number(user.cachedCharacters || 0),
    total_sats_paid: Number(user.totalSatsPaid || 0)
  }
}

function extractRoute(rawUrl) {
  const url = new URL(rawUrl)
  const marker = '/v1/'
  const index = url.pathname.indexOf(marker)
  if (index >= 0) {
    return url.pathname.slice(index)
  }
  return url.pathname
}

function authError() {
  const err = new Error('Unauthorized')
  err.statusCode = 401
  err.code = '00403'
  return err
}

function toFiniteNumber(value, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return number
}

function pickFiniteNumber(values) {
  for (const value of values) {
    const number = Number(value)
    if (Number.isFinite(number)) return number
  }
  return null
}

function safeEqualConstantTime(a, b) {
  const ab = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

async function parseJson(request) {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers
  })
}

function createApiKey() {
  return `x21_${randomBytes(24).toString('hex')}`
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(6).toString('hex')}`
}

function createHashKey(input) {
  return createHash('sha256').update(input).digest('hex')
}

function maskSecret(value) {
  if (!value) return null
  if (value.length <= 8) return '********'
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}

function getTag(tags, name) {
  if (!Array.isArray(tags)) return undefined
  const tag = tags.find((item) => Array.isArray(item) && item[0] === name)
  return tag?.[1]
}

function isHexPubkey(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value)
}

function parseRelayList(value, fallbackRelays) {
  const input = typeof value === 'string' ? value : ''
  const parsed = input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map(normalizeRelayUrl)
    .filter(Boolean)
  const relays = parsed.length ? parsed : fallbackRelays.map(normalizeRelayUrl).filter(Boolean)
  return Array.from(new Set(relays))
}

function normalizeRelayUrl(value) {
  try {
    const url = new URL(value)
    if (!['ws:', 'wss:'].includes(url.protocol)) return ''
    return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/+$/, '')
  } catch {
    return ''
  }
}

function decodeNostrPrivateKey(secret) {
  if (typeof secret !== 'string' || !secret.trim()) return null
  const trimmed = secret.trim()
  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    return Buffer.from(trimmed, 'hex')
  }

  if (trimmed.startsWith('nsec1')) {
    try {
      const decoded = nip19.decode(trimmed)
      if (decoded.type !== 'nsec') return null
      return decoded.data
    } catch {
      return null
    }
  }

  return null
}

function toNpub(pubkey) {
  if (!isHexPubkey(pubkey)) return null
  try {
    return nip19.npubEncode(pubkey)
  } catch {
    return null
  }
}

function createApiKeyFingerprint(apiKey) {
  if (!apiKey) return null
  const digest = createHash('sha256').update(apiKey).digest('hex')
  return `ak_${digest.slice(0, 16)}`
}

function toPositiveNumber(value, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return fallback
  return number
}

function toSafeInt(value, fallback, min, max) {
  const number = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, number))
}

function round(value, digits) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

async function withTimeout(promise, timeoutMs, fallbackValue) {
  let timeoutId
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(fallbackValue), timeoutMs)
  })
  const result = await Promise.race([promise, timeoutPromise])
  clearTimeout(timeoutId)
  return result
}
