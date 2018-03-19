const ethers = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545/');

// Returns the time of the last mined block in seconds
export default async function latestTime() {
    const lastBlockNumber = await provider.getBlockNumber();
    const lastBlock = await provider.getBlock(lastBlockNumber);
    return lastBlock.timestamp;
}
