import { createHash } from 'node:crypto';
export const WEEKLY_STAGES = ['savingsDevice','myMoneyDevice','needsDefund','savingsFund','wantsDefund','myMoneyFund'];
export const bucketDevice = (family, bucket) => createHash('sha256').update(`PadalaPocket ${bucket} ${family}`).digest('hex');
export function nextWeeklyTime(now, day, time) {
  if (!Number.isInteger(day) || day < 0 || day > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw Error('INVALID_SCHEDULE');
  const local = new Date(Date.parse(now) + 8 * 3600000);
  const [hour,minute] = time.split(':').map(Number);
  const target = new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate(),hour-8,minute));
  target.setUTCDate(target.getUTCDate() + (day-local.getUTCDay()+7)%7);
  if(target.getTime() <= Date.parse(now)) target.setUTCDate(target.getUTCDate()+7);
  return target.toISOString();
}
export function allowanceAvailable(funding, purchases, events, bucket) {
 const credits=funding.reduce((n,r)=>n+BigInt(bucket==='wants'?(r.wants_stroops??'0'):r.amount_stroops),0n);
 const spent=purchases.filter(r=>r.reserved && (r.bucket??'needs')===bucket).reduce((n,r)=>n+BigInt(r.amount_stroops),0n);
 const swept=events.reduce((n,r)=>n+BigInt(bucket==='wants'?r.wants_stroops:r.needs_stroops),0n);
 return (credits-spent-swept).toString();
}
