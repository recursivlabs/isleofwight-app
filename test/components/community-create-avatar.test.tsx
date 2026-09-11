import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __setLocalSearchParams, router } from '../component-stubs/expo-router';

const scenario = vi.hoisted(() => {
  const sdk = {
    communities: {
      create: vi.fn(async () => ({ data: { id: 'community-1' } })),
    },
    posts: { create: vi.fn(async () => ({ data: { id: 'announcement-1' } })) },
  };
  return {
    sdk,
    admin: { update: vi.fn(async () => ({ data: {} })) },
    uploadMediaBlob: vi.fn(async () => null),
  };
});

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    sdk: scenario.sdk,
    user: { id: 'viewer-1', username: 'viewer', name: 'Viewer', image: null },
  }),
}));

vi.mock('../../lib/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/hooks')>();
  return { ...actual, useCommunities: () => ({ communities: [], loading: false }) };
});

vi.mock('../../lib/groupAdmin', () => ({
  groupAdmin: () => scenario.admin,
}));

vi.mock('../../lib/mediaUpload', () => ({
  uploadMediaBatch: vi.fn(),
  uploadMediaBlob: scenario.uploadMediaBlob,
}));

import CreateScreen from '../../app/(tabs)/create';

const originalCreateObjectURL = (URL as any).createObjectURL;

describe('group creation picture recovery', () => {
  beforeEach(() => {
    __setLocalSearchParams({ mode: 'community' });
    scenario.uploadMediaBlob.mockResolvedValue(null);
  });

  afterEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: originalCreateObjectURL,
    });
    vi.unstubAllGlobals();
  });

  it('takes a successfully created group to picture management when its chosen picture fails', async () => {
    const user = userEvent.setup({ delay: null });
    const picture = new File(['picture'], 'group.jpg', { type: 'image/jpeg' });

    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      Object.defineProperty(this, 'files', { configurable: true, value: [picture] });
      this.onchange?.({ target: this } as any);
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:group-picture'),
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => picture })));

    render(<CreateScreen />);

    await user.click(screen.getByRole('button', { name: 'Add group picture' }));

    fireEvent.change(screen.getByPlaceholderText('Group name'), { target: { value: 'New group' } });
    fireEvent.change(screen.getByPlaceholderText('Description *'), { target: { value: 'A real description' } });
    await user.click(screen.getByRole('button', { name: 'Create Group' }));

    await waitFor(() => expect(scenario.sdk.communities.create).toHaveBeenCalledTimes(1));
    expect(scenario.uploadMediaBlob).toHaveBeenCalledTimes(1);
    expect(scenario.admin.update).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/community/manage/community-1?pictureUploadFailed=1');
  });
});
