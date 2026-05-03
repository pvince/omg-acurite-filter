import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { expect } from 'chai';
import { describe, it } from 'mocha';

const execFileAsync = promisify(execFile);

describe('mocha exit smoke test', () => {
  it('should exit cleanly without --exit after creating long-lived resources', async function() {
    this.timeout(15000);

    const mochaBin = path.join(process.cwd(), 'node_modules', 'mocha', 'bin', 'mocha.js');
    const fixturePath = path.join('src', 'test', 'fixtures', 'noExitSmoke.fixture.ts');

    const result = await execFileAsync(process.execPath, [
      mochaBin,
      fixturePath
    ], {
      cwd: process.cwd(),
      timeout: 10000
    });

    expect(result.stdout).to.contain('1 passing');
  });
});