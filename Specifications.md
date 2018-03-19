# Token Contract

The token will be an ERC-20 compliant token on the Ethereum blockchain.

## Token Properties

Name: Wealth-E

Symbol: WRE

Decimals: 18

- [x] test coverage complete


## Token Methods

Is Pausable. The owner address can pause and unpause token transfers.

Is claimable. Ownership transfers must be claimed but recipient address as a safeguard.

Is reclaimable. The owner can activate a reclaim process prior to transferring ownership. To be used as a failsafe in the event the crowdsale cannot transfer ownership back.

Fixed supply (revoke minting ability after crowdsale).

- [x] test coverage complete


# Crowdsale Contract

The crowdsale contract is for the presale and full public sale.
Presale tokens are distributed manually by the contract owner.
The full public sale exchanges tokens for ETH.


## Key Dates

Full public sale start: Wednesday, April 5, 2018 8:00:00 AM GMT

Full public sale end: Monday, May 21, 2018 11:59:00 PM GMT

Owner is permitted to close the sale early.

- [x] test coverage complete


## Crowdsale Methods

Is Pausable. The owner address can pause and unpause the crowdsale at anytime. Unpausing after the sale has closed will not permit the sale to continue.

- [x] test coverage complete


## Funds collected

Funds collected are to be stored in a multisig wallet `0x4de203840484767a4ba972c202e835cc23fb14d2`. As such, the crowdsale contract allows for a one time setting of multisig address.

The crowdsale contract forwards funds to multisig upon receipt.

- [x] test coverage complete


## Caps

The crowdsale will have a firm cap set in ETH. The hardcap is to be converted from USD to ETH prior to the sale commencing and set using `setCap`. Hardcap setter allows a one time setting of that hard cap (ETH equivalent of USD hardcap)

In addition to the ETH hardcap, no more than `300 million` tokens are to be sold in this sale.

- [x] test coverage complete


## Distribution

Addresses and vesting required for reserve, team, and network growth unless handled outside of the smart contract.

  - Crowdsale: 50% (300 million WRE)
  - Reserve 20% (120 million WRE) `0x022c77a3fb7cb7a654bcdb9467e6175a07fc5162`
  - Team 20% (120 million WRE) `0xc9dbf8a53630f6f2ae9de33778f5c77993dd4cf5`
  - Network Growth 10% (60 million WRE) `0xe345a65989d881c7bf40e7995a38785379df9ceb`

- [x] test coverage complete


## Whitelist

For KYC/AML compliance crowdsale contributors must be whitelisted to participate. The whitelist consists of an address and a permitted contribution amount. To defer to the default permitted amount addresses will be approved with a value of `1` otherwise a value denoted in `wei` is to be indicated.

The contract owner may add users to the whitelist at any time, and may change the permitted contribution amount at any time.

The smart contract will reject contributions from addresses not included in the whitelist.

- [x] test coverage complete


## Presale Token Issuance

Tokens are distributed to a timelock valut as each contribution takes place. Token are availalbe for withdrawl on or after Wednesday, November 21, 2018 12:00:00 AM GMT.

- [x] test coverage complete

## Token Issuance

Tokens are distributed as each contribution takes place. However, tokens are to be manually locked until the completion of the full public sale. To be manually unlocked by owner.

- [x] test coverage complete


## Rates

Initial price to be the ETH equivalent of USD $0.10. Test cases assume $1200 USD per ETH.

Initial rate is 12,000 WRE per ETH.


### Full Sale Bonuses

1. Hour 1: 30%
2. Day 1: 25%
3. Day 2-4: 20%
4. Week 1: 15%
5. Week 2-3: 10%
6. Week 4-5: 5%
7. Week 6: 0%

- [x] test coverage complete

## Finalize

Transfer ownership back to owner.

- [x] test coverage complete