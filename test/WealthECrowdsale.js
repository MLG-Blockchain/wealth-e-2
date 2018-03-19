import { advanceBlock } from './vendor/zeppelin-solidity/advanceToBlock';
import { increaseTime, increaseTimeTo, duration } from './vendor/zeppelin-solidity/increaseTime';
import latestTime from './vendor/zeppelin-solidity/latestTime';
import { assertError } from './utils';
import assertRevert from './helpers/assertRevert';

const WealthECrowdsale = artifacts.require('./WealthECrowdsale.sol');
const WealthE = artifacts.require("./WealthE.sol");
const TimelockArtifact = artifacts.require("./TokenTimelock.sol");

const ethers = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545/');

const { toWei, fromWei } = web3._extend.utils;

const BigNumber = require('bignumber.js');


// Date Utils.
Date.prototype.getUnixTime = function() { return this.getTime()/1000|0 };
if(!Date.now) Date.now = function() { return new Date(); }
Date.time = function() { return Date.now().getUnixTime(); }


const million = 1e6;
let token;
let owner;
let crowdsale;
let batchAddresses;
let batchAmounts;
const multiSig = '0x4de203840484767a4ba972c202e835cc23fb14d2';
const teamTokenAddress = '0xc9dbf8a53630f6f2ae9de33778f5c77993dd4cf5';
const reserveFundAddress = '0x022c77a3fb7cb7a654bcdb9467e6175a07fc5162';
const networkGrowthAddress = '0xe345a65989d881c7bf40e7995a38785379df9ceb';
const globalRate = 7000;
const globalTokenCap = 300 * million;
const globalPresaleMinETH = 41;
const fullsaleBonuses = [1, 1.05, 1.10, 1.15, 1.20, 1.25, 1.30];
const publicStartTime = new Date('Thurs, 5 Apr 2018 08:00:00 GMT').getUnixTime();
const endTime = new Date('Mon, 21 May 2018 23:59:00 GMT').getUnixTime();
const timelockRelease = new Date('Wed 21 Nov 2018 00:00:00 GMT').getUnixTime();

let newStartTime = new Date().getUnixTime();

const getBonusDates = (d) => {
    return [
        // First hour.
        d,
        // First day.
        d + 7200,
        // First 2 - 4 days.
        d + 172801,
        // First week (+ 5 days).
        d + 432001,
        // Second week (+ 7 days).
        d +  604801,
        // Fourth week.
        d + 1814401,
        // Sixth week.
        d + 3628801
    ];
};

const fullSaleDates = getBonusDates(publicStartTime);

