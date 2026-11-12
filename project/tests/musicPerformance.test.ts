import assert from 'node:assert/strict';
import test from 'node:test';
import { findSongSheet, googleDrivePreviewUrl, readPerformanceProgress, type MusicSheet } from '../src/utils/musicPerformance.ts';

const entries = [
  { songId: 'first', position: 1, title: 'First' },
  { songId: 'second', position: 2, title: 'Second' },
  { songId: 'first', position: 3, title: 'Encore' },
];

test('resume preserves repeated songs and selected instrument', () => {
  const raw = JSON.stringify({ version: 1, songId: 'first', position: 3, instrument: 'Trompete' });
  assert.deepEqual(readPerformanceProgress(raw, entries, ['Sax Alto', 'Trompete']), { index: 2, instrument: 'Trompete' });
});

test('resume follows reordered songs and falls back after removal', () => {
  assert.equal(readPerformanceProgress(JSON.stringify({ version: 1, songId: 'second', position: 8 }), entries, []).index, 1);
  assert.equal(readPerformanceProgress(JSON.stringify({ version: 1, songId: 'removed', position: 2 }), entries, []).index, 0);
});

test('invalid, oversized or outdated progress cannot break the reader', () => {
  for (const raw of [null, '{', 'null', '[]', '1', 'x'.repeat(2049), '{"version":2}', '{"version":1,"instrument":"Unknown"}']) {
    assert.deepEqual(readPerformanceProgress(raw, entries, ['Sax Alto']), { index: 0, instrument: 'Sax Alto' });
  }
});

test('sheet resolution requires the same band, song and instrument', () => {
  const sheet: MusicSheet = { id: 'pdf', band_id: 'band', song_id: 'first', instrument: 'Sax Alto', title: 'Score', file_name: 'score.pdf', file_size: 100, storage_path: 'band/pdf.pdf', created_at: '' };
  assert.equal(findSongSheet([sheet], 'band', 'first', ' sax alto '), sheet);
  assert.equal(findSongSheet([sheet], 'other', 'first', 'Sax Alto'), undefined);
  assert.equal(findSongSheet([sheet], 'band', 'second', 'Sax Alto'), undefined);
  assert.equal(findSongSheet([sheet], 'band', 'first', 'Trompete'), undefined);
});

test('Drive file links resolve to previews and preserve required resource keys', () => {
  assert.equal(googleDrivePreviewUrl('https://drive.google.com/file/d/file_123-abc/view?usp=sharing'), 'https://drive.google.com/file/d/file_123-abc/preview');
  assert.equal(googleDrivePreviewUrl('https://drive.google.com/open?id=file_123&resourcekey=0-key'), 'https://drive.google.com/file/d/file_123/preview?resourcekey=0-key');
  assert.equal(googleDrivePreviewUrl('https://drive.google.com/uc?id=file_123'), 'https://drive.google.com/file/d/file_123/preview');
});

test('Drive folders, unsupported providers and unsafe URLs are not embedded', () => {
  for (const url of [undefined, '', 'not a URL', 'https://drive.google.com/drive/folders/folder123', 'https://musescore.com/user/1/scores/2', 'http://drive.google.com/file/d/file123/view', 'https://drive.google.com.evil.example/file/d/file123/view', 'https://name@drive.google.com/file/d/file123/view', 'https://drive.google.com:444/file/d/file123/view', 'https://drive.google.com/open?id=../other']) {
    assert.equal(googleDrivePreviewUrl(url), null);
  }
});