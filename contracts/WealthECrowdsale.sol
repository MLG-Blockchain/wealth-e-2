pragma solidity ^0.4.18;

import 'zeppelin-solidity/contracts/lifecycle/Pausable.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import './WealthE.sol';
import './TokenTimelock.sol';

contract WealthECrowdsale is Pausable {

    using SafeMath for uint256;

    /*----------- Global Constants -----------*/

    uint256 public constant END_TIME = 1526947140;                             // Monday, May 21, 2018 11:59:00 PM GMT crowdsale end time in seconds.
    uint256 public constant PUBLIC_START_TIME = 1522915200;                    // Thursday, April 5, 2018 8:00:00 AM GMT full public sale start time in seconds.
    uint256 public constant GRAINS = 10 ** 18;                                 // WealthE Tokens expressed in smallest denomination.
    uint256 public constant TOTAL_SALE_TOKENS = 300 * (10 ** 6) * (GRAINS);    // Total tokens for sale during crowdsale expressed in grains.
    uint256 public constant TEAM_TOKENS = 120 * (10 ** 6) * GRAINS;            // Team tokens, locked for 6 months.
    uint256 public constant NETWORK_GROWTH_TOKENS = 60 * (10 ** 6) * GRAINS;   // Network growth tokens, unlocked.
    uint256 public constant RESERVE_TOKENS = 120 * (10 ** 6) * GRAINS;         // Reserve tokens, unlocked.

    /*----------- Global Variables -----------*/

    // Token per ETH rate.
    uint256 public rate;
    bool public rateSet = false;

    // Hardcap expressed in wei.
    uint256 public cap;
    bool public capSet = false;

    // Timelock address.
    address public timelockAddress;
    bool public timelockAddressSet = false;
    bool public timelockOwnershipClaimed = false;

    // Cumulative tracking variable.
    uint256 public weiRaised;
    uint256 public tokensDistributed;

    // Owner can trigger an early end.
    bool ownerEnded = false;

    // Date to begin full sale.
    uint256 public fullSaleStart = PUBLIC_START_TIME;

    /*----------- Global Address Vairables -----------*/

    // Recipient of the ETH funds collected.
    address public multiSig = 0x4DE203840484767a4ba972c202E835Cc23Fb14D2;
    bool public multiSigSet = true;

    address public teamTokenAddress = 0xc9Dbf8A53630F6F2Ae9De33778F5c77993DD4cF5;
    address public reserveTokenAddress = 0x022C77A3Fb7CB7A654bCdb9467E6175a07fC5162;
    address public networkGrowthTokenAddress = 0xE345a65989D881C7BF40e7995A38785379dF9CEB;

    /*----------- Global Whitelist Variables -----------*/

    uint256 public defaultWhitelistCap = 0;
    mapping(address => uint256) public addressWhitelistCap;
    mapping(address => uint256) public addressWhitelistUsed;

    /*----------- Interfaces -----------*/

    WealthE public token;
    TokenTimelock public tokenTimelock;

    /*----------- Events -----------*/
    /**
     * @dev event for token purchase logging
     * @param purchaser who paid for and received the tokens
     * @param value weis paid for purchase
     * @param amount amount of tokens purchased
     */
    event LogTokenPurchase(address indexed purchaser, uint256 value, uint256 amount);

    /**
     * @dev event for whitelist update logging
     * @param purchaser who is eligible to purchase tokens
     * @param whitelistCap individual cap set in wei
     */
    event LogWhitelistUpdate(address indexed purchaser, uint256 whitelistCap);

    /*----------- Constructor -----------*/
    function WealthECrowdsale(WealthE _token)
        public
    {
        require(_token != WealthE(0));

        token = _token;
    }

    /*----------- Modifiers -----------*/
    /**
     *
     * @dev Ensures multisig beneficiary address is set.
     *
     */
    modifier multiSigIsSet() {
        require(multiSigSet);
        _;
    }

    /**
     *
     * @dev Ensures the Token per ETH rate is set.
     *
     */
    modifier rateIsSet() {
        require(rateSet);
        _;
    }

    /**
     *
     * @dev Ensures the ETH hardcap is set.
     *
     */
    modifier capIsSet() {
        require(capSet);
        _;
    }

    /**
     *
     * @dev Ensures the token timelock address is set.
     *
     */
    modifier timelockAddressIsSet() {
        require(timelockAddressSet);
        _;
    }

    /*----------- Public Methods -----------*/
    /**
     * @dev Fallback method is the primary method for participants to interact
     *      with the sale.
     */
    function () public payable {
        buyTokens();
    }

    /*----------- Owner: Variable Setters -----------*/
    /**
     * @dev Allows owner to move the start date ahead.
     * @param _newStartDate New full sale start date in Unix time (seconds).
     */
    function setSaleStart(uint256 _newStartDate) public onlyOwner {
        // Trigger earlt fullSaleStart.
        require(_newStartDate < fullSaleStart && fullSaleStart > now);
        fullSaleStart = _newStartDate;
    }

    /**
     * @dev Allows owner to set the multiSig (i.e. beneficiary) address.
     *      To maintain trustlessness, the address can only be set one time.
     * @param _multiSig The multiSig address to receive proceeds of the sale.
     */
    function setMultiSig(address _multiSig) public onlyOwner {
        require(!multiSigSet);
        require(_multiSig != address(0));
        require(_multiSig != address(this));

        multiSigSet = true;
        multiSig = _multiSig;
    }

    /**
     * @dev Allows owner to set the Tokens per ETH rate (in grains per wei).
     *      To maintain trustlessness, the rate can only be set one time.
     * @param _rate The Tokens per ETH rate.
     */
    function setRate(uint256 _rate) public onlyOwner {
        require(!rateSet);
        require(_rate > 0);

        rateSet = true;
        rate = _rate;
    }

    /**
     * @dev Allows owner to set the hard cap (denoted in wei).
     *      To maintain trustlessness, the cap can only be set one time.
     * @param _cap The ETH hardcap expressed in wei.
     */
    function setCap(uint256 _cap) public onlyOwner {
        require(!capSet);
        require(_cap > 0);

        capSet = true;
        cap = _cap;
    }

    /**
     * @dev Allows owner to set the timelock address.
     *      The cap can only be set one time.
     * @param _timelockAddress The address of the token timelock contract.
     */
    function setTimelockAddress(address _timelockAddress) public onlyOwner {
        require(!timelockAddressSet);
        require(_timelockAddress != address(0));
        require(_timelockAddress != address(this));

        timelockAddressSet = true;
        timelockAddress = _timelockAddress;
        tokenTimelock = TokenTimelock(_timelockAddress);
    }

    /**
     * @dev Allows owner to set the default cap for whitelisted
     *      participants (denoted in wei).
     *      Whitelist cap can be set and reset multiple times.
     * @param _whitelistCap The ETH cap for individual whitelisted participants
     *             expressed in wei.
     */
    function setDefaultWhitelistCap(uint256 _whitelistCap) public onlyOwner {
        defaultWhitelistCap = _whitelistCap;
    }

    /*----------- Owner: Claim Token & Timelock -----------*/
    /**
     * @dev Claim ownership of claimable token.
     */
    function claimTokenOwnership() public onlyOwner {
        token.claimOwnership();
    }

    /**
     * @dev Claim ownership of claimable timelock.
     */
    function claimTimelockOwnership()
        public
        timelockAddressIsSet
        onlyOwner
    {
        require(!timelockOwnershipClaimed);

        // Claim ownership.
        tokenTimelock.claimOwnership();
        timelockOwnershipClaimed = true;

        // Send allocations.
        // Team Tokens sent to vault.
        require(token.mint(timelockAddress, TEAM_TOKENS));
        tokenTimelock.depositTokens(teamTokenAddress, TEAM_TOKENS);

        // Network Growth Tokens.
        assert(token.mint(networkGrowthTokenAddress, NETWORK_GROWTH_TOKENS));

        // Reserve Tokens.
        assert(token.mint(reserveTokenAddress, RESERVE_TOKENS));
    }

    /*----------- Owner: Presale Transfers -----------*/
    /**
     * @dev Send tokens to presale participants.
     * @param _address Address of token recipient.
     * @param _tokenAmount Amount of tokens to send in grains.
     */
    function mintPresaleTokens(address _address, uint256 _tokenAmount)
        public
        onlyOwner
        timelockAddressIsSet
        returns (bool)
    {
        require(_address != address(0));
        require(_address != address(this));
        require(_address != multiSig);

        tokensDistributed = tokensDistributed.add(_tokenAmount);
        require(tokensDistributed <= TOTAL_SALE_TOKENS);

        // Send tokens to Timelock contract and then register address as beneficiary there.
        require(token.mint(timelockAddress, _tokenAmount));
        tokenTimelock.depositTokens(_address, _tokenAmount);

        return true;
    }

    /**
     * @dev Send tokens to presale participants in batches.
     *      Be aware of transaction and block gas limits.
     * @param _addresses Array of token recipient addresses.
     * @param _tokenAmounts Array of tokens amounts to send (in grains).
     */
    function mintPresaleTokensBatch(address[] _addresses, uint256[] _tokenAmounts)
        public
        onlyOwner
        returns (bool)
    {
        require(_addresses.length > 0);
        require(_addresses.length == _tokenAmounts.length);

        for (uint256 i = 0; i < _addresses.length; i++) {
            require(mintPresaleTokens(_addresses[i], _tokenAmounts[i]));
        }

        return true;
    }

    /*----------- Owner: Whitelist -----------*/
    /**
     * @dev Set whitelist cap for a single purchaser.
     * @param _purchaser Address of purchaser.
     * @param _whitelistCap Purchaser's cap set in wei
     *             or set to 1 to defer to defaultWhitelistCap.
     */
    function setWhitelistAddress(address _purchaser, uint256 _whitelistCap)
        public
        onlyOwner
        returns (bool)
    {
        addressWhitelistCap[_purchaser] = _whitelistCap;
        LogWhitelistUpdate(_purchaser, _whitelistCap);

        return true;
    }

    /**
     * @dev Set whitelist cap for multiple purchasers.
     * @param _purchasers Address array of purchaser.
     * @param _whitelistCaps Cap array in wei or set to 1 to defer to defaultWhitelistCap.
     */
    function setWhitelistAddressBatch(address[] _purchasers, uint256[] _whitelistCaps)
        public
        onlyOwner
        returns (bool)
    {
        require(_purchasers.length > 0);
        require(_purchasers.length == _whitelistCaps.length);

        for (uint256 i = 0; i < _purchasers.length; i++) {
            require(setWhitelistAddress(_purchasers[i], _whitelistCaps[i]));
        }

        return true;
    }

    /*----------- Owner: Finalization -----------*/
    /**
     * @dev Owner can trigger an early end to the sale.
     */
    function endSale() public onlyOwner {
        ownerEnded = true;
    }

    /**
     * @dev Finalization method to transfer token ownership back to owner.
     */
    function finalize() public onlyOwner returns (bool) {
        require(hasEnded());

        // Transfer token ownership.
        token.transferOwnership(msg.sender);
    }

    /*----------- Constant Methods -----------*/
    /**
     * @dev Allows purchasers and applications to view current caps by address.
     *      A cap set to 1 defers to the default cap, otherwise the cap set
     *      in `addressWhitelistCap` is returned.
     * @param _purchaser Address to get cap.
     */
    function getWhitelistCap(address _purchaser) public view returns (uint256) {
        uint256 whitelistCap = addressWhitelistCap[_purchaser];

        // whitelistCap of 1 defers to the `defaultWhitelistCap`.
        if (whitelistCap == 1) {
            whitelistCap = defaultWhitelistCap;
        }

        return whitelistCap;
    }

    /**
     * @dev Determine how much wei an address is permitted to contribute.
     * @param _purchaser the address to look up permitted amount.
     */
    function whitelistPermittedAmount(address _purchaser) public view returns (uint256) {
        // Individual purchaser cap.
        uint256 purchaserCap = getWhitelistCap(_purchaser);

        // Subtract portion of cap they have already used.
        return purchaserCap.sub(addressWhitelistUsed[_purchaser]);
    }

    /**
     * @dev Determines bonus in terms of wei.
     * @param _wei amount of wei contributed.
     */
    function fullsaleBonusWei(uint256 _wei) public view returns (uint256) {
        uint256 bonus = 0;
        uint256 twoDigitPercent = 10 ** 16;

        if (now <= fullSaleStart + 1 hours) {
            // 30% in first hour.
            bonus = _wei.mul(30).mul(twoDigitPercent).div(GRAINS);
        } else if (now <= fullSaleStart + 1 days) {
            // 25% in first day.
            bonus = _wei.mul(25).mul(twoDigitPercent).div(GRAINS);
        } else if (now <= fullSaleStart + 4 days) {
            // 20% within first 4 days.
            bonus = _wei.mul(20).mul(twoDigitPercent).div(GRAINS);
        } else if (now <= fullSaleStart + 1 weeks) {
            // 15% within fist week.
            bonus = _wei.mul(15).mul(twoDigitPercent).div(GRAINS);
        } else if (now <= fullSaleStart + 3 weeks) {
            // 10% within first 3 weeks.
            bonus = _wei.mul(10).mul(twoDigitPercent).div(GRAINS);
        } else if (now <= fullSaleStart + 5 weeks) {
            // 5% within first 5 weeks.
            bonus = _wei.mul(5).mul(twoDigitPercent).div(GRAINS);
        }

        return bonus;
    }

    // @return true if crowdsale event has ended
    function hasEnded() public view returns (bool) {
        return now > END_TIME || ownerEnded;
    }

    // @return true if the transaction can buy tokens
    function validPurchase() internal view returns (bool) {
        bool withinPeriod = now >= fullSaleStart && now <= END_TIME;
        bool nonZeroPurchase = msg.value != 0;
        return withinPeriod && nonZeroPurchase && !ownerEnded;
    }

    /*----------- Internal Methods -----------*/
    /**
     * @dev Trades ETH for tokens.
     *      Modified from zeppelin-solidity implementation to restrict purchases
     *      to KYC list, to handle bonuses, and track tokens distributed.
     */
    function buyTokens()
        internal
        multiSigIsSet
        capIsSet
        rateIsSet
        whenNotPaused
        returns (bool)
    {
        require(validPurchase());

        // Check whitelist for permitted contribution amount.
        uint256 permittedWei = whitelistPermittedAmount(msg.sender);
        uint256 weiAmount = msg.value;
        require(weiAmount <= permittedWei);

        // Update amount of whitelist cap used.
        addressWhitelistUsed[msg.sender] = addressWhitelistUsed[msg.sender].add(weiAmount);

        // Calculate token amount to be created.
        uint256 tokens = weiAmount.mul(rate);

        // Calculate bonus.
        uint256 bonusTokens = fullsaleBonusWei(weiAmount).mul(rate);
        uint256 tokensPurchased = tokens.add(bonusTokens);

        // Update tracking state.
        weiRaised = weiRaised.add(weiAmount);
        tokensDistributed = tokensDistributed.add(tokensPurchased);

        // Check contribution is within total cap
        // and tokens are within token cap.
        require(weiRaised <= cap);
        require(tokensDistributed <= TOTAL_SALE_TOKENS);

        // Deliver tokens.
        assert(token.mint(msg.sender, tokensPurchased));
        LogTokenPurchase(msg.sender, weiAmount, tokensPurchased);

        // Immediately send ETH to multiSig address.
        forwardFunds();

        return true;
    }

    /**
     * @dev Forwards funds collected to secure multiSig wallet.
     */
    function forwardFunds() internal multiSigIsSet {
        multiSig.transfer(msg.value);
    }
}
