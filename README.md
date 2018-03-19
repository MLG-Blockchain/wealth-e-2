# WealthMigrate Token and Crowdsale Contracts


## Requirements

```{sh}
Truffle v4.0.1 (core: 4.0.1)
Solidity v0.4.18 (solc-js)
Ganache CLI v6.0.3 (ganache-core: 2.0.2)
```


## Setup

```{sh}
$ yarn
```

## Testing

```
$ npm run ganache-cli
$ truffle test
```

Note: Crowdsale contract tests shift ganache time forward. To test multiple times, restart ganache.

## Testnet Testing

```
$ truffle migrate --network rinkeby
```

Then confirm the correct network addresses appear in the `build/contracts/` directory (manual update needed for WealthECrowdsale.json and TokenTimelock.json)

```
$ truffle exec initContracts.js --network rinkeby
```

### Debugging

If encounter `Error: Invalid number of arguments to Solidity function` run `npm run clean` to remove the build directory and rerun the above testing commands.


## Deployment steps

#### Covered by truffle migrate

  1. Launch both the token and the crowdsale contracts to the public blockchain.
  2. Launch the timelock contract.

#### Covered by initContracts.js

  3. Pause token transfers.
  4. Transfer ownership of the timelock contract to the crowdsale contract.
  5. Set the timelock address on the crowdsale contract.

#### Requires manual execution

  6. Call `setUpReclaim` as a safeguard on the token contract.
  7. Transfer ownership of the token to the crowdsale contract for minting purposes.
  8. Call `claimTokenOwnership` on the crowdsale contract to complete the token contract ownership transfer.
  9. Call `claimTimelockOwnership` on the crowdsale contract to complete the timelock contract ownership transfer (NOTE: must be completed after token contract is owned by crowdsale).
  10. Set the tokens per ETH rate.
  11. Set the sale hardcap.
  12. Set the setDefaultWhitelistCap.
  13. Set whitelist participant addresses and approved amounts.

## Finalization

  1. Calling the `finalize` method transfers ownership of token back to crowdsale contract owner.
  2. IMPORTANT: The contract owner must claim the token with `claimOwnership` for the transfer of ownership to be complete.

The token ownerwill be responsible for removing the ability to mint further tokens.
