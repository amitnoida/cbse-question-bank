'use strict';
// Tests must target the deployed commit, rather than the previous production build.
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const sha = process.env.GITHUB_SHA;
  if (!repository || !sha) throw new Error('GitHub repository and tested SHA are required');
  const headers = { Accept: 'application/vnd.github+json' };
  if (process.env.GH_STATUS_TOKEN) headers.Authorization = 'Bearer ' + process.env.GH_STATUS_TOKEN;
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const response = await fetch(`https://api.github.com/repos/${repository}/commits/${sha}/status`, { headers });
    if (!response.ok) throw new Error('Cannot read deployment status: HTTP ' + response.status);
    const body = await response.json();
    const deployment = body.statuses?.find(status => status.context === 'Vercel');
    if (deployment?.state === 'success') {
      console.log('Vercel deployed tested commit ' + sha.slice(0, 7));
      return;
    }
    if (['failure', 'error'].includes(deployment?.state)) throw new Error('Vercel deployment did not succeed');
    console.log('Waiting for Vercel deployment of ' + sha.slice(0, 7));
    await wait(10000);
  }
  throw new Error('Production deployment did not become ready within ten minutes');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
