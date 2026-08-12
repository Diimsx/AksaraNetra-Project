# Pengujian manual dengan pembaca layar

Berkas ini adalah lembar kerja. Isi kolom hasilnya, jangan hanya dibaca.

Semua perintah otomatis yang kami punya, yaitu `npm run test:ui` dan
`npm run test:reader`, hanya bisa membuktikan bahwa halaman tidak melanggar
aturan yang bisa diperiksa mesin. Itu sekitar sepertiga dari pengalaman
sebenarnya. Mesin tidak bisa menilai apakah nama tombol masuk akal, apakah
urutan bacaannya wajar, atau apakah halaman ini benar benar bisa dipakai.

Satu hal yang harus jujur ditulis di proposal: sampai lembar ini terisi, kami
belum boleh menulis kalimat seperti "diuji dengan NVDA".

## Yang perlu disiapkan

- NVDA versi terbaru, gratis, dari https://www.nvaccess.org/download/
- Peramban Firefox atau Chrome
- Dua berkas untuk diuji:
  1. UI alat ini, dibuka lewat `npm run serve` di alamat `http://127.0.0.1:4173`
  2. Satu berkas `ui/data/<id>/reader.html` hasil `npm run build:data`
- Waktu sekitar 45 menit untuk keduanya

Kalau bisa, minta satu orang yang belum pernah melihat proyek ini untuk
mencobanya. Orang yang sudah tahu letak tombolnya tidak akan menemukan masalah
yang dicari di sini.

## Tombol NVDA yang dipakai

| Tombol | Gunanya |
| --- | --- |
| `Insert` + `Q` | Keluar dari NVDA, hafalkan sebelum mulai |
| `Insert` + `F7` | Membuka daftar elemen: tautan, judul, penanda wilayah |
| `H` | Judul berikutnya |
| `K` | Tautan berikutnya |
| `B` | Tombol berikutnya |
| `G` | Gambar berikutnya |
| `D` | Penanda wilayah berikutnya |
| `Tab` | Elemen berikutnya yang bisa difokus |
| `Insert` + panah bawah | Membaca terus sampai akhir halaman |

## Bagian 1. Tampilan mudah dibaca

Buka satu berkas `reader.html`.

| No | Yang dicoba | Yang seharusnya terjadi | Hasil | Catatan |
| --- | --- | --- | --- | --- |
| 1.1 | Halaman baru terbuka | NVDA menyebutkan judul halaman, bukan hanya nama berkas | | |
| 1.2 | Tekan `Tab` sekali | Yang terdengar adalah "Lewati ke isi utama" | | |
| 1.3 | Tekan `Enter` pada tautan lewati | Fokus pindah ke isi utama, bukan tetap di atas | | |
| 1.4 | Tekan `D` berulang kali | Terdengar wilayah banner, utama, dan info | | |
| 1.5 | Tekan `H` berulang kali sampai akhir | Tidak ada tingkat judul yang melompat, tidak ada judul yang terdengar dua kali | | |
| 1.6 | Tekan `Insert` + `F7`, lihat daftar judul | Tidak ada judul kembar di daftar | | |
| 1.7 | Tekan `K` berulang kali | Setiap tautan punya nama yang bisa dimengerti, tidak ada yang hanya "tautan" atau alamat mentah | | |
| 1.8 | Tekan `G` berulang kali | Gambar tanpa keterangan dilewati diam diam, bukan dibacakan nama berkasnya | | |
| 1.9 | Baca terus dengan `Insert` + panah bawah selama 2 menit | Urutan bacaannya wajar, tidak ada potongan menu yang menyelip di tengah berita | | |
| 1.10 | Cari tautan ke halaman asli | Ada di awal dan di akhir, dan namanya jelas | | |
| 1.11 | Zoom peramban ke 200 persen | Tidak ada gulir mendatar, tidak ada teks terpotong | | |
| 1.12 | Perkecil jendela sampai selebar ponsel | Isinya tetap satu kolom dan tetap terbaca | | |

## Bagian 2. UI alat ini

