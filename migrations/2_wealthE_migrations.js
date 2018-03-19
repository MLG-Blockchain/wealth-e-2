var WealthE = artifacts.require("./WealthE.sol");
var WealthECrowdsale = artifacts.require("./WealthECrowdsale.sol");
var TokenTimelock = artifacts.require("./TokenTimelock.sol");

module.exports = async function(deployer) {
  await deployer.deploy(WealthE);
  await deployer.deploy(WealthECrowdsale, WealthE.address);
  await deployer.deploy(TokenTimelock, WealthE.address)
};
