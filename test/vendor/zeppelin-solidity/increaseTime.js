import latestTime from './latestTime'
const providers = require('ethers').providers;
const provider = new providers.JsonRpcProvider('http://localhost:8545/');

// Increases testrpc time by the passed duration in seconds
export async function increaseTime(duration) {
    await provider.send('evm_increaseTime', [duration]);
    return provider.send('evm_mine');
}

/**
 * Beware that due to the need of calling two separate testrpc methods and rpc calls overhead
 * it's hard to increase time precisely to a target point so design your test to tolerate
 * small fluctuations from time to time.
 *
 * @param target time in seconds
 */
export async function increaseTimeTo(target) {
  let now = await latestTime();
  if (target < now) throw Error(`Cannot increase current time(${now}) to a moment in the past(${target})`);
  let diff = target - now;
  return increaseTime(diff);
}

export const duration = {
  seconds: function(val) { return val},
  minutes: function(val) { return val * this.seconds(60) },
  hours:   function(val) { return val * this.minutes(60) },
  days:    function(val) { return val * this.hours(24) },
  weeks:   function(val) { return val * this.days(7) },
  years:   function(val) { return val * this.days(365)}
};
