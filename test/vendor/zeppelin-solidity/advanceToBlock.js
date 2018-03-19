const providers = require('ethers').providers;
const provider = new providers.JsonRpcProvider('http://localhost:8545/');

export function advanceBlock() {
    return provider.send('evm_mine');
}

// Advances the block number so that the last mined block is `number`.
export default async function advanceToBlock(number) {
    const blockNum = await provider.getBlockNumber();
    if (blockNum > number) {
        throw Error(`block number ${number} is in the past (current is ${web3.eth.blockNumber})`)
    }

    while (blockNum < number) {
        await advanceBlock()
    }
}
