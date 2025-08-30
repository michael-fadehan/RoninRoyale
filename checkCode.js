import { providers } from 'ethers';
const addr = process.argv[2];
const p = new providers.JsonRpcProvider('https://saigon-testnet.roninchain.com/rpc');
p.getCode(addr).then(c => console.log(c === '0x' ? 'no code at address' : 'code present')).catch(console.error);