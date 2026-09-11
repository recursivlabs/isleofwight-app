/**
 * Minds custom landing page renderer.
 *
 * Replaces the default network landing renderer for the Minds network so
 * build.minds.com renders Minds-branded marketing instead of the generic
 * Recursiv page. Self-contained HTML; all dynamic values are HTML-escaped.
 */

interface NetworkRecord {
  name: string;
  slug: string;
  logo?: string | null;
  theme?: string | null;
  landingPage?: string | null;
  fqdn?: string;
}

const MINDS_GOLD = '#d4a844';

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only allow http(s) URLs to avoid javascript:/data: in href attributes. */
function safeUrl(url: string, fallback: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) return trimmed;
  return fallback;
}

export function renderLanding(net: NetworkRecord): string | null {
  const name = escHtml(net.name || 'Minds');
  const fqdn = net.fqdn ? escHtml(net.fqdn) : 'build.minds.com';
  const appUrl = safeUrl(net.fqdn ? `https://${net.fqdn}/login` : '/login', '/login');
  const canonical = net.fqdn ? `<link rel="canonical" href="https://${fqdn}" />` : '';
  const logoUrl = net.logo ? escHtml(safeUrl(net.logo, '')) : '';

  const title = `${name} — The open AI social platform`;
  const description =
    'Choose your feed, build AI agents, and own your audience on an open social platform.';

  const features = [
    {
      icon: '✨',
      title: 'Agents that work for you',
      body: 'Choose the model, edit the instructions, and decide what your personal AI agent can do.',
    },
    {
      icon: '⚡',
      title: 'A feed you can inspect',
      body: 'See the signals behind your feed and shape what it learns from instead of trusting a black box.',
    },
    {
      icon: '🛠️',
      title: 'Build on the platform',
      body: 'Use the API, SDK, MCP server, and CLI to turn ideas into working social software.',
    },
    {
      icon: '🌐',
      title: 'Own your network',
      body: 'Create posts, communities, and an audience that are not trapped inside a black-box product.',
    },
  ];

  const featureCards = features
    .map(
      (f) => `
<div class="feature-card">
  <div class="feature-icon">${f.icon}</div>
  <h3>${escHtml(f.title)}</h3>
  <p>${escHtml(f.body)}</p>
</div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(description)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${name}" />
<meta property="og:title" content="${escHtml(title)}" />
<meta property="og:description" content="${escHtml(description)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escHtml(title)}" />
<meta name="twitter:description" content="${escHtml(description)}" />
${canonical}
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--accent:${MINDS_GOLD};--bg-base:#0a0e14;--bg-raised:#121821;--ink:#e8edf2;--ink-secondary:#9fb0c0;--ink-ghost:#647285}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg-base);color:var(--ink);line-height:1.6}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
.container{max-width:1100px;margin:0 auto;padding:0 24px}
.btn{display:inline-block;padding:14px 32px;background:var(--accent);color:#fff;border-radius:10px;font-weight:600;font-size:16px;text-decoration:none;transition:opacity .2s}
.btn:hover{opacity:.88;text-decoration:none}
.nav{display:flex;align-items:center;justify-content:space-between;padding:18px 24px;max-width:1100px;margin:0 auto}
.nav-brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:20px;color:var(--ink)}
.nav-brand img{height:34px;width:auto;border-radius:8px}
.hero{padding:110px 24px 80px;text-align:center;background:radial-gradient(900px 480px at 50% -10%,rgba(27,133,214,0.22),transparent)}
.hero h1{font-size:clamp(34px,6vw,62px);font-weight:800;line-height:1.08;margin-bottom:22px;letter-spacing:-0.02em}
.hero p{font-size:clamp(16px,2.5vw,21px);color:var(--ink-secondary);max-width:660px;margin:0 auto 36px}
.features{padding:72px 24px}
.features h2{text-align:center;font-size:30px;font-weight:700;margin-bottom:48px}
.features-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px;max-width:1100px;margin:0 auto}
.feature-card{background:var(--bg-raised);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:30px}
.feature-card h3{font-size:18px;font-weight:600;margin-bottom:8px}
.feature-card p{color:var(--ink-secondary);font-size:14px}
.feature-icon{font-size:26px;margin-bottom:14px}
.cta{padding:90px 24px;text-align:center}
.cta h2{font-size:30px;font-weight:700;margin-bottom:16px}
.cta p{color:var(--ink-secondary);max-width:560px;margin:0 auto 32px}
footer{padding:40px 24px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);color:var(--ink-ghost);font-size:13px}
footer a{color:var(--ink-secondary);margin:0 12px}
@media(max-width:640px){.hero{padding:70px 16px 48px}.features,.cta{padding:56px 16px}}
</style>
</head>
<body>
<nav class="nav">
  <div class="nav-brand">
    ${logoUrl ? `<img src="${logoUrl}" alt="${name} logo" />` : ''}
    <span>${name}</span>
  </div>
  <a class="btn" href="${escHtml(appUrl)}">Enter ${name}</a>
</nav>
<section class="hero">
  <div class="container">
    <h1>The open AI<br/>social platform</h1>
    <p>${escHtml(description)}</p>
    <a class="btn" href="${escHtml(appUrl)}">Get started</a>
  </div>
</section>
<section class="features">
  <div class="container">
    <h2>AI that works for you</h2>
    <div class="features-grid">${featureCards}</div>
  </div>
</section>
<section class="cta">
  <div class="container">
    <h2>Build your feed. Build your agents.</h2>
    <p>Join a social platform where you can see how the feed works, shape it, and build on top of it.</p>
    <a class="btn" href="${escHtml(appUrl)}">Join ${name}</a>
  </div>
</section>
<footer>
  <div class="container">
    <p>&copy; ${new Date().getFullYear()} ${name} &middot; ${fqdn}</p>
    <p style="margin-top:8px"><a href="${escHtml(appUrl)}">Sign in</a></p>
  </div>
</footer>
</body>
</html>`;
}
