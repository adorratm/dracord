const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFpsTracker } = require('./presentmon');

const HEADER =
  'Application,ProcessID,SwapChainAddress,Runtime,SyncInterval,PresentFlags,Dropped,TimeInSeconds,msInQueue,MsBetweenPresents,MsBetweenDisplayChange';
const row = (app, ms) => `${app},1234,0x1,DXGI,0,0,0,1.0,0.1,${ms},${ms}`;

test('picks the busiest game and ignores desktop/browser presents', () => {
  let t = 0;
  const tr = createFpsTracker(() => t);
  tr.push(HEADER);
  for (let i = 0; i < 60; i++) {
    tr.push(row('cs2.exe', 1000 / 144));
    tr.push(row('dwm.exe', 1000 / 240));
    if (i % 3 === 0) tr.push(row('chrome.exe', 1000 / 60));
    t += 10;
  }
  assert.deepEqual(tr.current(), { app: 'cs2', fps: 144 });
});

test('drops frames older than the window and junk rows', () => {
  let t = 0;
  const tr = createFpsTracker(() => t);
  tr.push(HEADER);
  for (let i = 0; i < 10; i++) tr.push(row('game.exe', 1000 / 60));
  tr.push('garbage,line');
  tr.push(row('game.exe', 'NA'));
  assert.equal(tr.current().fps, 60);
  t += 5000;
  assert.equal(tr.current(), null);
});

test('handles a FrameTime header (v2 metrics) too', () => {
  const tr = createFpsTracker(() => 0);
  tr.push('Application,ProcessID,SwapChainAddress,PresentRuntime,SyncInterval,PresentFlags,FrameTime');
  for (let i = 0; i < 5; i++) tr.push('valorant.exe,1,0x1,DXGI,0,0,4');
  assert.deepEqual(tr.current(), { app: 'valorant', fps: 250 });
});
