import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachmentKind } from './media-gallery.service';

test('attachment kind trusts the content type, falls back to the extension', () => {
  assert.equal(attachmentKind('image/png', 'a.bin'), 'image');
  assert.equal(attachmentKind('video/mp4', 'a.png'), 'video');
  assert.equal(attachmentKind('', 'clip.webm'), 'video');
  assert.equal(attachmentKind('application/octet-stream', 'p.JPG'), 'image');
  assert.equal(attachmentKind('application/pdf', 'doc.pdf'), 'file');
  assert.equal(attachmentKind('audio/ogg', 'v.ogg', true), 'voice');
});
