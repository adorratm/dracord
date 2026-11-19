The files `worklet-source.ts`, `wasm-simd.ts` and `wasm-plain.ts` are generated from
`@sapphi-red/web-noise-suppressor` 0.4.1 (MIT, © sapphi-red), which wraps
xiph/rnnoise (BSD-3-Clause) via shiguredo/rnnoise-wasm (Apache-2.0).
They are inlined so the worklet and WebAssembly load from a Blob in every app
(the desktop app runs from file://, where fetch() cannot read local files).
