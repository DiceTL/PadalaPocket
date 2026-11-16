import { execFileSync } from 'node:child_process';

export function localDockerEnvironment(source = process.env) {
  const env = { NODE_ENV: 'test' };
  for (const name of ['PATH', 'HOME', 'DOCKER_CONFIG', 'XDG_RUNTIME_DIR']) {
    if (source[name] !== undefined) env[name] = source[name];
  }
  try {
    // Docker gives an explicit context precedence over DOCKER_HOST.
    let endpoint = source.DOCKER_CONTEXT ? undefined : source.DOCKER_HOST;
    if (!endpoint) {
      endpoint = JSON.parse(execFileSync('docker', [
        'context', 'inspect', ...(source.DOCKER_CONTEXT ? [source.DOCKER_CONTEXT] : []),
        '--format', '{{json .Endpoints.docker.Host}}',
      ], { env, encoding: 'utf8', timeout: 10000, maxBuffer: 16384, stdio: ['ignore', 'pipe', 'pipe'] }));
    }
    const url = new URL(endpoint);
    if (url.protocol !== 'unix:' || url.hostname || url.username || url.password || !url.pathname.startsWith('/') || url.pathname === '/' || url.search || url.hash) throw Error();
    // Pin the endpoint, not a mutable context name, for Docker and Supabase alike.
    return { ...env, DOCKER_HOST: endpoint };
  } catch {
    throw Error('LOCAL_DOCKER_REQUIRED');
  }
}
