import { describe, expect, it } from 'vitest';

import { renderLanding } from './landing';
import { defaults } from './defaults';

describe('Minds tenant landing page', () => {
  it('exports the Minds tenant defaults without a runtime JSON loader', () => {
    expect(defaults.authMethods).toBe('email');
    expect(defaults.features.aiAgents).toBe(true);
  });

  it('renders Minds branding and escapes tenant-controlled text', () => {
    const html = renderLanding({
      name: '<Minds & friends>',
      slug: 'minds',
      fqdn: 'build.minds.com',
    });

    expect(html).toContain('&lt;Minds &amp; friends&gt;');
    expect(html).toContain('The open AI');
    expect(html).toContain('Agents that work for you');
    expect(html).not.toContain('open-source');
    expect(html).not.toContain('token rewards');
    expect(html).not.toContain('<Minds & friends>');
  });

  it('rejects unsafe logo URL schemes', () => {
    const html = renderLanding({
      name: 'Minds',
      slug: 'minds',
      logo: 'javascript:alert(1)',
    });

    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<img');
  });
});
