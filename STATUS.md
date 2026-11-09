# ojek-rush-web — Status: PROTOTIPE (milestone 1)

## Apa ini
Game web 2D top-down: driver ojol ngebut nganter paket di jalanan Jakarta yang macet. TypeScript + Vite 8 + Canvas 2D, tanpa library game dan tanpa file aset.

Semua aturan ada di `src/logic.ts` (murni, tanpa DOM, bisa dites). `src/render.ts` cuma menggambar, `src/main.ts` urus input dan loop, `src/audio.ts` suara.

## Sudah ada
- 4 jalur. Pindah jalur lewat panah / A D, geser jari, atau tap separuh layar kiri/kanan
- Hazard: mobil, bus, lubang jalan, orang nyebrang (bergerak menyamping). Satu baris traffic tidak pernah menutup semua jalur
- Item: paket (+50), bensin (boost 4 dtk: kebal + skor jarak ×1,5), payung (+30, anti hujan 8 dtk)
- Hujan berkala: belok jadi lambat kecuali pakai payung
- Difficulty naik tiap detik: kecepatan 14 → 34 m/s, jarak antar baris 16 → 7 m, maksimal hazard per baris 1 → 3 (capped di 120 dtk)
- Skor = jarak (m) + bonus item. 3 kali nabrak = game over, ada jeda kebal 1,5 dtk habis nabrak
- Rekor di localStorage, layar menu dan game over
- Suara sintetis Web Audio (tanpa file): klakson, nabrak, +1, boost, game over. Tombol 🔊 atau M buat mute
- Layout desktop dan HP portrait (canvas responsif, DPR sampai 2)

## Tes
- `npm run verify`: typecheck + 19 tes vitest (tabrakan, skor, difficulty/spawner, rekor localStorage) + build. Lulus 2026-11-04.
- Belum dicoba di browser sungguhan (belum ada pengecekan visual atau sentuhan); yang terverifikasi baru logic dan build.

## Gap
- Tampilan masih kotak-kotak sederhana (tanpa sprite)
- Tuning feel (kecepatan, kerapatan hazard, kecepatan belok) belum dites manusia
- Suara belum dicoba di Safari iOS (saklar silent ikut membisukan Web Audio)
- Bisa ada item yang menempel di hazard baris berikutnya (item di tengah dua baris)
