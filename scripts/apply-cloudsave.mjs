import { execFileSync } from 'node:child_process';

const patchBase64 = process.env.CLOUDSAVE_PATCH;
if (!patchBase64) throw new Error('CLOUDSAVE_PATCH is required');

execFileSync('git', ['apply', '--whitespace=error', '-'], {
  input: Buffer.from(patchBase64, 'base64'),
  stdio: ['pipe', 'inherit', 'inherit']
});
