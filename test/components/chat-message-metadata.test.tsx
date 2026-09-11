import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatBubble } from '../../components/ChatBubble';
import { normalizeChatMessage, resolveChatMessageQuote } from '../../lib/chatMessages';

describe('loaded chat message metadata', () => {
  it('reaches the bubble as a reply, reaction, and structured attachment', () => {
    const message = normalizeChatMessage({
      id: 'message-2',
      content: 'Reply with a photo',
      sender: { id: 'user-2', name: 'Bob' },
      created_at: '2026-08-27T12:01:00.000Z',
      reply_to_id: 'message-1',
      reply_to: { content: 'Original question', sender_name: 'Alice' },
      media: [{ url: 'https://media.example/reply.jpg', type: 'image' }],
      reactions: [{ type: '❤️', user_id: 'user-1' }],
    });

    expect(message).not.toBeNull();
    render(
      <ChatBubble
        message={message}
        isOwn={false}
        quoted={resolveChatMessageQuote(message, [], 'user-1')}
        myUserId="user-1"
      />,
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Original question')).toBeInTheDocument();
    expect(screen.getByText('❤️')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open image: Post image' })).toBeInTheDocument();
  });

  it('renders a structured media-only message after normalization', () => {
    const message = normalizeChatMessage({
      id: 'media-only',
      content: '',
      sender_id: 'user-2',
      media: [{ url: 'https://media.example/attachment.jpg', type: 'image' }],
      created_at: '2026-08-27T12:00:00.000Z',
    });

    expect(message).not.toBeNull();
    render(<ChatBubble message={message} isOwn={false} />);

    expect(screen.getByRole('button', { name: 'Open image: Post image' })).toBeInTheDocument();
  });
});
