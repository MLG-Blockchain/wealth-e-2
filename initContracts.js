const contract = require('truffle-contract');
const WealthECrowdsale = artifacts.require('./WealthECrowdsale.sol');
const WealthE = artifacts.require("./WealthE.sol");
const TimelockArtifact = artifacts.require("./TokenTimelock.sol");

let token;
let crowdsale;
let timelock;

module.exports = async function(callback) {
    token = await WealthE.deployed();
    crowdsale = await WealthECrowdsale.deployed();
    timelock = await TimelockArtifact.deployed();

    await token.pause();
    await timelock.transferOwnership(crowdsale.address);
    await crowdsale.setTimelockAddress(timelock.address);
    // await crowdsale.claimTimelockOwnership();
}