Jalankan `npm run serve`, lalu buka `http://127.0.0.1:4173`.

| No | Yang dicoba | Yang seharusnya terjadi | Hasil | Catatan |
| --- | --- | --- | --- | --- |
| 2.1 | Tekan `Tab` dari awal, catat urutannya | Tautan lewati lebih dulu, lalu menu, lalu daftar situs | | |
| 2.2 | Pilih satu situs dengan `Enter` | Terdengar pengumuman bahwa hasil sedang dimuat | | |
| 2.3 | Tunggu hasil muncul | Terdengar pengumuman bahwa hasil sudah siap, tanpa perlu mencari sendiri | | |
| 2.4 | Tekan `Insert` + `F7`, lihat daftar judul | Judul bagian hasil masuk daftar dan tingkatnya berurutan | | |
| 2.5 | Buka bagian "Keputusan satu per satu" dengan keyboard | Bisa dibuka tanpa mouse, dan keadaan terbuka atau tertutup diumumkan | | |
| 2.6 | Masuk ke dalam tabel keputusan | Terdengar nama areanya, dan area itu bisa digulir dengan panah | | |
| 2.7 | Baca satu baris tabel | Judul kolom ikut terdengar, bukan hanya isi selnya | | |
| 2.8 | Isi alamat yang salah, misalnya `http://localhost` | Pesan gagal terdengar, dan isinya menjelaskan alasannya | | |
| 2.9 | Isi alamat yang benar, tekan tombol audit | Ada pemberitahuan menunggu, bukan halaman yang diam saja | | |
| 2.10 | Selama menunggu, tekan `Tab` | Tombol audit terdengar tidak aktif, bukan bisa ditekan lagi | | |
| 2.11 | Matikan monitor, coba pilih satu situs hanya dengan telinga | Tugasnya masih bisa diselesaikan | | |
| 2.12 | Zoom 200 persen | Tidak ada tombol yang keluar layar atau tertutup | | |

## Bagian 3. Pembanding

Bagian ini yang paling berguna untuk proposal, dan paling sering dilupakan.
Audit sebelum dan sesudah hanya menghitung node. Bagian ini mengukur apakah
sebuah tugas benar benar bisa diselesaikan.

Pilih satu tugas yang nyata, misalnya "temukan berita terbaru dan buka isinya".

| No | Yang dicoba | Catat |
| --- | --- | --- |
| 3.1 | Kerjakan tugas itu di situs aslinya dengan NVDA | Berapa detik, berapa kali salah arah, selesai atau menyerah |
| 3.2 | Kerjakan tugas yang sama di tampilan mudah dibaca | Berapa detik, berapa kali salah arah, selesai atau menyerah |
| 3.3 | Bandingkan | Selisih waktunya, dan yang lebih penting: apakah yang tadinya gagal jadi berhasil |

Kalau tugas di situs asli gagal diselesaikan dan di tampilan mudah dibaca
berhasil, itu bukti yang jauh lebih kuat daripada angka persen mana pun.

## Cara menulis hasilnya

- Tulis apa yang terdengar, apa adanya, bukan apa yang seharusnya terdengar
- Kalau ada yang aneh tetapi tidak yakin salah, tulis tetap, tandai "perlu dicek"
- Sebutkan versi NVDA, peramban, dan tanggal pengujian di bawah
- Baris yang gagal langsung jadi daftar kerja, bukan alasan menurunkan klaim

```
Diuji oleh    :
Tanggal       :
Versi NVDA    :
Peramban      :
Versi alat    : lihat package.json
Berkas diuji  :
```

## Yang tidak boleh dilakukan

- Menulis "lolos" pada baris yang belum dicoba
- Menyebut alat ini kompatibel penuh dengan NVDA. Yang benar adalah kami menguji
  sejumlah tugas tertentu dengan NVDA pada tanggal tertentu, dan hasilnya ada di
  berkas ini
- Menganggap nol violation dari axe sebagai bukti bisa dipakai
- Mengubah kode hanya supaya baris di sini terlihat hijau tanpa mencoba ulang
