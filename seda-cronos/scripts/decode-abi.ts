import { AbiCoder } from 'ethers';

function main() {
  if (process.argv.length !== 4) {
    console.error('Usage: bun run decode.ts <encoding> <hexData>');
    process.exit(1);
  }

  const [encoding] = process.argv.slice(2);
  const [hex] = process.argv.slice(3);

  const data = hex.trim().replace(/^0x/, '');
  const buf = Buffer.from(data, 'hex');

  const coder = AbiCoder.defaultAbiCoder();
  const [bnArray] = coder.decode([encoding], buf) as unknown as [bigint[]];

  console.table(bnArray);
}

main();
