const { encodeB32, decodeB32 } = require('../tools')
const { cosmosMessageType } = require('../message-types')
const BigNumber = require('bignumber.js')

const NETWORK_ID = 'cosmoshub'

function proposalBeginTime(proposal) {
  switch (proposal.proposal_status.toLowerCase()) {
    case 'depositperiod':
      return proposal.submit_time
    case 'votingperiod':
      return proposal.voting_start_time
    case 'passed':
    case 'rejected':
      return proposal.voting_end_time
  }
}

function proposalEndTime(proposal) {
  switch (proposal.proposal_status.toLowerCase()) {
    case 'depositperiod':
      return proposal.voting_start_time
    case 'votingperiod':
    // the end time lives in the past already if the proposal is finalized
    case 'passed':
    case 'rejected':
      return proposal.voting_end_time
  }
}

function atoms(nanoAtoms) {
  return BigNumber(nanoAtoms).div(1000000)
}

// reduce deposits to one number and filter by required denom
function getDeposit(proposal, bondDenom) {
  return atoms(
    proposal.total_deposit.reduce(
      (sum, cur) => sum.plus(cur.denom === bondDenom ? cur.amount : 0),
      BigNumber(0)
    )
  )
}

function getTotalVotedPercentage(proposal, totalBondedTokens, totalVoted) {
  // for passed proposals we can't calculate the total voted percentage, as we don't know the totalBondedTokens in the past
  if (['Passed', 'Rejected'].indexOf(proposal.proposal_status) !== -1) return -1
  if (totalVoted.eq(0)) return 0
  if (!totalBondedTokens) return -1
  return BigNumber(totalBondedTokens)
    .div(atoms(totalVoted))
    .toNumber()
}

function tallyReducer(proposal, totalBondedTokens) {
  const totalVoted = atoms(
    BigNumber(proposal.final_tally_result.yes)
      .plus(proposal.final_tally_result.no)
      .plus(proposal.final_tally_result.abstain)
      .plus(proposal.final_tally_result.no_with_veto)
  )

  return {
    yes: atoms(proposal.final_tally_result.yes),
    no: atoms(proposal.final_tally_result.no),
    abstain: atoms(proposal.final_tally_result.abstain),
    veto: atoms(proposal.final_tally_result.no_with_veto),
    total: totalVoted,
    totalVotedPercentage: getTotalVotedPercentage(
      proposal,
      totalBondedTokens,
      totalVoted
    )
  }
}

function proposalReducer(proposal, totalBondedTokens) {
  return {
    networkId: NETWORK_ID,
    id: Number(proposal.proposal_id),
    type: proposal.proposal_content.type,
    title: proposal.proposal_content.value.title,
    description: proposal.proposal_content.value.description,
    creationTime: proposal.submit_time,
    status: proposal.proposal_status,
    statusBeginTime: proposalBeginTime(proposal),
    statusEndTime: proposalEndTime(proposal),
    tally: tallyReducer(proposal, totalBondedTokens),
    deposit: getDeposit(proposal, 'uatom')
  }
}

function getValidatorStatus(validator) {
  if (validator.status === 2) {
    return {
      status: 'ACTIVE',
      status_detailed: 'active'
    }
  }
  if (
    validator.signing_info &&
    new Date(validator.signing_info.jailed_until) > new Date(9000, 1, 1)
  ) {
    return {
      status: 'INACTIVE',
      status_detailed: 'banned'
    }
  }

  return {
    status: 'INACTIVE',
    status_detailed: 'inactive'
  }
}

