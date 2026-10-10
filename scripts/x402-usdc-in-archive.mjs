// 补齐失败段：逐段重试并报告缺口，绝不在数据不全时下结论
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const PAYTO = '0x5fbbbcbf2ade44f5c604e5e55f11945e1addd231';
const SELF_PFX = '0x1bf19c0e';
const BUYER1 = '0xc9c7b38c0942914fc8ea12063bc92dcd3b581670';
const BUYER2 = '0x6a0b784cf4e3f79e0bca889e35a1b3aa1dc24518';
const TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const toAddr = '0x000000000000000000000000' + PAYTO.slice(2);
const hex = (n) => '0x' + n.toString(16);
const URL = 'https://rpc-base.blockmachine.io';

async function rpc(method, params, timeout = 30000) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), timeout);
  try {
    const r = await fetch(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: ac.signal,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    const tx = await r.text();
    try { return JSON.parse(tx); } catch { return { error: { message: 'non-json ' + tx.slice(0, 50) } }; }
  } catch (e) { return { error: { message: 'fetch ' + String(e).slice(0, 40) } }; }
  finally { clearTimeout(t); }
}

const head = parseInt((await rpc('eth_blockNumber', [])).result, 16);
const START = 52100000;
const CHUNK = 9999;
const byBlock = new Map();
const gaps = [];

for (let s = START; s <= head; s += CHUNK) {
  const e = Math.min(s + CHUNK, head);
  let done = false, lastErr = '';
  for (let att = 0; att < 8 && !done; att++) {
    const j = await rpc('eth_getLogs', [{ address: USDC, topics: [TOPIC, null, toAddr], fromBlock: hex(s), toBlock: hex(e) }], 40000);
    if (j.error) { lastErr = String(j.error.message).slice(0, 45); await new Promise((r) => setTimeout(r, 1200 * (att + 1))); }
    else { for (const l of j.result) byBlock.set(l.transactionHash, l); done = true; }
  }
  if (done) process.stdout.write('.');
  else { gaps.push([s, e, lastErr]); process.stdout.write('G'); }
}
console.log('\n');
if (gaps.length) {
  console.log('!! 仍有 ' + gaps.length + ' 段失败：');
  for (const g of gaps) console.log('   ', g[0], '-', g[1], g[2]);
} else console.log('全部区块段扫描成功，无缺口');

const logs = [...byBlock.values()].sort((a, b) => parseInt(a.blockNumber, 16) - parseInt(b.blockNumber, 16));
console.log('\n=== USDC 转入明细 ===');
let sum = 0n;
const buyers = new Map();
for (const l of logs) {
  const from = '0x' + l.topics[1].slice(-40);
  const v = BigInt(l.data); sum += v;
  const usdc = Number(v) / 1e6;
  const kind = from.startsWith(SELF_PFX) ? '自付(我方)' : from === BUYER1 ? '外部买家1' : from === BUYER2 ? '外部买家2' : '★新外部地址';
  buyers.set(from, (buyers.get(from) ?? 0) + 1);
  let ts = '?';
  const b = await rpc('eth_getBlockByNumber', [l.blockNumber, false]);
  if (b.result) ts = new Date(parseInt(b.result.timestamp, 16) * 1000).toISOString();
  console.log(`${ts} | ${from} | ${String(usdc).padStart(6)} | ${kind.padEnd(16)} | ${l.transactionHash}`);
}
console.log('\n合计 =', Number(sum) / 1e6, 'USDC  笔数 =', logs.length, ' 唯一付款方 =', buyers.size);
for (const [a, n] of buyers) console.log(`  ${a}  ${n} 笔  ${a.startsWith(SELF_PFX) ? '(自付)' : '★外部'}`);
