import type * as React from 'react';
import { Linking, Platform, ScrollView } from 'react-native';
import { Text } from '../components';
import { Container } from '../components/Container';
import { ScreenHeader } from '../components/ScreenHeader';
import { spacing } from '../constants/theme';
import { useColors } from '../lib/theme';

// The privacy policy, served at /privacy on web and reachable from Settings.
//
// P12(4) requires a published policy URL returning 200, linked from both store
// listings and from in-app settings, covering PostHog and whatever P6 adds.
// This is the page half; the store-listing links need console access.
//
// EVERY FACTUAL CLAIM BELOW WAS READ OFF THE CODE, not assumed — see
// docs/privacy-policy-basis.md for the commands. Two consequences worth keeping
// in mind when editing:
//   1. `lib/monitoring.ts` calls posthog.identify(user.id, { username, email }),
//      so username and email DO reach PostHog. Saying otherwise would be false.
//   2. Analytics is web-only (`Platform.OS !== 'web'` returns null) and is gated
//      on EXPO_PUBLIC_POSTHOG_KEY, which §10.1 records as possibly unprovisioned.
// If either changes, this page and the store data-safety declarations (P12(5))
// change with it — they must agree, and a mismatch is a store-review problem.

const UPDATED = 'August 1, 2026';
const PRIVACY_EMAIL = 'privacy@minds.com';

function P({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="body" style={{ marginBottom: spacing.md, lineHeight: 22 }}>
      {children}
    </Text>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
      {children}
    </Text>
  );
}

export default function PrivacyScreen() {
  const colors = useColors();
  const contactLinkProps = Platform.OS === 'web'
    ? { href: `mailto:${PRIVACY_EMAIL}` }
    : { onPress: () => { void Linking.openURL(`mailto:${PRIVACY_EMAIL}`); } };

  return (
    <Container>
      <ScreenHeader title="Privacy" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['4xl'] }}>
        <Text variant="caption" color={colors.textSecondary} style={{ marginBottom: spacing.lg }}>
          Last updated {UPDATED}
        </Text>

        <P>
          This policy describes what Minds collects, why, and what you can do about it. It
          describes the app as it actually behaves today, not as we intend it to behave.
        </P>

        <H>What we collect</H>
        <P>
          <Text variant="bodyMedium">Account information.</Text> Your email address, username, display
          name, and anything you choose to add to your profile. You give us these directly.
        </P>
        <P>
          <Text variant="bodyMedium">Content you create.</Text> Posts, comments, reactions, direct
          messages, uploaded images and audio. Direct messages are stored so they can be delivered
          and shown to you and the people you send them to.
        </P>
        <P>
          <Text variant="bodyMedium">Technical information.</Text> When the app talks to our servers we
          receive the request, which includes your IP address and device or browser type, as any web
          service does.
        </P>

        <H>Analytics and error reporting</H>
        <P>
          On the <Text variant="bodyMedium">web app only</Text>, we use PostHog to record application
          errors. We have deliberately turned off automatic page-view and interaction capture, so
          PostHog does not receive a general record of what you look at or click.
        </P>
        <P>
          When you are signed in, we associate those error reports with your account by sending
          PostHog your <Text variant="bodyMedium">user ID, username, and email address</Text>. We are
          telling you this plainly because it is the part people would not expect.
        </P>
        <P>
          The iOS and Android apps currently send no analytics or crash telemetry at all. If that
          changes, this page changes first.
        </P>

        <H>Who else sees your data</H>
        <P>
          We do not sell your personal information. We share it only with services that operate the
          product for us — hosting, storage, email delivery, payment processing, and the error
          reporting described above — and only as needed to do that job.
        </P>
        <P>
          Anything you post publicly is public. Direct messages are not public, but they are not
          end-to-end encrypted: we can technically access them, and we will if we are legally
          required to or if we are investigating abuse.
        </P>

        <H>Your choices</H>
        <P>
          You can edit or delete your content and your profile at any time from within the app. You
          can request deletion of your account from Settings.
        </P>
        <P>
          If you are in a jurisdiction with data-protection rights — including the EU, the UK, and
          several US states — you can request a copy of your data, ask for corrections, or ask us to
          delete it. Contact us at the address below and we will respond.
        </P>

        <H>Children</H>
        <P>
          Minds is not intended for children under 13, and we do not knowingly collect their
          information. If you believe a child has created an account, contact us and we will remove
          it.
        </P>

        <H>Changes</H>
        <P>
          When this policy changes materially we will say so in the app rather than only updating
          the date at the top.
        </P>

        <H>Contact</H>
        <P>
          Questions about this policy, or a request about your data:{' '}
          <Text
            accessibilityRole="link"
            accessibilityLabel={`Email ${PRIVACY_EMAIL}`}
            color={colors.accent}
            style={{ textDecorationLine: 'underline' }}
            {...(contactLinkProps as any)}
          >
            {PRIVACY_EMAIL}
          </Text>
        </P>
      </ScrollView>
    </Container>
  );
}
