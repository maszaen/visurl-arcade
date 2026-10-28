# Q-Learning Games (VisuRL Arcade) 🕹️🎛️

Platform arcade dan laboratorium **Reinforcement Learning** interaktif berbasis Next.js dengan antarmuka bertema **FL Studio DAW** (Digital Audio Workstation). 

Aplikasi ini mendemokan bagaimana agen AI dapat belajar dari nol secara mandiri (*self-learning*) menggunakan algoritma **Q-Learning Tabular**, **Deep Q-Learning (MLP Neural Network)**, dan **Heuristic Search**.

---

## ✨ Fitur Utama

- **🎛️ FL Studio Hardware Aesthetic**: Desain gelap industrial dengan beveled chassis, tombol DAW metalik, layar LCD digital 7-segment oranye/hijau, LED indicator, fader/tempo segment switchers, dan panel bergaya rack module.
- **🔍 Lobby Arcade & Search Engine**: Menu awal dengan pencarian instan berdasarkan judul, tag, atau algoritma, filter kategori (Q-Table, Neural Net, Multi-Agent), serta ringkasan state space dan action space.
- **⚡ Parallel Multi-Agent Training**: Empat agen berjalan simultan di atas satu otak bersama (Shared Q-Table / Shared Neural Network) untuk mempercepat eksplorasi.
- **🎮 Mode Realtime (Playground)**: Mode di mana bot bermain sendiri secara eksploitatif dengan animasi halus, drop physics, rotasi, deteksi baris, dan partikel pecahan balok.
- **📈 Kurva Belajar Interaktif**: Grafik canvas dinamis yang memetakan performa moving average tiap 20 game dengan area glow.
- **💾 Backup & Portabilitas Otak**: Fitur Ekspor/Impor bobot dan tabel Q dalam format JSON, auto-save ke `localStorage`, dan tombol *Urungkan* (Undo).
- **🧩 Arsitektur Modular**: Sangat mudah menambahkan game RL baru hanya dengan menambahkan 1 folder game dan mendaftarkannya di registry.

---

## 🎮 Game yang Tersedia

### 1. Tetris AI
- **Algoritma**: Deep Q-Learning (Temporal Difference) dengan Multi-Layer Perceptron (10 input geometris, 24 neuron tersembunyi `tanh`, 1 output nilai Q).
- **Fitur State**: Lubang (*holes*), ketidakrataan permukaan (*bumpiness*), tinggi agregat (*aggregate height*), sumur (*wells*), serta transisi baris dan kolom.
- **Mode**: 
  - *Training*: 4 papan berjalan paralel dengan tempo hingga 150x turbo.
  - *Real Mode*: Animasi pergerakan bidak, rotasi dinamis, preview bidak berikutnya (*2-step lookahead*), dan deteksi *Papan Bersih (Win)*.

### 2. Snake Xenzia AI
- **Algoritma**: Tabular Q-Learning (144 state diskrit) yang dipadukan dengan BFS Reachability (*flood-fill algorithm*).
- **Fitur Sensor**: Deteksi bahaya di depan, kanan, dan kiri (tembok, tubuh sendiri, atau jebakan kantong buntu), arah apel relatif, dan status panjang tubuh.
- **Mode**:
  - *Training*: 4 agen ular simultan dengan reward +10 saat memakan apel, -10 saat tabrakan, dan reward diferensial jarak.
  - *Real Mode*: Animasi ular meluncur dengan ledakan partikel saat memakan apel serta status tindakan bot secara real-time.

### 3. GridWorld Maze AI
- **Algoritma**: Q-Learning klasik pada grid 8x8 licin (*stochastic transitions*).
- **Fitur Khusus**: Visualisasi panah kebijakan (*policy vector arrows*) langsung di atas canvas setiap ubin untuk menganalisis konvergensi Q-table.

---

## 🛠️ Cara Menambahkan Game Baru

Arsitektur aplikasi dirancang modular. Untuk menambah game baru:

1. Buat folder baru di `src/games/<nama-game>/`
2. Buat komponen game Anda (contoh `FlappyBirdGame.tsx`) menggunakan komponen UI FL Studio yang telah disediakan:
   - `FLPanel`: Container chassis berpenutup baut dengan header strip.
   - `FLLcd`: Layar LCD angka digital dengan glow oranye/hijau.
   - `FLButton`: Tombol DAW dengan state active, danger, atau LED indicator.
   - `FLSegmented`: Tombol radio multi-segmen (misal untuk pengatur tempo).
   - `LearningChart`: Grafik kurva belajar canvas.
3. Daftarkan game Anda di `src/games/registry.ts` pada array `GAME_REGISTRY`:
   ```ts
   {
     id: 'flappy',
     name: 'Flappy Q-Bird',
     tagline: 'Q-Learning penerbangan burung melewati rintangan pipa',
     description: '...',
     algorithm: 'Q-Table',
     agentsCount: 4,
     tags: ['Flappy', 'Physics', 'Q-Table'],
     stateSpace: 'Jarak Horisontal & Vertikal Pipa',
     actionSpace: '2 Aksi (Flap, Do Nothing)',
     rewardScheme: 'Lewat Pipa: +5 / Tabrakan: -10',
     badge: 'Physics RL',
     accentColor: '#facc15',
     isReady: true,
     version: '1.0.0',
     component: FlappyBirdGame,
   }
   ```
4. Game otomatis tampil di Arcade Lobby, Search Bar, Category Filter, dan Tab Navigasi Master!

---

## 🚀 Menjalankan Secara Lokal

Pastikan Anda telah menginstal **Node.js** (v18+).

```bash
# 1. Masuk ke direktori
cd visurl-arcade

# 2. Install dependensi
npm install

# 3. Jalankan server pengembang
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser Anda.

### Build untuk Produksi

```bash
npm run build
npm run start
```

---

## 📐 Lisensi
MIT License - bebas dikembangkan dan dimodifikasi untuk riset, edukasi, maupun arcade game.
