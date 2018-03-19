pragma solidity ^0.4.18;


import 'zeppelin-solidity/contracts/token/ERC20/MintableToken.sol';
import 'zeppelin-solidity/contracts/token/ERC20/PausableToken.sol';
import 'zeppelin-solidity/contracts/ownership/Claimable.sol';

contract WealthE is MintableToken, PausableToken, Claimable {

    /*----------- ERC20 GLOBALS -----------*/

    string public constant name = "Wealth-E";
    string public constant symbol = "WRE";
    uint8 public constant decimals = 18;


    /*----------- Ownership Reclaim -----------*/

    address public reclaimableOwner;

    /**
     * @dev Restricts method call to only the address set as `reclaimableOwner`.
     */
    modifier onlyReclaimableOwner() {
        require(msg.sender == reclaimableOwner);
        _;
    }


    /**
     * @dev Sets the reclaim address to current owner.
     */
    function setupReclaim() public onlyOwner {
        require(reclaimableOwner == address(0));

        reclaimableOwner = msg.sender;
    }


    /**
     * @dev Resets the reclaim address to address(0).
     */
    function resetReclaim() public onlyReclaimableOwner {
        reclaimableOwner = address(0);
    }


    /**
     * @dev Failsafe to reclaim ownership in the event crowdsale is unable to
     *      return ownership. Reclaims ownership regardless of
     *      pending ownership transfer.
     */
    function reclaimOwnership() public onlyReclaimableOwner {

        // Erase any pending transfer.
        pendingOwner = address(0);

        // Transfer ownership.
        OwnershipTransferred(owner, reclaimableOwner);
        owner = reclaimableOwner;

        // Reset reclaimableOwner.
        reclaimableOwner = address(0);

    }

}
