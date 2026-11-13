# ojek-rush-web — Status: PROTOTIPE (milestone 1)

## Apa ini
Game web 2D top-down: driver ojol ngebut nganter paket di jalanan Jakarta yang macet. TypeScript + Vite 8 + Canvas 2D, tanpa library game dan tanpa file aset.

Semua aturan ada di `src/logic.ts` (murni, tanpa DOM, bisa dites). `src/render.ts` cuma menggambar, `src/main.ts` urus input dan loop, `src/audio.ts` suara.

## Sudah ada
- 4 jalur. Pindah jalur lewat panah / A D, geser jari, atau tap separuh layar kiri/kanan
- Hazard: mobil, bus, lubang jalan, orang nyebrang. Patch lokal menyisakan koridor berurutan 1→2→3→2→1→0 (60m per segmen), dua jalur bebas dekat pergantian, dan membatasi pedestrian agar tidak memasuki koridor. Ini mengurangi hazard; bukan bukti pacing manusia sudah pas.
- Item: paket (+50), bensin (boost 4 dtk: kebal + skor jarak ×1,5), payung (+30, anti hujan 8 dtk)
- Hujan berkala: belok jadi lambat kecuali pakai payung
- Difficulty naik tiap detik: kecepatan 14 → 34 m/s, jarak antar baris 16 → 7 m, maksimal hazard per baris 1 → 3 (capped di 120 dtk)
- Skor = jarak (m) + bonus item. 3 kali nabrak = game over, ada jeda kebal 1,5 dtk habis nabrak
- Rekor di localStorage, layar menu dan game over
- Suara sintetis Web Audio (tanpa file): klakson, nabrak, +1, boost, game over. Tombol 🔊 atau M buat mute
- Layout desktop dan HP portrait (canvas responsif, DPR sampai 2)

## Tes
- `npm ci`, lalu `npm install --no-save --package-lock=false --ignore-scripts playwright@1.65.0`; pasang browser dengan `npx --no-install playwright install chromium` pada OS yang didukung. Alternatif browser existing: set `CHROME_PATH` ke executable lokal; tidak ada path home/browser hardcoded pada gate baru.
- `npm run verify`: typecheck, Vitest, build, browser determinisme/replay wajib (fail-closed). Gate baru menguji cold/warm seed61 dan 24 replay browser keyboard-handler dengan seeds1/61/94, normal600s/wet150s, dt1/60 dan0.05. Ini waktu simulasi, bukan waktu bermain manusia.
- Fresh clean-install + verify lulus lokal macOS13 dengan Chrome existing. Download managed Chromium Playwright1.65 gagal karena mac13 tidak didukung. Ubuntu/container/CI remote belum diverifikasi; tidak diakali lewat override OS.
- Independent audit: 384 Node replays,24 Chrome/Node parity cases,1500 row parity dan pedestrian/pickup properties lulus. Sampel64.000 rows berkurang41,30% hazard dan22,08% rows kosong dibanding filter-only control. Review difficulty/discoverability manusia tetap wajib. Detail: ledger audit-fixes/20261113T093435Z-ojek/independent/REPORT.md.

## Gap
- Tampilan masih kotak-kotak sederhana (tanpa sprite)
- Tuning feel (kecepatan, kerapatan hazard, kecepatan belok) belum dites manusia
- Suara belum dicoba di Safari iOS (saklar silent ikut membisukan Web Audio)
- Bisa ada item yang menempel di hazard baris berikutnya (item di tengah dua baris)
