WHNEWS tiny-voca radio voices A/B

24 kHz, two-speaker ONNX model; 4,545,355 parameters, trained for 12,000 steps.
The matching configuration contains the Russian frontend fingerprint and symbol
inventory. This model generates synthetic speech. It is used for fictional
Warhammer-inspired fan radio and is not an official Games Workshop production.

After the listener presses Play, a browser Web Worker runs ONNX Runtime Web
1.31.1 on CPU, in one WASM thread. Model bytes are verified by SHA256 before use.
The browser caches model/config bytes when storage is available. Speech buffers
are local, ephemeral and not uploaded. No cloud inference or voice API is used.
Music and text schedules are static files. Device clock determines UTC position.

tiny-voca code: Apache License 2.0; see tiny-voca-LICENSE.txt.
ONNX Runtime: Microsoft, MIT License; see ort-1.31.1/LICENSE.txt.
The tiny-voca notice covers upstream code; it does not certify rights in every
possible training recording or imply endorsement by the upstream authors.
