require('babel-register');
require('babel-polyfill');
const HDWalletProvider = require("truffle-hdwallet-provider");
// this is just a mnemonic used on ropsten for testing
// clearly do not push a mainnet mnemonic phrase!
const mnemonic = "clump cargo cage cage ensure gift name noble pill churn hour buzz photo common final vital lizard expose distance gaze can brief anger talent"

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    ropsten: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "https://ropsten.infura.io/P02k0Sd9DICxikYWGSpK")
      },
      gas: 6e6,
      network_id: 3
    },
    rinkeby: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "https://rinkeby.infura.io/P02k0Sd9DICxikYWGSpK")
      },
      gas: 6e6,
      network_id: 4
    },
    development: {
      host: "localhost",
      port: 8545,
      gas: 6e6,
      network_id: "*" // Match any network id
    }
  }
};
