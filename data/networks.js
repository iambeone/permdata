const networks = [
  {
    action_claim_rewards: false,
    action_delegate: false,
    action_deposit: false,
    action_proposal: false,
    action_redelegate: false,
    action_send: false,
    action_undelegate: false,
    action_vote: false,
    api_url: "https://gaia-13006.lunie.io",
    bech32_prefix: "cosmos",
    chain_id: "gaia-13006",
    experimental: true,
    feature_activity: false,
    feature_explorer: false,
    feature_portfolio: false,
    feature_proposals: false,
    feature_session: true,
    feature_validators: true,
    id: "gaia-testnet",
    logo_url: "https://s3.amazonaws.com/network.logos/cosmos-logo.png",
    rpc_url: "https://gaia-13006.lunie.io:26657",
    testnet: true,
    title: "Gaia Testnet"
  },
  {
    action_claim_rewards: true,
    action_delegate: true,
    action_deposit: true,
    action_proposal: true,
    action_redelegate: true,
    action_send: true,
    action_undelegate: true,
    action_vote: true,
    api_url: "https://stargate.cosmos.network",
    bech32_prefix: "cosmos",
    chain_id: "cosmoshub-2",
    experimental: true,
    feature_activity: true,
    feature_explorer: true,
    feature_portfolio: true,
    feature_proposals: true,
    feature_session: true,
    feature_validators: true,
    id: "cosmoshub",
    logo_url: "https://s3.amazonaws.com/network.logos/cosmos-logo.png",
    rpc_url: "https://stargate.lunie.io:26657",
    testnet: false,
    title: "Cosmos Hub"
  }
];

function getNetworks() {
  return networks;
}

module.exports = {
  getNetworks
};
