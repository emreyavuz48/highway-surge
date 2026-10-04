# 🏎️ Highway Surge — HTML5 Canvas Racing Game

An arcade endless racing game built with **pure Vanilla JavaScript** and **HTML5 Canvas API**, featuring responsive mobile touch controls and procedural audio synthesis.

🎮 **[▶️ Play Live Demo](https://highwaysurgegamendless.netlify.app/)**

![Highway Surge Screenshot](https://img.shields.io/badge/Engine-Vanilla_JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![HTML5 Canvas](https://img.shields.io/badge/Rendering-HTML5_Canvas-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![Web Audio](https://img.shields.io/badge/Audio-Web_Audio_API-4A90D9?style=for-the-badge)
![Mobile Ready](https://img.shields.io/badge/Mobile-Touch_Ready-2ECC71?style=for-the-badge)

---

## ✨ Features

- **Pure JavaScript & Canvas 2D** — Built without external game engines (no Phaser, Pixi, or Unity). Zero dependencies, instant load times, 60 FPS.
- **Procedural Audio Engine** — Dynamic engine hum, crashes, overtakes, and coin sounds synthesized in real-time using the **Web Audio API**. No external audio files.
- **Cross-Platform Controls** — Desktop (WASD / Arrow Keys) and Mobile (Custom on-screen touch pedals & steering).
- **Complete Game Loop** — Garage system with 12 unlockable vehicles, coin economy, score multipliers, near-miss overtakes, fever mode, daily rewards, and lucky wheel mini-game.
- **Persistent Progress** — High scores, unlocked cars, coins, and settings saved via localStorage.
- **Multi-Platform SDK Support** — Ready for standalone web, CrazyGames, Poki, GameDistribution, and Capacitor (Android/iOS).

---

## 🛠️ Tech Stack

| Technology | Usage |
|---|---|
| **Vanilla JavaScript (ES6+)** | Core game engine, physics, state management |
| **HTML5 Canvas API** | 2D rendering — all cars, roads, and environments drawn procedurally |
| **Web Audio API** | Real-time audio synthesis (oscillators, filters, noise buffers) |
| **CSS3** | Cyberpunk-themed HUD, menus, and responsive layouts |
| **Google Fonts** | Orbitron + Rajdhani typography |

---

## 🚀 How to Run Locally

1. **Clone the repo:**
   ```bash
   git clone https://github.com/emreyavuz48/highway-surge.git
   ```

2. **Serve via any local HTTP server:**
   ```bash
   # Using Node.js:
   npx serve .
   
   # Or Python 3:
   python3 -m http.server 8000
   ```

3. **Open in browser:**
   ```
   http://localhost:8000
   ```

   Or simply open `index.html` directly in your browser.

---

## 🎮 Controls

| Input | Desktop | Mobile |
|---|---|---|
| **Steer Left/Right** | `← →` or `A D` | On-screen ◀ ▶ buttons |
| **Accelerate** | `↑` or `W` | On-screen ▲ button |
| **Brake** | `↓` or `S` | On-screen ▼ button |
| **Pause** | `ESC` or `P` | ⏸️ button |

---

## 🏗️ Project Structure

```
highway-surge/
├── index.html    # Game canvas, HUD, screens, modals, touch controls
├── game.js       # Core engine: rendering, physics, audio, state management
└── styles.css    # Cyberpunk UI theme, responsive layout, animations
```

---

## 📱 Mobile App Export

The game is structured to work inside **Capacitor** for native Android/iOS builds:

```bash
npm init @capacitor/app
npx cap add android
npx cap copy android
npx cap open android
```

---

## 📄 License

This project is shared for portfolio and educational purposes.

---

## 👤 Author

**Emre Yavuz**  
- GitHub: [@emreyavuz48](https://github.com/emreyavuz48)  
- LinkedIn: [emreyavuz](https://www.linkedin.com/in/-emreyavuz-)