function validatorReducer(validator) {
  const statusInfo = getValidatorStatus(validator)
  let websiteURL = validator.description.website
  if (!websiteURL || websiteURL === '[do-not-modify]') {
    websiteURL = ''
  } else if (!websiteURL.match(/http[s]?/)) {
    websiteURL = `https://` + websiteURL
  }

  const hexAddr = decodeB32(validator.operator_address)
  const address = encodeB32(hexAddr, `cosmos`)

  return {
    networkId: NETWORK_ID,
    operatorAddress: validator.operator_address,
    consensusPubkey: validator.consensus_pubkey,
    address,
    jailed: validator.jailed,
    details: validator.description.details,
    website: websiteURL,
    identity: validator.description.identity,
    moniker: validator.description.moniker,
    votingPower: validator.voting_power,
    startHeight: validator.signing_info
      ? validator.signing_info.start_height
      : undefined,
    uptimePercentage: 1, // TODO
    tokens: validator.tokens,
    updateTime: validator.commission.update_time,
    commission: validator.commission.rate,
    maxCommission: validator.commission.max_rate,
    maxChangeCommission: validator.commission.max_change_rate,
    status: statusInfo.status,
    statusDetailed: statusInfo.status_detailed,
    delegatorShares: validator.delegator_shares, // needed to calculate delegation token amounts from shares
    expectedReturns: validator.expected_returns
  }
}

function blockReducer(block) {
  return {
    networkId: NETWORK_ID,
    height: block.block_meta.header.height,
    chainId: block.block_meta.header.chain_id,
    hash: block.block_meta.block_id.hash,
    time: block.block_meta.header.time,
    numTxs: block.block_meta.header.num_txs,
    proposer_address: block.block_meta.header.proposer_address
  }
}

function balanceReducer(balance) {
  return {
    denom: balance[0].denom,
    amount: balance[0].amount
  }
}

function delegationReducer(delegation) {
  if (delegation.error) {
    return {
      delegatorAddress: '',
      validatorAddress: '',
      amount: 0
    }
  }

  return {
    delegatorAddress: delegation.delegator_address,
    validatorAddress: delegation.validator_address,
    amount: String(delegation.balance)
  }
}

function coinReducer(coin) {
  if (!coin) {
    return {
      amount: 0,
      denom: ''
    }
  } else
    return {
      amount: coin.amount,
      denom: coin.denom
    }
}

function getGroupByType(transactionType) {
  const transactionGroup = {
    [cosmosMessageType.SEND]: 'banking',
    [cosmosMessageType.CREATE_VALIDATOR]: 'staking',
    [cosmosMessageType.EDIT_VALIDATOR]: 'staking',
    [cosmosMessageType.DELEGATE]: 'staking',
    [cosmosMessageType.UNDELEGATE]: 'staking',
    [cosmosMessageType.BEGIN_REDELEGATE]: 'staking',
    [cosmosMessageType.UNJAIL]: 'staking',
    [cosmosMessageType.SUBMIT_PROPOSAL]: 'governance',
    [cosmosMessageType.DEPOSIT]: 'governance',
    [cosmosMessageType.VOTE]: 'governance',
    [cosmosMessageType.SET_WITHDRAW_ADDRESS]: 'distribution',
    [cosmosMessageType.WITHDRAW_DELEGATION_REWARD]: 'distribution',
    [cosmosMessageType.WITHDRAW_VALIDATOR_COMMISSION]: 'distribution'
  }

  return transactionGroup[transactionType]
}

function transactionReducer(transaction) {
  let fee = coinReducer(false)
  if (Array.isArray(transaction.tx.value.fee.amount)) {
    fee = coinReducer(transaction.tx.value.fee.amount[0])
  } else {
    fee = coinReducer(transaction.tx.value.fee.amount)
  }

  const result = {
    type: transaction.tx.value.msg[0].type,
    group: getGroupByType(transaction.tx.value.msg[0].type),
    hash: transaction.txhash,
    height: Number(transaction.height),
    timestamp: transaction.timestamp,
    gasUsed: transaction.gas_used,
    gasWanted: transaction.gas_wanted,
    success: transaction.logs[0].success,
    log: transaction.logs[0].log,
    memo: transaction.tx.value.memo,
    fee,
    signature: transaction.tx.value.signatures[0].signature,
    value: JSON.stringify(transaction.tx.value.msg[0].value)
  }

  return result
}

module.exports = {
  proposalReducer,
  tallyReducer,
  validatorReducer,
  blockReducer,
  balanceReducer,
  delegationReducer,
  coinReducer,
  transactionReducer
}
