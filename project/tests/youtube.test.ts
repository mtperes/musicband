import assert from 'node:assert/strict';
import test from 'node:test';
import { youtubeVideoId } from '../src/utils/youtube.ts';

test('extracts video IDs from watch, share, shorts, live and embed links', () => {
  for (const link of [
    'https://www.youtube.com/watch?v=M7lc1UVf-VE&t=20',
    'https://youtu.be/M7lc1UVf-VE?si=share',
    'https://m.youtube.com/watch?v=M7lc1UVf-VE',
    'https://www.youtube.com/shorts/M7lc1UVf-VE',
    'https://youtube.com/live/M7lc1UVf-VE',
    'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
  ]) assert.equal(youtubeVideoId(link), 'M7lc1UVf-VE');
});

test('rejects channels, playlists, fake hosts, credential URLs and malformed IDs', () => {
  for (const link of [
    '', 'M7lc1UVf-VE', 'javascript:alert(1)', 'https://www.youtube.com/@band',
    'https://www.youtube.com/playlist?list=example',
    'https://www.youtube.com.evil.example/watch?v=M7lc1UVf-VE',
    'https://youtube.com@evil.example/watch?v=M7lc1UVf-VE',
    'https://user:password@youtube.com/watch?v=M7lc1UVf-VE',
    'https://youtu.be/short', 'https://youtu.be/M7lc1UVf-VE/extra',
  ]) assert.throws(() => youtubeVideoId(link));
});