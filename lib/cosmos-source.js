const { RESTDataSource } = require("apollo-datasource-rest");
const {
  proposalReducer,
  validatorReducer,
  blockReducer
} = require("./reducers");

class CosmosAPI extends RESTDataSource {
  constructor(baseURL) {
    super();
    this.baseURL = baseURL;
    this.initialize({});
  }

  async getAllProposals() {
    const response = await this.get("gov/proposals");
    return Array.isArray(response)
      ? response.map(proposal => proposalReducer(proposal))
      : [];
  }

  async getAllValidators() {
    const response = await this.get("staking/validators");
    return Array.isArray(response)
      ? response.map(validator => validatorReducer(validator))
      : [];
  }

  async getValidatorByAddress({ address }) {
    const response = await this.get(`staking/validators/${address}`);
    return validatorReducer(response);
  }

  async getProposalById({ proposalId }) {
    const response = await this.get(`gov/proposals/${proposalId}`);
    return proposalReducer(response);
  }

  async getBlockByHeight({ blockHeight }) {
    let response;
    if (blockHeight) {
      response = await this.get(`blocks/${blockHeight}`);
    } else {
      response = await this.get(`blocks/latest`);
    }
    return blockReducer(response);
  }
}

module.exports = CosmosAPI;