contract('WealthECrowdsale', (accounts) => {

    before(async () => {

        owner = accounts[0];
        batchAddresses = accounts.slice(10, 15);
        // All amounts converted to wei with the exception of index 0.
        // The purpse of this is to use 1 as a flag to defer to the
        // defaultWhitelistCap.
        batchAmounts = [1, 20, 30, 40, 50].map(x => x === 1 ? 1 : toWei(x));
        token = await WealthE.new({ from: owner });
        crowdsale = await WealthECrowdsale.new(token.address, { from: owner, gas: 4000000 });

        // Advance to the next block to correctly read time in
        // the solidity "now" function interpreted by testrpc
        await advanceBlock();
    });

    describe('Contract Specs', () => {
        it('should have correct dates, grains, and allocations set', async () => {

            const end = await crowdsale.END_TIME();
            const publicStart = await crowdsale.PUBLIC_START_TIME();
            const fullSaleStart = await crowdsale.fullSaleStart();
            const grains = await crowdsale.GRAINS();
            const totalSaleTokens = await crowdsale.TOTAL_SALE_TOKENS();
    
            assert.strictEqual(end.toNumber(), endTime);
            assert.strictEqual(publicStart.toNumber(), publicStartTime);
            assert.strictEqual(fullSaleStart.toNumber(), publicStartTime);
            assert.strictEqual(parseInt(fromWei(grains)), 1);
            assert.strictEqual(parseInt(fromWei(totalSaleTokens)), globalTokenCap);
        });
    });



    /*----------- MultiSig Wallet Setter -----------*/

    describe('Multisig', () => {
    
        it('should fail to set multisig address when multisig already set', async () => {

            const multiSigIsSet = await crowdsale.multiSigSet();
            assert.isTrue(multiSigIsSet);
    
            let multiSigAddress = await crowdsale.multiSig();
            assert.strictEqual(multiSigAddress, multiSig)
    
            try {
                await crowdsale.setMultiSig(multiSig, { from: owner });
            } catch (error) {
                assertError(error);
            }
    
            multiSigAddress = await crowdsale.multiSig();
            assert.strictEqual(multiSigAddress, multiSig);
    
        });
    });


    /*----------- Rate Setter -----------*/

    describe('Rate Setter', () => {
        it('should fail to set rate when rate is not greater than 0', async () => {
            try {
                await crowdsale.setRate(0, { from: owner });
            } catch (error) {
                assertError(error);
            }
    
            const rateIsSet = await crowdsale.rateSet();
            assert.isFalse(rateIsSet);
        });
    
    
        it('should fail to set rate when called by an address other than owner', async () => {
            try {
                await crowdsale.setRate(100, { from: accounts[3] });
            } catch (error) {
                assertError(error);
            }
    
            const rateIsSet = await crowdsale.rateSet();
            assert.isFalse(rateIsSet);
        });
    
    
        it('should fail to set rate when rate already set', async () => {
    
            await crowdsale.setRate(100, { from: owner });
    
            const rateIsSet = await crowdsale.rateSet();
            assert.isTrue(rateIsSet);
    
            let rate = await crowdsale.rate();
            assert.strictEqual(rate.toNumber(), 100)
    
            try {
                await crowdsale.setRate(200, { from: owner });
            } catch (error) {
                assertError(error);
            }
    
            rate = await crowdsale.rate();
            assert.strictEqual(rate.toNumber(), 100)
    
        });
    });


    /*----------- Cap Setter -----------*/

    describe('Cap Setter', () => {
        it('should fail to set cap when cap is not greater than 0', async () => {
            try {
                await crowdsale.setCap(0, { from: owner });
            } catch (error) {
                assertError(error);
            }
    
            const capIsSet = await crowdsale.capSet();
            assert.isFalse(capIsSet);
        });
    
    
        it('should fail to set cap when called by an address other than owner', async () => {
            try {
                await crowdsale.setCap(100, { from: accounts[3] });
            } catch (error) {
                assertError(error);
            }
    
            const capIsSet = await crowdsale.capSet();
            assert.isFalse(capIsSet);
        });
    
    
        it('should fail to set cap when cap already set', async () => {
    
            await crowdsale.setCap(100, { from: owner });
    
            const capIsSet = await crowdsale.capSet();
            assert.isTrue(capIsSet);
    
            let cap = await crowdsale.cap();
            assert.strictEqual(cap.toNumber(), 100)
    
            try {
                await crowdsale.setCap(200, { from: owner });
            } catch (error) {
                assertError(error);
            }
    
            cap = await crowdsale.cap();
            assert.strictEqual(cap.toNumber(), 100)
    
        });
    });


    /*----------- Timelock Wallet Setter -----------*/

    describe('Timelock', () => {
    
        let timelock;
        
        before(async function () {
            timelock = await TimelockArtifact.new(token.address, { from: owner });
        });

        it('should fail to set timelock address when invalid address is used', async () => {

            await assertRevert( crowdsale.setTimelockAddress(0x0, { from: owner }));
    
            const timelockIsSet = await crowdsale.timelockAddressSet();
            assert.isFalse(timelockIsSet);
        });
    
    
        it('should fail to set timelock address when called by an address other than owner', async () => {

            await assertRevert(crowdsale.setTimelockAddress(timelock.address, { from: accounts[3] }));
    
            const timelockIsSet = await crowdsale.timelockAddressSet();
            assert.isFalse(timelockIsSet);
        });
    
    
        it('should fail to set timelock address when timelock already set', async () => {
    
            await crowdsale.setTimelockAddress(timelock.address, { from: owner });
    
            const timelockIsSet = await crowdsale.timelockAddressSet();
            assert.isTrue(timelockIsSet);
    
            let timelockAddress = await crowdsale.timelockAddress();
            assert.strictEqual(timelockAddress, timelock.address)
    
            await assertRevert(crowdsale.setTimelockAddress(timelock.address, { from: owner }));
    
            timelockAddress = await crowdsale.timelockAddress();
            assert.strictEqual(timelockAddress, timelock.address);
    
        });
    
    });
    

    /*----------- Whitelist -----------*/

    describe('Whitelist', () => {
        it('should fail set to defaultWhitelistCap when called by an address other than owner', async () => {
            try {
                await crowdsale.setDefaultWhitelistCap(
                    toWei(30303),
                    { from: accounts[3] }
                );
            } catch (error) {
                assertError(error);
            }
    
            const whitelistCap = await crowdsale.defaultWhitelistCap();
            assert.strictEqual(parseInt(fromWei(whitelistCap)), 0);
        });
    
    
        it('should set defaultWhitelistCap when called by owner', async () => {
    
            await crowdsale.setDefaultWhitelistCap(
                toWei(30303),
                { from: owner }
            );
    
            const whitelistCap = await crowdsale.defaultWhitelistCap();
            assert.strictEqual(parseInt(fromWei(whitelistCap)), 30303);
        });
    
    
        it('Whitelist: it should fail if called by address other than owner', async () => {
    
            try {
                await crowdsale.setWhitelistAddress(
                    accounts[0],
                    toWei(30303),
                    { from: accounts[3] }
                );
            } catch (error) {
                assertError(error);
            }
    
            // Confirm no whitelist update took place.
            const whitelistCap = await crowdsale.getWhitelistCap(accounts[0]);
            assert.strictEqual(parseInt(fromWei(whitelistCap)), 0);
    
        });
    
    
        it('Whitelist: it should update individual caps', async () => {
    
            await crowdsale.setWhitelistAddress(
                accounts[1],
                toWei(100),
                { from: owner }
            );
    
            // Confirm no whitelist update took place.
            const whitelistCap = await crowdsale.getWhitelistCap(accounts[1]);
            assert.strictEqual(parseInt(fromWei(whitelistCap)), 100);
    
        });
    
    
        it('Batch Whitelist: it should fail if called by address other than owner', async () => {
    
            try {
                await crowdsale.setWhitelistAddressBatch(
                    batchAddresses,
                    batchAmounts,
                    { from: accounts[3] }
                );
            } catch (error) {
                assertError(error);
            }
    
            // Confirm no whitelist updates took place.
            const whitelistCap_0 = await crowdsale.getWhitelistCap(batchAddresses[0]);
            assert.strictEqual(parseInt(fromWei(whitelistCap_0)), 0);
    
            const whitelistCap_1 = await crowdsale.getWhitelistCap(batchAddresses[1]);
            assert.strictEqual(parseInt(fromWei(whitelistCap_1)), 0);
    
            const whitelistCap_2 = await crowdsale.getWhitelistCap(batchAddresses[2]);
            assert.strictEqual(parseInt(fromWei(whitelistCap_2)), 0);
    
            const whitelistCap_3 = await crowdsale.getWhitelistCap(batchAddresses[3]);
            assert.strictEqual(parseInt(fromWei(whitelistCap_3)), 0);
    
            const whitelistCap_4 = await crowdsale.getWhitelistCap(batchAddresses[4]);
            assert.strictEqual(parseInt(fromWei(whitelistCap_4)), 0);
    
        });
    
    
        it('Batch Whitelist: it should succeed if called by owner', async () => {
    
            await crowdsale.setWhitelistAddressBatch(
                batchAddresses,
                batchAmounts,
                { from: owner }
            );
    
            // Confirm correct whitelist values.
            // batchAmounts is 1 therefore getWhitelistCap defers to `defaultWhitelistCap`
            // which was previously set to 30303.
            const whitelistCap_0 = await crowdsale.getWhitelistCap(batchAddresses[0]);
            assert.strictEqual(parseInt(fromWei(whitelistCap_0)), 30303);
    
            const whitelistCap_1 = await crowdsale.getWhitelistCap(batchAddresses[1]);
            assert.strictEqual(parseInt(fromWei(whitelistCap_1)), 20);
    
            const whitelistCap_2 = await crowdsale.getWhitelistCap(batchAddresses[2]);
            assert.strictEqual(parseInt(fromWei(whitelistCap_2)), 30);
    
            const whitelistCap_3 = await crowdsale.getWhitelistCap(batchAddresses[3]);
            assert.strictEqual(parseInt(fromWei(whitelistCap_3)), 40);
    
            const whitelistCap_4 = await crowdsale.getWhitelistCap(batchAddresses[4]);
            assert.strictEqual(parseInt(fromWei(whitelistCap_4)), 50);
    
        });
    });


    /*----------- Presale Allocations -----------*/
    
    describe('Presale Allocations', () => {
        let timelock;
        
        before(async function () {
            timelock = await TimelockArtifact.new(token.address, { from: owner });
            crowdsale = await WealthECrowdsale.new(token.address, { from: owner, gas: 4000000 });

            await token.setupReclaim({ from: owner });
            await token.transferOwnership(crowdsale.address, { from: owner });
            await timelock.transferOwnership(crowdsale.address, { from: owner });
            await crowdsale.claimTokenOwnership({ from: owner });
            await crowdsale.setTimelockAddress(timelock.address, { from: owner });
            await crowdsale.claimTimelockOwnership({ from: owner });
            assert.isTrue(await crowdsale.timelockAddressSet());            
        });

        it('it should fail if called by address other than owner', async () => {
    
            const startingBalance = await token.balanceOf(timelock.address);
    
            await assertRevert(crowdsale.mintPresaleTokens(
                accounts[2],
                toWei(100),
                { from: accounts[3] }
            ));
    
            // Confirm no token transfer took place.
            const endingBalance = await token.balanceOf(timelock.address);
            const tokensOwed = await timelock.beneficiaryMap.call(accounts[2]);
            assert.strictEqual(parseInt(fromWei(tokensOwed)), 0);
            assert.strictEqual(parseInt(fromWei(endingBalance)) - parseInt(fromWei(startingBalance)), 0);
    
        });
    
    
        it('it should fail to send presale tokens to crowdsale multisig', async () => {
    
            const startingBalance = await token.balanceOf(timelock.address);
            let tokensOwed = await timelock.beneficiaryMap.call(teamTokenAddress);
            
            assert.strictEqual(parseInt(fromWei(tokensOwed)), 120000000);

            await assertRevert(crowdsale.mintPresaleTokens(
                multiSig,
                toWei(100),
                { from: owner }
            ));
    
            // Confirm no token transfer took place.
            const endingBalance = await token.balanceOf(timelock.address);
            tokensOwed = await timelock.beneficiaryMap.call(teamTokenAddress);
            assert.strictEqual(parseInt(fromWei(tokensOwed)), 120000000);
            assert.strictEqual(parseInt(fromWei(endingBalance)) - parseInt(fromWei(startingBalance)), 0);
    
        });
    
    
        it('it should fail to send presale tokens to null address', async () => {
    
            const startingBalance = await token.balanceOf(timelock.address);

            await assertRevert(crowdsale.mintPresaleTokens(
                0x0,
                toWei(100),
                { from: owner }
            ));
    
            // Confirm no token transfer took place.
            const endingBalance = await token.balanceOf(timelock.address);
            assert.strictEqual(parseInt(fromWei(endingBalance)) - parseInt(fromWei(startingBalance)), 0);
        });
    
    
        it('it should fail to send presale tokens to crowdsale address', async () => {
    
            const startingBalance = await token.balanceOf(timelock.address);

            await assertRevert(crowdsale.mintPresaleTokens(
                crowdsale.address,
                toWei(100),
                { from: owner }
            ));

            // Confirm no token transfer took place.
            const endingBalance = await token.balanceOf(timelock.address);
            const tokensOwed = await timelock.beneficiaryMap.call(crowdsale.address);
            assert.strictEqual(parseInt(fromWei(tokensOwed)), 0);
            assert.strictEqual(parseInt(fromWei(endingBalance)) - parseInt(fromWei(startingBalance)), 0);
    
        });
    
    
        it('it should send tokens to address specified', async () => {
    
            const startingBalance = await token.balanceOf(timelock.address);

            await crowdsale.mintPresaleTokens(accounts[3], toWei(100), { from: owner });
    
            // Confirm token transfer took place.
            const endingBalance = await token.balanceOf(timelock.address);
            const tokensOwed = await timelock.beneficiaryMap.call(accounts[3]);
            
            assert.strictEqual(parseInt(fromWei(tokensOwed)), 100);
            assert.strictEqual(parseInt(fromWei(endingBalance)) - parseInt(fromWei(startingBalance)), 100);
        });
    
    
        it('it should timelock tokens for the address specified, even when token paused', async () => {
    
            // Reclaim, pause, then hand back to crowdsale.
            await token.reclaimOwnership({ from: owner });
            await token.pause({ from: owner })
            await token.setupReclaim({ from: owner });
            await token.transferOwnership(crowdsale.address, { from: owner });
            await crowdsale.claimTokenOwnership({ from: owner });
    
            const startingBalance = await token.balanceOf(timelock.address);

            await crowdsale.mintPresaleTokens(accounts[3], toWei(100), { from: owner });
    
            // Confirm token transfer took place.
            const endingBalance = await token.balanceOf(timelock.address);
            const tokensOwed = await timelock.beneficiaryMap.call(accounts[3]);

            assert.strictEqual(parseInt(fromWei(tokensOwed)), 200);
            assert.strictEqual(parseInt(fromWei(endingBalance)) - parseInt(fromWei(startingBalance)), 100);
        });
    
    
        /*----------- Batch Presale Allocations -----------*/
    
        it('Batch Presale: it should fail if called by address other than owner', async () => {
    
            const startingBalance = await token.balanceOf(timelock.address);

            await assertRevert(crowdsale.mintPresaleTokensBatch(
                batchAddresses,
                batchAmounts,
                { from: accounts[3] }
            ));
            
    
            // Confirm no token transfer took place.
            const endingBalance = await token.balanceOf(timelock.address);
            assert.strictEqual(parseInt(fromWei(endingBalance)) - parseInt(fromWei(startingBalance)), 0);

            const tokenBalance_0 = await timelock.beneficiaryMap.call(batchAddresses[0]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_0)), 0);
    
            const tokenBalance_1 = await timelock.beneficiaryMap.call(batchAddresses[1]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_1)), 0);
    
            const tokenBalance_2 = await timelock.beneficiaryMap.call(batchAddresses[2]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_2)), 0);
    
            const tokenBalance_3 = await timelock.beneficiaryMap.call(batchAddresses[3]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_3)), 0);
    
            const tokenBalance_4 = await timelock.beneficiaryMap.call(batchAddresses[4]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_4)), 0);
    
        });
    
    
        it('Batch Presale: it should fail if array lengths do not match', async () => {
    
            const startingBalance = await token.balanceOf(timelock.address);

            await assertRevert(crowdsale.mintPresaleTokensBatch(
                batchAddresses.slice(0,4),
                batchAmounts,
                { from: owner }
            ));

            await assertRevert(crowdsale.mintPresaleTokensBatch(
                batchAddresses,
                batchAmounts.slice(0,4),
                { from: owner }
            ));

            // Confirm no token transfer took place.
            const endingBalance = await token.balanceOf(timelock.address);
            assert.strictEqual(parseInt(fromWei(endingBalance)) - parseInt(fromWei(startingBalance)), 0);

            const tokenBalance_0 = await timelock.beneficiaryMap.call(batchAddresses[0]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_0)), 0);
    
            const tokenBalance_1 = await timelock.beneficiaryMap.call(batchAddresses[1]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_1)), 0);
    
            const tokenBalance_2 = await timelock.beneficiaryMap.call(batchAddresses[2]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_2)), 0);
    
            const tokenBalance_3 = await timelock.beneficiaryMap.call(batchAddresses[3]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_3)), 0);
    
            const tokenBalance_4 = await timelock.beneficiaryMap.call(batchAddresses[4]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_4)), 0);
    
        });
    
    
        it('Batch Presale: it should fail if array lengths are 0', async () => {

            const startingBalance = await token.balanceOf(timelock.address);

            await assertRevert(crowdsale.mintPresaleTokensBatch(
                [],
                [],
                { from: owner }
            ));
    
    
            // Confirm no token transfer took place.
            const endingBalance = await token.balanceOf(timelock.address);
            assert.strictEqual(parseInt(fromWei(endingBalance)) - parseInt(fromWei(startingBalance)), 0);

            const tokenBalance_0 = await timelock.beneficiaryMap.call(batchAddresses[0]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_0)), 0);
    
            const tokenBalance_1 = await timelock.beneficiaryMap.call(batchAddresses[1]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_1)), 0);
    
            const tokenBalance_2 = await timelock.beneficiaryMap.call(batchAddresses[2]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_2)), 0);
    
            const tokenBalance_3 = await timelock.beneficiaryMap.call(batchAddresses[3]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_3)), 0);
    
            const tokenBalance_4 = await timelock.beneficiaryMap.call(batchAddresses[4]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_4)), 0);
    
        });
    
    
        it('Batch Presale: it should fail surpasses TOTAL_SALE_TOKENS', async () => {
    
            const startingBalance = await token.balanceOf(timelock.address);

            await assertRevert(crowdsale.mintPresaleTokensBatch(
                batchAddresses,
                [100 * million, 50 * million, 50 * million, 50 * million, 51 * million].map(x => toWei(x)),
                { from: owner }
            ));    
    
    
            // Confirm no token transfer took place.
            const endingBalance = await token.balanceOf(timelock.address);
            assert.strictEqual(parseInt(fromWei(endingBalance)) - parseInt(fromWei(startingBalance)), 0);

            const tokenBalance_0 = await timelock.beneficiaryMap.call(batchAddresses[0]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_0)), 0);
    
            const tokenBalance_1 = await timelock.beneficiaryMap.call(batchAddresses[1]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_1)), 0);
    
            const tokenBalance_2 = await timelock.beneficiaryMap.call(batchAddresses[2]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_2)), 0);
    
            const tokenBalance_3 = await timelock.beneficiaryMap.call(batchAddresses[3]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_3)), 0);
    
            const tokenBalance_4 = await timelock.beneficiaryMap.call(batchAddresses[4]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_4)), 0);

        });
    
    
        it('Batch Presale: it should conduct multiple transfers', async () => {
    
            const startingBalance = await token.balanceOf(timelock.address);

            await crowdsale.mintPresaleTokensBatch(
                batchAddresses,
                batchAmounts,
                { from: owner }
            );
    
            // Confirm token transfer took place.
            const endingBalance = await token.balanceOf(timelock.address);
            assert.strictEqual(parseInt(fromWei(endingBalance)) - parseInt(fromWei(startingBalance)), 140);            
            
            // using toNumber as batchAmounts was set to simply 1 (not 1 converted to grains).
            const tokensOwed_0 = await timelock.beneficiaryMap.call(batchAddresses[0]);
            assert.strictEqual(tokensOwed_0.toNumber(), 1);
    
            const tokensOwed_1 = await timelock.beneficiaryMap.call(batchAddresses[1]);
            assert.strictEqual(parseInt(fromWei(tokensOwed_1)), 20);

            const tokensOwed_2 = await timelock.beneficiaryMap.call(batchAddresses[2]);
            assert.strictEqual(parseInt(fromWei(tokensOwed_2)), 30);

            const tokensOwed_3 = await timelock.beneficiaryMap.call(batchAddresses[3]);
            assert.strictEqual(parseInt(fromWei(tokensOwed_3)), 40);

            const tokensOwed_4 = await timelock.beneficiaryMap.call(batchAddresses[4]);
            assert.strictEqual(parseInt(fromWei(tokensOwed_4)), 50);
    
        });
    });


    /*----------- Crowdsale Participation -----------*/

    describe('Crowdsale Participation', () => {
        it('should fail prior to startTime', async () => {

            token = await WealthE.new({ from: owner });
            crowdsale = await WealthECrowdsale.new(token.address, { from: owner, gas: 4000000 });
    
            // Set ownership, multiSig, rate, and cap.
            await token.transferOwnership(crowdsale.address, { from: owner });
            await crowdsale.claimTokenOwnership({ from: owner });
            await crowdsale.setRate(globalRate, { from: owner });
            await crowdsale.setCap(toWei(100), { from: owner });
    
            // Add to whitelist.
            await crowdsale.setWhitelistAddress(
                accounts[4],
                toWei(globalPresaleMinETH),
                { from: owner }
            );
    
            try {
                // Purchase tokens.
                await web3.eth.sendTransaction({
                    to: crowdsale.address,
                    from: accounts[4],
                    gas: 200000,
                    value: toWei(globalPresaleMinETH)
                });
            } catch (error) {
                assertError(error);
            }
    
    
            // Confirm no token allocation took place.
            const tokenBalance = await token.balanceOf(accounts[4]);
            assert.strictEqual(parseInt(fromWei(tokenBalance)), 0);
        });

        
        it('should accept payment if startTime moved to now or earlier', async () => {

            token = await WealthE.new({ from: owner });
            crowdsale = await WealthECrowdsale.new(token.address, { from: owner, gas: 4000000 });
    
            // Set ownership, multiSig, rate, and cap.
            await token.transferOwnership(crowdsale.address, { from: owner });
            await crowdsale.claimTokenOwnership({ from: owner });
            await crowdsale.setRate(1, { from: owner });
            await crowdsale.setCap(toWei(30303 * 3), { from: owner });
            
            crowdsale.setSaleStart(new Date().getUnixTime(), { from: owner });
    
            // Use default whitelist cap.
            await crowdsale.setDefaultWhitelistCap(
                toWei(30303),
                { from: owner }
            );
    
            // Add to whitelist.
            await crowdsale.setWhitelistAddressBatch(
                [accounts[5], accounts[8], accounts[9]],
                [1, 1, 1],
                { from: owner }
            );
    
            // Complete purchase.
            await web3.eth.sendTransaction({
                to: crowdsale.address,
                from: accounts[5],
                gas: 200000,
                value: toWei(globalPresaleMinETH)
            });
    
            // Confirm token allocation took place.
            const tokenBalance_0 = await token.balanceOf(accounts[5]);
            assert.strictEqual(+(fromWei(tokenBalance_0).toNumber()).toFixed(1), +(globalPresaleMinETH * (fullsaleBonuses[6])).toFixed(1));
 
        });
    

        it('should fail to accept payments if ownership not set', async () => {
    
            token = await WealthE.new({ from: owner });
            crowdsale = await WealthECrowdsale.new(token.address, { from: owner, gas: 4000000 });
    
            await increaseTimeTo(publicStartTime);
    
            // Set multiSig, rate, cap.
            await crowdsale.setRate(globalRate, { from: owner });
            await crowdsale.setCap(toWei(100), { from: owner });
    
            // Add to whitelist.
            await crowdsale.setWhitelistAddress(
                accounts[4],
                toWei(globalPresaleMinETH),
                { from: owner }
            );
    
            try {
                // Purchase tokens.
                await web3.eth.sendTransaction({
                    to: crowdsale.address,
                    from: accounts[4],
                    gas: 200000,
                    value: toWei(globalPresaleMinETH)
                });
            } catch (error) {
                assertError(error);
            }
    
            // Confirm token allocation took place.
            const tokenBalance = await token.balanceOf(accounts[4]);
            assert.strictEqual(parseInt(fromWei(tokenBalance)), 0);
        });
    
    
        it('should fail to accept payments if rate not set', async () => {
    
            token = await WealthE.new({ from: owner });
            crowdsale = await WealthECrowdsale.new(token.address, { from: owner, gas: 4000000 });
    
            // Set ownership, multiSig, cap.
            await token.transferOwnership(crowdsale.address, { from: owner });
            await crowdsale.claimTokenOwnership({ from: owner });
            await crowdsale.setCap(toWei(100), { from: owner });
    
            // Add to whitelist.
            await crowdsale.setWhitelistAddress(
                accounts[4],
                toWei(globalPresaleMinETH),
                { from: owner }
            );
    
            try {
                // Purchase tokens.
                await web3.eth.sendTransaction({
                    to: crowdsale.address,
                    from: accounts[4],
                    gas: 200000,
                    value: toWei(globalPresaleMinETH)
                });
            } catch (error) {
                assertError(error);
            }
    
            // Confirm token allocation took place.
            const tokenBalance = await token.balanceOf(accounts[4]);
            assert.strictEqual(parseInt(fromWei(tokenBalance)), 0);
        });
    
    
        it('should fail to accept payments if cap not set', async () => {
    
            token = await WealthE.new({ from: owner });
            crowdsale = await WealthECrowdsale.new(token.address, { from: owner, gas: 4000000 });
    
            // Set ownership, multiSig, rate.
            await token.transferOwnership(crowdsale.address, { from: owner });
            await crowdsale.claimTokenOwnership({ from: owner });
            await crowdsale.setRate(globalRate, { from: owner });
    
            // Add to whitelist.
            await crowdsale.setWhitelistAddress(
                accounts[4],
                toWei(globalPresaleMinETH),
                { from: owner }
            );
    
            try {
                // Purchase tokens.
                await web3.eth.sendTransaction({
                    to: crowdsale.address,
                    from: accounts[4],
                    gas: 200000,
                    value: toWei(globalPresaleMinETH)
                });
            } catch (error) {
                assertError(error);
            }
    
            // Confirm token allocation took place.
            const tokenBalance = await token.balanceOf(accounts[4]);
            assert.strictEqual(parseInt(fromWei(tokenBalance)), 0);
        });

    
        it('should accept payments if ownership, multisig, rate, and cap are set', async () => {
    
            token = await WealthE.new({ from: owner });
            crowdsale = await WealthECrowdsale.new(token.address, { from: owner, gas: 4000000 });
    
            // Set ownership, multiSig, rate, and cap.
            await token.transferOwnership(crowdsale.address, { from: owner });
            await crowdsale.claimTokenOwnership({ from: owner });
            await crowdsale.setRate(globalRate, { from: owner });
            await crowdsale.setCap(toWei(globalPresaleMinETH * 3), { from: owner });
            
            // Add to whitelist.
            await crowdsale.setWhitelistAddress(
                accounts[4],
                toWei(globalPresaleMinETH),
                { from: owner }
            );
    
    
            // Purchase tokens.
            await web3.eth.sendTransaction({
                to: crowdsale.address,
                from: accounts[4],
                gas: 200000,
                value: toWei(globalPresaleMinETH)
            });
    
            // Confirm token allocation took place.
            const tokenBalance = await token.balanceOf(accounts[4]);
            assert.strictEqual(parseInt(fromWei(tokenBalance)), parseInt(globalPresaleMinETH * fullsaleBonuses[6] * globalRate));
    
        });
    
    
        it('should correctly track cumulative tokens sold and cumulative wei collected', async () => {
            const tokensSold = await crowdsale.tokensDistributed();
            const weiRaised = await crowdsale.weiRaised();
    
            assert.strictEqual(parseInt(fromWei(tokensSold)), parseInt(globalPresaleMinETH * fullsaleBonuses[6] * globalRate));
            assert.strictEqual(parseInt(fromWei(weiRaised)), globalPresaleMinETH);
        });
    
    
        it('should be forwarding funds to multisig address.', async () => {
    
            // await advanceBlock();
    
            const msAddress = await crowdsale.multiSig();
            const balance = await web3.eth.getBalance(multiSig);
    
            assert.strictEqual(parseInt(fromWei(balance)), globalPresaleMinETH * 2);
        });
    
    
        it('should fail if address not whitelisted', async () => {
    
            token = await WealthE.new({ from: owner });
            crowdsale = await WealthECrowdsale.new(token.address, { from: owner, gas: 4000000 });
    
            // Set ownership, multiSig, rate, and cap.
            await token.transferOwnership(crowdsale.address, { from: owner });
            await crowdsale.claimTokenOwnership({ from: owner });
            await crowdsale.setRate(globalRate, { from: owner });
            await crowdsale.setCap(toWei(globalPresaleMinETH * 3), { from: owner });
    
    
            try {
                // Purchase tokens.
                await web3.eth.sendTransaction({
                    to: crowdsale.address,
                    from: accounts[5],
                    gas: 200000,
                    value: toWei(globalPresaleMinETH)
                });
            } catch (error) {
                assertError(error);
            }
    
            // Confirm token allocation took place.
            let tokenBalance = await token.balanceOf(accounts[5]);
            assert.strictEqual(parseInt(fromWei(tokenBalance)), 0);
    
        });
    
    
        it('should fail while Paused', async () => {
    
            token = await WealthE.new({ from: owner });
            crowdsale = await WealthECrowdsale.new(token.address, { from: owner, gas: 4000000 });
    
            // Set ownership, multiSig, rate, and cap.
            await token.transferOwnership(crowdsale.address, { from: owner });
            await crowdsale.claimTokenOwnership({ from: owner });
            await crowdsale.setRate(globalRate, { from: owner });
            await crowdsale.setCap(toWei(globalPresaleMinETH * 3), { from: owner });
    
            // Add to whitelist.
            await crowdsale.setWhitelistAddress(
                accounts[4],
                toWei(globalPresaleMinETH),
                { from: owner }
            );
    
    
            // Pause and attempt purchase.
            await crowdsale.pause({ from: owner });
    
            try {
                // Purchase tokens.
                await web3.eth.sendTransaction({
                    to: crowdsale.address,
                    from: accounts[4],
                    gas: 200000,
                    value: toWei(globalPresaleMinETH)
                });
            } catch (error) {
                assertError(error);
            }
    
            // Confirm token allocation did not take place.
            let tokenBalance = await token.balanceOf(accounts[4]);
            assert.strictEqual(parseInt(fromWei(tokenBalance)), 0);
    
    
            // Unause and attempt purchase.
            await crowdsale.unpause({ from: owner });
    
            await web3.eth.sendTransaction({
                to: crowdsale.address,
                from: accounts[4],
                gas: 200000,
                value: toWei(globalPresaleMinETH)
            });
    
            // Confirm token allocation took place.
            tokenBalance = await token.balanceOf(accounts[4]);
            assert.strictEqual(parseInt(fromWei(tokenBalance)), parseInt(globalPresaleMinETH * fullsaleBonuses[6] * globalRate));
        });
    
    
        it('should adjust permitted whitelist allowance after a purchase made.', async () => {
    
            token = await WealthE.new({ from: owner });
            crowdsale = await WealthECrowdsale.new(token.address, { from: owner, gas: 4000000 });
    
            // Set ownership, multiSig, rate, and cap.
            await token.transferOwnership(crowdsale.address, { from: owner });
            await crowdsale.claimTokenOwnership({ from: owner });
            await crowdsale.setRate(globalRate, { from: owner });
            await crowdsale.setCap(toWei(globalPresaleMinETH * 3), { from: owner });
    
            // Add to whitelist.
            await crowdsale.setWhitelistAddress(
                accounts[6],
                toWei(globalPresaleMinETH * 2),
                { from: owner }
            );
    
            // Make purchase.
            await web3.eth.sendTransaction({
                to: crowdsale.address,
                from: accounts[6],
                gas: 200000,
                value: toWei(globalPresaleMinETH)
            });
    
            // Confirm token allocation took place.
            const tokenBalance = await token.balanceOf(accounts[6]);
            assert.strictEqual(parseInt(fromWei(tokenBalance)), parseInt(globalPresaleMinETH * fullsaleBonuses[6] * globalRate));
    
            // Confirm whitelist cap unchanged.
            const whitelistCap = await crowdsale.getWhitelistCap(accounts[6]);
            assert.strictEqual(parseInt(fromWei(whitelistCap)), globalPresaleMinETH * 2);
    
            // Confirm whitelist permitted amount is reduced by globalPresaleMinETH.
            const whitelistPermitted = await crowdsale.whitelistPermittedAmount(accounts[6]);
            assert.strictEqual(parseInt(fromWei(whitelistPermitted)), globalPresaleMinETH);
        });
    
    
        it('should fail if more than whitelisted amount sent', async () => {
    
            // globalPresaleMinETH ETH already sent, globalPresaleMinETH remaining. globalPresaleMinETH + 1 should error out.
            try {
                // Make purchase.
                await web3.eth.sendTransaction({
                    to: crowdsale.address,
                    from: accounts[6],
                    gas: 200000,
                    value: toWei(globalPresaleMinETH + 1)
                });
            } catch (error) {
                assertError(error);
            }
    
            // globalPresaleMinETH on the other hand should be permitted.
            await web3.eth.sendTransaction({
                to: crowdsale.address,
                from: accounts[6],
                gas: 200000,
                value: toWei(globalPresaleMinETH)
            });
    
            // Confirm token allocation took place.
            const tokenBalance = await token.balanceOf(accounts[6]);
            assert.strictEqual(parseInt(fromWei(tokenBalance)), parseInt(globalPresaleMinETH * fullsaleBonuses[6] * 2 * globalRate));
    
            // Confirm whitelist cap unchanged.
            const whitelistCap = await crowdsale.getWhitelistCap(accounts[6]);
            assert.strictEqual(parseInt(fromWei(whitelistCap)), globalPresaleMinETH * 2);
    
            // Confirm whitelist permitted amount is reduced by globalPresaleMinETH.
            const whitelistPermitted = await crowdsale.whitelistPermittedAmount(accounts[6]);
            assert.strictEqual(parseInt(fromWei(whitelistPermitted)), 0);
        });
    
    
        it('should reject payments once the whitelist cap is met', async () => {
            // Add one more round to whitelist.
            await crowdsale.setWhitelistAddress(
                accounts[6],
                toWei((globalPresaleMinETH * 3)),
                { from: owner }
            );
    
            // Confirm whitelist cap changed.
            const whitelistCap = await crowdsale.getWhitelistCap(accounts[6]);
            assert.strictEqual(parseInt(fromWei(whitelistCap)), (globalPresaleMinETH * 3));
    
            // Permitted should be globalPresaleMinETH ETH.
            let whitelistPermitted = await crowdsale.whitelistPermittedAmount(accounts[6]);
            assert.strictEqual(parseInt(fromWei(whitelistPermitted)), globalPresaleMinETH);
    
            // Sending 1 more than the cap fails.
            try {
                // Make purchase.
                await web3.eth.sendTransaction({
                    to: crowdsale.address,
                    from: accounts[6],
                    gas: 200000,
                    value: toWei(globalPresaleMinETH + 1)
                });
            } catch (error) {
                assertError(error);
            }
    
            // Sending upto the exact cap works.
            await web3.eth.sendTransaction({
                to: crowdsale.address,
                from: accounts[6],
                gas: 200000,
                value: toWei(globalPresaleMinETH)
            });
    
            // Confirm token allocation took place.
            const tokenBalance = await token.balanceOf(accounts[6]);
            assert.strictEqual(parseInt(fromWei(tokenBalance)), (globalPresaleMinETH * fullsaleBonuses[6]) * 3 * globalRate);
    
            // Permitted should be 0 ETH.
            whitelistPermitted = await crowdsale.whitelistPermittedAmount(accounts[6]);
            assert.strictEqual(parseInt(fromWei(whitelistPermitted)), 0);
        });
    });


    /*----------- Token and ETH Caps -----------*/

    describe('Token and ETH Caps', () => {
        it('should reject payments once the crowdsale cap is met', async () => {
            // Add one more round to whitelist.
            await crowdsale.setWhitelistAddress(
                accounts[6],
                toWei((globalPresaleMinETH * 4)),
                { from: owner }
            );
    
            // Confirm whitelist cap changed.
            const whitelistCap = await crowdsale.getWhitelistCap(accounts[6]);
            assert.strictEqual(parseInt(fromWei(whitelistCap)), (globalPresaleMinETH * 4));
    
            // Permitted should be globalPresaleMinETH ETH.
            let whitelistPermitted = await crowdsale.whitelistPermittedAmount(accounts[6]);
            assert.strictEqual(parseInt(fromWei(whitelistPermitted)), globalPresaleMinETH);
    
            // Sending more than the crowdsale cap fails.
            try {
                // Make purchase.
                await web3.eth.sendTransaction({
                    to: crowdsale.address,
                    from: accounts[6],
                    gas: 200000,
                    value: toWei(globalPresaleMinETH)
                });
            } catch (error) {
                assertError(error);
            }
    
            // Confirm token allocation did not take place.
            const tokenBalance = await token.balanceOf(accounts[6]);
            assert.strictEqual(parseInt(fromWei(tokenBalance)), globalPresaleMinETH * fullsaleBonuses[6] * 3 * globalRate);
    
            // Permitted should still be globalPresaleMinETH ETH.
            whitelistPermitted = await crowdsale.whitelistPermittedAmount(accounts[6]);
            assert.strictEqual(parseInt(fromWei(whitelistPermitted)), globalPresaleMinETH);
        });
    
    
        it('should reject payments once the token cap is met', async () => {
    
            token = await WealthE.new({ from: owner });
            crowdsale = await WealthECrowdsale.new(token.address, { from: owner, gas: 4000000 });
    
            // Tokens per ETH. Should permit 2 contributions of globalPresaleMinETH but not 3 contributions.
            const localRate = parseInt(globalTokenCap / 2.7 / globalPresaleMinETH);
    
            // Set ownership, multiSig, rate, and cap.
            await token.transferOwnership(crowdsale.address, { from: owner });
            await crowdsale.claimTokenOwnership({ from: owner });
            await crowdsale.setRate(localRate, { from: owner });
            await crowdsale.setCap(toWei(localRate * 3), { from: owner });
    
            // Add 3x the rate to whitelist.
            await crowdsale.setWhitelistAddress(
                accounts[6],
                toWei(globalPresaleMinETH * 3),
                { from: owner }
            );
    
            // Confirm whitelist cap changed.
            const whitelistCap = await crowdsale.getWhitelistCap(accounts[6]);
            assert.strictEqual(parseInt(fromWei(whitelistCap)), (globalPresaleMinETH * 3));
    
            // Permitted should be globalPresaleMinETH*3 ETH.
            let whitelistPermitted = await crowdsale.whitelistPermittedAmount(accounts[6]);
            assert.strictEqual(parseInt(fromWei(whitelistPermitted)), (globalPresaleMinETH * 3));
    
            // Make purchase.
            await web3.eth.sendTransaction({
                to: crowdsale.address,
                from: accounts[6],
                gas: 200000,
                value: toWei(globalPresaleMinETH * 2)
            });
    
            // Sending another contribution of globalPresaleMinETH ETH fails.
            try {
                // Make purchase.
                await web3.eth.sendTransaction({
                    to: crowdsale.address,
                    from: accounts[6],
                    gas: 200000,
                    value: toWei(globalPresaleMinETH)
                });
            } catch (error) {
                assertError(error);
            }
    
            // Confirm second token allocation did not take place.
            const tokenBalance = await token.balanceOf(accounts[6]);
            assert.strictEqual(parseInt(fromWei(tokenBalance).toNumber()), parseInt(localRate * globalPresaleMinETH * 2 * fullsaleBonuses[6]));
    
            // Permitted should be globalPresaleMinETH ETH.
            whitelistPermitted = await crowdsale.whitelistPermittedAmount(accounts[6]);
            assert.strictEqual(fromWei(whitelistPermitted).toNumber(), globalPresaleMinETH);
        });
    });


    /*----------- Sale Close -----------*/

    describe('Sale Close', () => {
        it('should fail if ownerEnded, even if unpaused', async () => {

            token = await WealthE.new({ from: owner });
            crowdsale = await WealthECrowdsale.new(token.address, { from: owner, gas: 4000000 });
    
            // Set ownership, multiSig, rate, and cap.
            await token.transferOwnership(crowdsale.address, { from: owner });
            await crowdsale.claimTokenOwnership({ from: owner });
            await crowdsale.setRate(globalRate, { from: owner });
            await crowdsale.setCap(toWei(30303 * 3), { from: owner });
    
            // Add minimum to whitelist.
            await crowdsale.setWhitelistAddress(
                accounts[6],
                toWei(globalPresaleMinETH),
                { from: owner }
            );
    
            // Confirm whitelist cap changed.
            const whitelistCap = await crowdsale.getWhitelistCap(accounts[6]);
            assert.strictEqual(parseInt(fromWei(whitelistCap)), (globalPresaleMinETH));
    
            // Permitted should be globalPresaleMinETH ETH.
            let whitelistPermitted = await crowdsale.whitelistPermittedAmount(accounts[6]);
            assert.strictEqual(parseInt(fromWei(whitelistPermitted)), (globalPresaleMinETH));
    
            // End sale. Contributions should fail from here.
            await crowdsale.endSale({ from: owner });
    
            // Sending contribution of globalPresaleMinETH ETH.
            try {
                // Make purchase.
                await web3.eth.sendTransaction({
                    to: crowdsale.address,
                    from: accounts[6],
                    gas: 200000,
                    value: toWei(globalPresaleMinETH)
                });
            } catch (error) {
                assertError(error);
            }
    
            // Confirm token allocation did not take place.
            let tokenBalance = await token.balanceOf(accounts[6]);
            assert.strictEqual(parseInt(fromWei(tokenBalance)), 0);
    
    
            // Call unpause method to confirm no effect on saleEnded.
            await crowdsale.pause({ from: owner });
            await crowdsale.unpause({ from: owner });
    
            try {
                // Make purchase.
                await web3.eth.sendTransaction({
                    to: crowdsale.address,
                    from: accounts[6],
                    gas: 200000,
                    value: toWei(globalPresaleMinETH)
                });
            } catch (error) {
                assertError(error);
            }
    
            // Confirm token allocation did not take place.
            tokenBalance = await token.balanceOf(accounts[6]);
            assert.strictEqual(parseInt(fromWei(tokenBalance)), 0);
    
        });
    
    
        it('should not permit finalize prior to endTime or ownerEnded', async () => {
    
            token = await WealthE.new({ from: owner });
            crowdsale = await WealthECrowdsale.new(token.address, { from: owner, gas: 4000000 });
    
            // Set ownership, multiSig, rate, and cap.
            await token.transferOwnership(crowdsale.address, { from: owner });
            await crowdsale.claimTokenOwnership({ from: owner });
            await crowdsale.setRate(globalRate, { from: owner });
            await crowdsale.setCap(toWei(30303 * 3), { from: owner });
    
            // Try to finalize.
            try {
                await crowdsale.finalize({ from: owner });
            } catch (error) {
                assertError(error);
            }
    
            await crowdsale.endSale({ from: owner });
            await crowdsale.finalize({ from: owner });
            await token.claimOwnership({ from: owner });
    
            const tokenOwner = await token.owner();
            assert.strictEqual(tokenOwner, owner);
    
        });
    });


    /*----------- Time Based Bonuses -----------*/

    describe('Time Based Bonuses', () => {
        it('should give correct bonuses', async () => {

            token = await WealthE.new({ from: owner });
            crowdsale = await WealthECrowdsale.new(token.address, { from: owner, gas: 4000000 });

            // Set ownership, multiSig, rate, and cap.
            await token.transferOwnership(crowdsale.address, { from: owner });
            await crowdsale.claimTokenOwnership({ from: owner });
            await crowdsale.setRate(globalRate, { from: owner });
            await crowdsale.setCap(toWei(30303 * 3), { from: owner });

            // Use default whitelist cap.
            await crowdsale.setDefaultWhitelistCap(
                toWei(30303),
                { from: owner }
            );

            // Add to whitelist.
            await crowdsale.setWhitelistAddressBatch(
                [
                    accounts[10],
                    accounts[11],
                    accounts[12],
                    accounts[13],
                    accounts[14],
                    accounts[15],
                    accounts[16],
                    accounts[17]
                ],
                [1, 1, 1, 1, 1, 1, 1, 1],
                { from: owner }
            );
    
            // Complete purchases at each time interval.
            await web3.eth.sendTransaction({
                to: crowdsale.address,
                from: accounts[10],
                gas: 200000,
                value: toWei(2)
            });
    
            await increaseTimeTo(fullSaleDates[1]);
    
            await web3.eth.sendTransaction({
                to: crowdsale.address,
                from: accounts[11],
                gas: 200000,
                value: toWei(2)
            });
    
            await increaseTimeTo(fullSaleDates[2]);
    
            await web3.eth.sendTransaction({
                to: crowdsale.address,
                from: accounts[12],
                gas: 200000,
                value: toWei(2)
            });
    
            await increaseTimeTo(fullSaleDates[3]);
    
            await web3.eth.sendTransaction({
                to: crowdsale.address,
                from: accounts[13],
                gas: 200000,
                value: toWei(2)
            });
    
            await increaseTimeTo(fullSaleDates[4]);
    
            await web3.eth.sendTransaction({
                to: crowdsale.address,
                from: accounts[14],
                gas: 200000,
                value: toWei(2)
            });
    
            await increaseTimeTo(fullSaleDates[5]);
    
            await web3.eth.sendTransaction({
                to: crowdsale.address,
                from: accounts[15],
                gas: 200000,
                value: toWei(2)
            });
    
            await increaseTimeTo(fullSaleDates[6]);
    
            await web3.eth.sendTransaction({
                to: crowdsale.address,
                from: accounts[16],
                gas: 200000,
                value: toWei(2)
            });
    
    
            // Confirm token allocation took place.
            const tokenBalance_0 = await token.balanceOf(accounts[10]);
            assert.strictEqual(
                fromWei(tokenBalance_0).toNumber(),
                Math.round(2 * fullsaleBonuses[6] * globalRate, 0)
            );
    
            const tokenBalance_1 = await token.balanceOf(accounts[11]);
            assert.strictEqual(
                fromWei(tokenBalance_1).toNumber(),
                Math.round(2 * fullsaleBonuses[5] * globalRate, 0)
            );
    
            const tokenBalance_2 = await token.balanceOf(accounts[12]);
            assert.strictEqual(
                fromWei(tokenBalance_2).toNumber(),
                Math.round(2 * fullsaleBonuses[4] * globalRate, 0)
            );
    
            const tokenBalance_3 = await token.balanceOf(accounts[13]);
            assert.strictEqual(
                fromWei(tokenBalance_3).toNumber(),
                Math.round(2 * fullsaleBonuses[3] * globalRate, 0)
            );
    
            const tokenBalance_4 = await token.balanceOf(accounts[14]);
            assert.strictEqual(
                fromWei(tokenBalance_4).toNumber(),
                Math.round(2 * fullsaleBonuses[2] * globalRate, 0)
            );
    
            const tokenBalance_5 = await token.balanceOf(accounts[15]);
            assert.strictEqual(
                fromWei(tokenBalance_5).toNumber(),
                Math.round(2 * fullsaleBonuses[1] * globalRate, 0)
            );
    
            const tokenBalance_6 = await token.balanceOf(accounts[16]);
            assert.strictEqual(
                fromWei(tokenBalance_6).toNumber(),
                Math.round(2 * fullsaleBonuses[0] * globalRate, 0)
            );
        });
    });


    /*----------- After endTime: Sale Close -----------*/

    describe('After endTime: Sale Close', () => {
        it('should permit finalize after endTime', async () => {

            token = await WealthE.new({ from: owner });
            crowdsale = await WealthECrowdsale.new(token.address, { from: owner, gas: 4000000 });
    
            // Set ownership, multiSig, rate, and cap.
            await token.transferOwnership(crowdsale.address, { from: owner });
            await crowdsale.claimTokenOwnership({ from: owner });
            await crowdsale.setRate(globalRate, { from: owner });
            await crowdsale.setCap(toWei(30303 * 3), { from: owner });
    
            // Shift time forward.
            await increaseTimeTo(endTime + 100);
    
            await crowdsale.finalize({ from: owner });
            await token.claimOwnership({ from: owner });
    
            const tokenOwner = await token.owner();
            assert.strictEqual(tokenOwner, owner);
        });
    
    
        it('should fail after endTime', async () => {
    
            token = await WealthE.new({ from: owner });
            crowdsale = await WealthECrowdsale.new(token.address, { from: owner, gas: 4000000 });
    
            // Set ownership, multiSig, rate, and cap.
            await token.transferOwnership(crowdsale.address, { from: owner });
            await crowdsale.claimTokenOwnership({ from: owner });
            await crowdsale.setRate(globalRate, { from: owner });
            await crowdsale.setCap(toWei(30303 * 3), { from: owner });
    
            // Add minimum to whitelist.
            await crowdsale.setWhitelistAddress(
                accounts[6],
                toWei(globalPresaleMinETH),
                { from: owner }
            );
    
            // Confirm whitelist cap changed.
            const whitelistCap = await crowdsale.getWhitelistCap(accounts[6]);
            assert.strictEqual(parseInt(fromWei(whitelistCap)), (globalPresaleMinETH));
    
            // Permitted should be globalPresaleMinETH ETH.
            let whitelistPermitted = await crowdsale.whitelistPermittedAmount(accounts[6]);
            assert.strictEqual(parseInt(fromWei(whitelistPermitted)), (globalPresaleMinETH));
    
    
            // Sending contribution of globalPresaleMinETH ETH.
            try {
                // Make purchase.
                await web3.eth.sendTransaction({
                    to: crowdsale.address,
                    from: accounts[6],
                    gas: 200000,
                    value: toWei(globalPresaleMinETH)
                });
            } catch (error) {
                assertError(error);
            }
    
            // Confirm token allocation did not take place.
            let tokenBalance = await token.balanceOf(accounts[6]);
            assert.strictEqual(parseInt(fromWei(tokenBalance)), 0);
    
            // Confirm token allocation did not take place.
            tokenBalance = await token.balanceOf(accounts[6]);
            assert.strictEqual(parseInt(fromWei(tokenBalance)), 0);
    
        });
    });


    /*----------- Token Paused -----------*/

    describe('Token Paused', () => {
        it('it should fail to transfer tokens while paused', async () => {
            
            token = await WealthE.new({ from: owner });
            await token.pause({ from: owner });
            await token.mint(accounts[3], toWei(200), { from: owner })

            await assertRevert(token.transfer(accounts[2], 100, { from: accounts[3] }));
    
            // Confirm no token transfer took place.
            const tokenBalance = await token.balanceOf(accounts[3]);
            assert.strictEqual(parseInt(fromWei(tokenBalance)), 200);
    
        });
    });

    
    /*----------  Timelock Release  ----------*/

    describe('Timelock Release', () => {
        let timelock;

        before(async () => {

            token = await WealthE.new({ from: owner });
            crowdsale = await WealthECrowdsale.new(token.address, { from: owner, gas: 4000000 });
            timelock = await TimelockArtifact.new(token.address, { from: owner });

            await token.setupReclaim({ from: owner });
            await token.transferOwnership(crowdsale.address, { from: owner });
            await timelock.transferOwnership(crowdsale.address, { from: owner });
            await crowdsale.claimTokenOwnership({ from: owner });
            await crowdsale.setTimelockAddress(timelock.address, { from: owner });
            await crowdsale.claimTimelockOwnership({ from: owner });
            assert.isTrue(await crowdsale.timelockAddressSet());
            await crowdsale.mintPresaleTokens(accounts[2], toWei(100), { from: owner });
            await crowdsale.mintPresaleTokens(accounts[4], toWei(1000), { from: owner });
            await crowdsale.mintPresaleTokens(accounts[5], toWei(100000), { from: owner });
            await crowdsale.mintPresaleTokens(accounts[6], toWei(100000000), { from: owner });
        });

        it('it should fail to release tokens prior to release date', async () => {
            await assertRevert(timelock.release({ from: accounts[2] }));
    
            // Confirm no token transfer took place.
            const tokenBalance = await token.balanceOf(accounts[2]);
            assert.strictEqual(parseInt(fromWei(tokenBalance)), 0);
        });

        it('it should fail to release tokens if none owed', async () => {

            await increaseTimeTo(timelockRelease);

            await assertRevert(timelock.release({ from: accounts[3] }));
    
            // Confirm no token transfer took place.
            const tokenBalance = await token.balanceOf(accounts[3]);
            assert.strictEqual(parseInt(fromWei(tokenBalance)), 0);
        });

        it('it should release tokens owed only once', async () => {
            await timelock.release({ from: accounts[2] });
            await timelock.release({ from: accounts[4] });
            await timelock.release({ from: accounts[5] });
            await timelock.release({ from: accounts[6] });
    
            // Confirm no token transfer took place.
            const tokenBalance_0 = await token.balanceOf(accounts[2]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_0)), 100);

            const tokenBalance_1 = await token.balanceOf(accounts[4]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_1)), 1000);

            const tokenBalance_2 = await token.balanceOf(accounts[5]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_2)), 100000);

            const tokenBalance_3 = await token.balanceOf(accounts[6]);
            assert.strictEqual(parseInt(fromWei(tokenBalance_3)), 100000000);

            await assertRevert(timelock.release({ from: accounts[2] }));
            await assertRevert(timelock.release({ from: accounts[4] }));
            await assertRevert(timelock.release({ from: accounts[5] }));
            await assertRevert(timelock.release({ from: accounts[6] }));
        });
    });
    
    
    /*----------  Allocation Wallets  ----------*/
    
    describe('Allocation Wallets', () => {
        let timelock;

        before(async () => {

            token = await WealthE.new({ from: owner });
            crowdsale = await WealthECrowdsale.new(token.address, { from: owner, gas: 4000000 });
            timelock = await TimelockArtifact.new(token.address, { from: owner });

            await token.setupReclaim({ from: owner });
            await token.transferOwnership(crowdsale.address, { from: owner });
            await timelock.transferOwnership(crowdsale.address, { from: owner });
            await crowdsale.claimTokenOwnership({ from: owner });
            await crowdsale.setTimelockAddress(timelock.address, { from: owner });
            await crowdsale.claimTimelockOwnership({ from: owner });
            assert.isTrue(await crowdsale.timelockAddressSet());
        });

        it('it should preallocation the reserve and growth funds', async () => {
    
            const tokenBalance_0 = await token.balanceOf(reserveFundAddress);
            const tokenBalance_1 = await token.balanceOf(networkGrowthAddress);

            assert.strictEqual(parseInt(fromWei(tokenBalance_0)), 120e6);
            assert.strictEqual(parseInt(fromWei(tokenBalance_1)), 60e6);
        });
    });
});
