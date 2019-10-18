const BigNumber = require('bignumber.js')

const NETWORK_ID = 'gaia-testnet'

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
    id: Number(proposal.id),
    type: proposal.content.type,
    title: proposal.content.value.title,
    description: proposal.content.value.description,
    creationTime: proposal.submit_time,
    status: proposal.proposal_status,
    statusBeginTime: proposalBeginTime(proposal),
    statusEndTime: proposalEndTime(proposal),
    tally: tallyReducer(proposal, totalBondedTokens),
    deposit: getDeposit(proposal, 'stake')
  }
}

function validatorReducer(validator) {
  return {
    networkId: NETWORK_ID,
    operator_address: validator.operator_address,
    consensus_pubkey: validator.consensus_pubkey,
    jailed: validator.jailed,
    status: validator.status,
    tokens: validator.tokens,
    moniker: validator.description.moniker,
    votingPower: validator.voting_power,
    startHeight: validator.signing_info
      ? validator.signing_info.start_height
      : undefined,
    identity: validator.description.identity,
    website: validator.description.website,
    details: validator.description.details,
    bond_height: validator.bond_height,
    bond_intra_tx_counter: validator.bond_intra_tx_counter,
    unbonding_height: validator.unbonding_height,
    unbonding_time: validator.unbonding_time,
    rate: validator.rate,
    max_rate: validator.max_rate,
    max_change_rate: validator.max_change_rate,
    update_time: validator.update_time,
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
    denom: balance.denom,
    amount: balance.amount
  }
}

function delegationReducer(delegation) {
  return {
    delegatorAddress: delegation.delegator_address,
    validatorAddress: delegation.validator_address,
    amount: delegation.balance
  }
}

module.exports = {
  proposalReducer,
  tallyReducer,
  validatorReducer,
  blockReducer,
  balanceReducer,
  delegationReducer
}
