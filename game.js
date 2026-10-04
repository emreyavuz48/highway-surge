/* =====================================================
   HIGHWAY SURGE - Main Game Engine
   ===================================================== */

// =====================================================
// PLATFORM SDK DETECTION & WRAPPER
// =====================================================
const PlatformSDK = {
    platform: 'standalone', // 'crazygames', 'poki', 'standalone'
    isReady: false,
    sdk: null,
    data: {}, // Local cache of game data

    async init() {
        // Priority 1: CrazyGames (primary platform)
        if (typeof window.CrazyGames !== 'undefined') {
            try {
                this.sdk = window.CrazyGames.SDK;
                await this.sdk.init();
                this.platform = 'crazygames';
                this.isReady = true;
                console.log('✅ CrazyGames SDK initialized');
                await this.loadCloudData();
                return;
            } catch (e) {
                console.log('CrazyGames SDK not available', e);
            }
        }

        // Priority 2: Poki
        if (typeof PokiSDK !== 'undefined') {
            try {
                await PokiSDK.init();
                this.platform = 'poki';
                this.isReady = true;
                console.log('✅ Poki SDK initialized');
                return;
            } catch (e) {
                console.log('Poki SDK not available');
            }
        }

        // Priority 3: GameDistribution (for mass distribution)
        if (typeof gdsdk !== 'undefined') {
            this.platform = 'gamedistribution';
            this.isReady = true;
            console.log('✅ GameDistribution SDK recognized');
            return;
        }

        // Fallback: Standalone mode
        console.log('📱 Running in standalone mode (no ad SDK)');
        this.isReady = true;
    },

    // Load data from CrazyGames Cloud
    async loadCloudData() {
        if (this.platform !== 'crazygames' || !this.sdk) return;

        const keys = [
            'trafficRacerMusicVol', 'trafficRacerSfxVol', 'trafficRacerSensitivity',
            'trafficRacerHighScore', 'trafficRacerCoins',
            'trafficRacerOwnedCars', 'trafficRacerSelectedCar', 'trafficRacerDifficulty',
            'trafficRacerTotalCoinsEarned', 'trafficRacerGamesPlayed'
        ];

        try {
            // Check usage for guest vs logged in is handled by SDK
            // We load one by one or getting all isn't supported directly usually in v3
            for (const key of keys) {
                const val = await this.sdk.data.getItem(key);
                if (val !== null && val !== undefined) {
                    this.data[key] = val;
                }
            }
            console.log('☁️ Cloud data loaded', this.data);
        } catch (e) {
            console.error('Error loading cloud data:', e);
        }
    },

    // Unified Data Get
    getData(key) {
        // If we have it in cloud cache, use it
        if (this.platform === 'crazygames' && this.sdk) {
            return this.data[key] || localStorage.getItem(key);
        }
        // Fallback to local storage
        return localStorage.getItem(key);
    },

    // Unified Data Save
    saveData(key, value) {
        // Update local cache
        this.data[key] = value;
        // Update local storage always as backup/guest
        localStorage.setItem(key, value);

        // Sync to cloud
        if (this.platform === 'crazygames' && this.sdk) {
            // Convert numbers/objects to string if needed, though SDK usually handles strings best
            const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
            this.sdk.data.setItem(key, strValue);
        }
    },

    // Show interstitial ad (at game over or level transitions)
    async showInterstitialAd() {
        return new Promise((resolve) => {
            if (this.platform === 'gamedistribution') {
                // Check if gdsdk is available and ready
                if (typeof gdsdk !== 'undefined' && typeof gdsdk.showAd === 'function') {
                    try {
                        gdsdk.showAd();
                        console.log('🎬 GD Interstitial ad requested');
                        resolve(true);
                    } catch (e) {
                        console.error('GD Ad error:', e);
                        resolve(false);
                    }
                } else {
                    console.log('GD SDK not ready for ads');
                    resolve(false);
                }
            } else if (this.platform === 'crazygames' && this.sdk) {
                this.sdk.ad.requestAd('midroll', {
                    adStarted: () => console.log('Midroll started'),
                    adFinished: () => resolve(true),
                    adError: (error) => resolve(false)
                });
            } else if (this.platform === 'poki') {
                PokiSDK.commercialBreak().then(() => resolve(true)).catch(() => resolve(false));
            } else {
                resolve(true);
            }
        });
    },

    // Show rewarded ad
    async showRewardedAd() {
        return new Promise((resolve) => {
            if (this.platform === 'gamedistribution') {
                // Check if gdsdk is available and ready
                if (typeof gdsdk !== 'undefined' && typeof gdsdk.showAd === 'function') {
                    try {
                        // Set up callback to be called by GD_OPTIONS onEvent
                        window.gdAdWatched = false;
                        window.gdRewardedAdCallback = (success) => {
                            console.log('🎬 GD Rewarded ad result:', success);
                            resolve(success);
                        };
                        gdsdk.showAd('rewarded');
                        console.log('🎬 GD Rewarded ad requested');
                    } catch (e) {
                        console.error('GD Rewarded Ad error:', e);
                        window.gdRewardedAdCallback = null;
                        resolve(false);
                    }
                } else {
                    console.log('GD SDK not ready for rewarded ads');
                    resolve(false);
                }
            } else if (this.platform === 'crazygames' && this.sdk) {
                this.sdk.ad.requestAd('rewarded', {
                    adStarted: () => console.log('Ad started'),
                    adFinished: () => resolve(true),
                    adError: (error) => {
                        console.error('Ad error:', error);
                        resolve(false);
                    }
                });
            } else if (this.platform === 'poki') {
                PokiSDK.rewardedBreak().then(() => {
                    resolve(true);
                }).catch(() => {
                    resolve(false);
                });
            } else {
                // Simulate ad for standalone
                resolve(this.simulateAd());
            }
        });
    },

    // Simulate ad for testing
    simulateAd() {
        return new Promise((resolve) => {
            showAdLoadingOverlay();
            setTimeout(() => {
                hideAdLoadingOverlay();
                resolve(true);
            }, 2000);
        });
    },

    // Game loading progress
    gameLoadingStart() {
        if (this.platform === 'poki') {
            PokiSDK.gameLoadingStart();
        } else if (this.platform === 'crazygames' && this.sdk) {
            this.sdk.game.loadingStart();
        }
    },

    gameLoadingFinished() {
        if (this.platform === 'poki') {
            PokiSDK.gameLoadingFinished();
        } else if (this.platform === 'crazygames' && this.sdk) {
            this.sdk.game.loadingStop();
        }
    },

    // Gameplay events
    gameplayStart() {
        if (this.platform === 'poki') {
            PokiSDK.gameplayStart();
        } else if (this.platform === 'crazygames' && this.sdk) {
            this.sdk.game.gameplayStart();
        }
    },

    gameplayStop() {
        if (this.platform === 'poki') {
            PokiSDK.gameplayStop();
        } else if (this.platform === 'crazygames' && this.sdk) {
            this.sdk.game.gameplayStop();
        }
    },

    // Happy time (for high scores)
    happyTime(intensity = 0.5) {
        if (this.platform === 'poki') {
            PokiSDK.happyTime(intensity);
        } else if (this.platform === 'crazygames' && this.sdk) {
            this.sdk.game.happytime();
        }
    }
};

// =====================================================
// SETTINGS MANAGEMENT
// =====================================================
const Settings = {
    musicVolume: 30,
    sfxVolume: 50,
    sensitivity: 5,

    init() {
        // Load saved settings
        this.musicVolume = parseInt(PlatformSDK.getData('trafficRacerMusicVol')) || 30;
        this.sfxVolume = parseInt(PlatformSDK.getData('trafficRacerSfxVol')) || 50;
        this.sfxVolume = parseInt(PlatformSDK.getData('trafficRacerSfxVol')) || 50;
        this.sensitivity = parseInt(PlatformSDK.getData('trafficRacerSensitivity')) || 5;
        // Default to 'buttons' on mobile for immediate visibility
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.controlType = PlatformSDK.getData('trafficRacerControlType') || 'buttons';

        // Apply settings
        this.apply();

        // Setup UI handlers
        this.setupUI();
    },

    setupUI() {
        const musicSlider = document.getElementById('music-volume');
        const sfxSlider = document.getElementById('sfx-volume');
        const sensitivitySlider = document.getElementById('sensitivity');

        if (musicSlider) {
            musicSlider.value = this.musicVolume;
            musicSlider.addEventListener('input', (e) => {
                this.musicVolume = parseInt(e.target.value);
                this.apply();
                this.save();
            });
        }

        if (sfxSlider) {
            sfxSlider.value = this.sfxVolume;
            sfxSlider.addEventListener('input', (e) => {
                this.sfxVolume = parseInt(e.target.value);
                this.apply();
                this.save();
            });
            // Test sound on change
            sfxSlider.addEventListener('change', () => {
                SoundSystem.playCoin();
            });
        }

        if (sensitivitySlider) {
            sensitivitySlider.value = this.sensitivity;
            sensitivitySlider.addEventListener('input', (e) => {
                this.sensitivity = parseInt(e.target.value);
                this.save();
            });
        }

        // Mobile Control Type Toggle Buttons
        const buttonsBtn = document.getElementById('ctrl-buttons-btn');
        const swipeBtn = document.getElementById('ctrl-swipe-btn');

        const updateControlButtons = () => {
            if (buttonsBtn && swipeBtn) {
                if (this.controlType === 'buttons') {
                    buttonsBtn.classList.add('active');
                    swipeBtn.classList.remove('active');
                } else {
                    swipeBtn.classList.add('active');
                    buttonsBtn.classList.remove('active');
                }
            }
        };

        if (buttonsBtn) {
            buttonsBtn.addEventListener('click', () => {
                this.controlType = 'buttons';
                this.apply();
                this.save();
                updateControlButtons();
            });
        }

        if (swipeBtn) {
            swipeBtn.addEventListener('click', () => {
                this.controlType = 'swipe';
                this.apply();
                this.save();
                updateControlButtons();
            });
        }

        // Initial state
        updateControlButtons();
    },

    apply() {
        if (SoundSystem.audioContext) {
            SoundSystem.setMusicVolume(this.musicVolume / 100);
            SoundSystem.setSfxVolume(this.sfxVolume / 100);
        }

        // Apply control visibility
        this.updateTouchControlsVisibility();
    },

    updateTouchControlsVisibility() {
        const touchControls = document.getElementById('touch-controls');
        if (!touchControls) return;

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isMobileDevice = isMobile || hasTouch;

        // Show buttons ONLY if:
        // 1. Device is mobile/touch AND
        // 2. Control type is 'buttons' AND
        // 3. Game is in 'playing' state (NOT in menu/settings)
        if (isMobileDevice && this.controlType === 'buttons' && game.state === 'playing') {
            touchControls.style.display = 'flex';
        } else {
            touchControls.style.display = 'none';
        }
    },

    save() {
        PlatformSDK.saveData('trafficRacerMusicVol', this.musicVolume);
        PlatformSDK.saveData('trafficRacerSfxVol', this.sfxVolume);
        PlatformSDK.saveData('trafficRacerSensitivity', this.sensitivity);
        PlatformSDK.saveData('trafficRacerControlType', this.controlType);
    },

    getSensitivityMultiplier() {
        // Map 1-10 to 0.5-2.0 multiplier
        return 0.5 + (this.sensitivity / 5) * 0.5;
    }
};

// =====================================================
// SOUND SYSTEM (Web Audio API)
// =====================================================
const SoundSystem = {
    audioContext: null,
    sounds: {},
    musicGain: null,
    sfxGain: null,
    engineOscillator: null,
    engineGain: null,
    bgMusicOscillators: null,
    bgMusicGain: null,
    bgMusicPlaying: false,
    isEngineRunning: false,
    sfxEnabled: true,
    musicEnabled: true,

    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create gain nodes for volume control
            this.musicGain = this.audioContext.createGain();
            this.musicGain.gain.value = Settings.musicVolume / 100;
            this.musicGain.connect(this.audioContext.destination);

            this.sfxGain = this.audioContext.createGain();
            this.sfxGain.gain.value = Settings.sfxVolume / 100;
            this.sfxGain.connect(this.audioContext.destination);

            // BG Music Gain Node specific
            this.bgMusicGain = this.audioContext.createGain();
            this.bgMusicGain.connect(this.musicGain);

            console.log('🔊 Sound system initialized');
        } catch (e) {
            console.log('Sound system not available');
        }
    },

    setMusicVolume(val) {
        if (this.musicGain) this.musicGain.gain.setTargetAtTime(val, this.audioContext.currentTime, 0.1);
    },

    setSfxVolume(val) {
        if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(val, this.audioContext.currentTime, 0.1);
    },

    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    },

    // Generate procedural engine sound
    startEngine() {
        if (!this.audioContext || this.isEngineRunning) return;
        this.resume();

        // Create oscillator for engine sound
        this.engineOscillator = this.audioContext.createOscillator();
        this.engineGain = this.audioContext.createGain();

        // Low frequency sawtooth wave for engine rumble
        this.engineOscillator.type = 'sawtooth';
        this.engineOscillator.frequency.value = 80;
        this.engineGain.gain.value = 0.08;

        // Add low-pass filter for more realistic engine sound
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200;

        this.engineOscillator.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.sfxGain);

        this.engineOscillator.start();
        this.isEngineRunning = true;
    },

    updateEngineSound(speed, maxSpeed) {
        if (!this.engineOscillator || !this.isEngineRunning) return;

        // Adjust frequency based on speed (higher speed = higher pitch)
        const minFreq = 60;
        const maxFreq = 180;
        const speedRatio = speed / maxSpeed;
        const freq = minFreq + (maxFreq - minFreq) * speedRatio;

        this.engineOscillator.frequency.setTargetAtTime(freq, this.audioContext.currentTime, 0.1);

        // Adjust volume based on speed
        const minVol = 0.05;
        const maxVol = 0.12;
        const vol = minVol + (maxVol - minVol) * speedRatio;
        this.engineGain.gain.setTargetAtTime(vol, this.audioContext.currentTime, 0.1);
    },

    stopEngine() {
        if (this.engineOscillator && this.isEngineRunning) {
            this.engineGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.1);
            setTimeout(() => {
                if (this.engineOscillator) {
                    this.engineOscillator.stop();
                    this.engineOscillator = null;
                }
            }, 200);
            this.isEngineRunning = false;
        }
    },

    // Play coin collect sound
    playCoin() {
        if (!this.audioContext || !this.sfxEnabled) return;
        this.resume();

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, this.audioContext.currentTime + 0.1);

        gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.audioContext.currentTime + 0.2);
    },

    // Play crash sound
    playCrash() {
        if (!this.audioContext || !this.sfxEnabled) return;
        this.resume();

        // White noise for crash
        const bufferSize = this.audioContext.sampleRate * 0.3;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
        }

        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;

        const gain = this.audioContext.createGain();
        gain.gain.value = 0.5;

        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        noise.start();
    },

    // Play overtake bonus sound
    playOvertake() {
        if (!this.audioContext || !this.sfxEnabled) return;
        this.resume();

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523, this.audioContext.currentTime);
        osc.frequency.setValueAtTime(659, this.audioContext.currentTime + 0.05);
        osc.frequency.setValueAtTime(784, this.audioContext.currentTime + 0.1);

        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.audioContext.currentTime + 0.2);
    },

    // Power-up collection sound
    playPowerup() {
        if (!this.audioContext || !this.sfxEnabled) return;
        this.resume();

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.audioContext.currentTime + 0.1);
        osc.frequency.exponentialRampToValueAtTime(1320, this.audioContext.currentTime + 0.2);

        gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.audioContext.currentTime + 0.3);
    },

    // Fever mode activation sound
    playFever() {
        if (!this.audioContext || !this.sfxEnabled) return;
        this.resume();

        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'square';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0, this.audioContext.currentTime + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.2, this.audioContext.currentTime + i * 0.1 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + i * 0.1 + 0.2);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(this.audioContext.currentTime + i * 0.1);
            osc.stop(this.audioContext.currentTime + i * 0.1 + 0.3);
        });
    },

    // Achievement unlock sound
    playAchievement() {
        if (!this.audioContext || !this.sfxEnabled) return;
        this.resume();

        const melody = [392, 523, 659, 784];
        melody.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'triangle';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0.25, this.audioContext.currentTime + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + i * 0.15 + 0.3);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(this.audioContext.currentTime + i * 0.15);
            osc.stop(this.audioContext.currentTime + i * 0.15 + 0.4);
        });
    },

    // Tire screech on lane change
    playTireScreech() {
        if (!this.audioContext || !this.sfxEnabled) return;
        this.resume();

        const bufferSize = this.audioContext.sampleRate * 0.15;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }

        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;

        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2000;

        const gain = this.audioContext.createGain();
        gain.gain.value = 0.08;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        noise.start();
    },

    // Background music (procedural synth loop)
    bgMusicOsc: null,
    bgMusicGain: null,
    bgMusicPlaying: false,

    startBackgroundMusic() {
        if (!this.audioContext || !this.musicEnabled || this.bgMusicPlaying) return;
        this.resume();

        // Create a simple ambient pad sound
        this.bgMusicGain = this.audioContext.createGain();
        this.bgMusicGain.gain.value = 0;
        this.bgMusicGain.connect(this.musicGain);

        // Multiple oscillators for rich sound
        const frequencies = [130.81, 164.81, 196, 261.63]; // C major chord
        this.bgMusicOscillators = frequencies.map(freq => {
            const osc = this.audioContext.createOscillator();
            const oscGain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;
            oscGain.gain.value = 0.1;

            osc.connect(oscGain);
            oscGain.connect(this.bgMusicGain);
            osc.start();

            return osc;
        });

        // Fade in
        this.bgMusicGain.gain.setTargetAtTime(0.15, this.audioContext.currentTime, 0.5);
        this.bgMusicPlaying = true;
    },

    stopBackgroundMusic() {
        if (!this.bgMusicPlaying || !this.bgMusicGain) return;

        this.bgMusicGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.3);

        setTimeout(() => {
            if (this.bgMusicOscillators) {
                this.bgMusicOscillators.forEach(osc => {
                    try { osc.stop(); } catch (e) { }
                });
                this.bgMusicOscillators = null;
            }
        }, 500);

        this.bgMusicPlaying = false;
    },

    // Menu music
    playMenuMusic() {
        this.startBackgroundMusic();
    },

    stopMenuMusic() {
        this.stopBackgroundMusic();
    }
};

// Leaderboard system removed — replaced by My Stats screen

// =====================================================
// SOCIAL SHARING
// =====================================================
const SocialShare = {
    gameUrl: window.location.href,
    gameName: 'Highway Surge',

    getShareText(score) {
        return `🏎️ I scored ${score} points in ${this.gameName}! Can you beat my score? Play now:`;
    },

    shareTwitter(score) {
        const text = encodeURIComponent(this.getShareText(score));
        const url = encodeURIComponent(this.gameUrl);
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'width=600,height=400');
    },

    shareFacebook(score) {
        const url = encodeURIComponent(this.gameUrl);
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${encodeURIComponent(this.getShareText(score))}`, '_blank', 'width=600,height=400');
    },

    shareWhatsApp(score) {
        const text = encodeURIComponent(`${this.getShareText(score)} ${this.gameUrl}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    },

    async copyLink(score) {
        const text = `${this.getShareText(score)} ${this.gameUrl}`;
        try {
            await navigator.clipboard.writeText(text);
            showToast('Link copied!', 'success');
            return true;
        } catch (e) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('Link copied!', 'success');
            return true;
        }
    },

    // Native share (mobile)
    async nativeShare(score) {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: this.gameName,
                    text: this.getShareText(score),
                    url: this.gameUrl
                });
                return true;
            } catch (e) {
                return false;
            }
        }
        return false;
    }
};

// =====================================================
// DIFFICULTY SETTINGS
// =====================================================
const DIFFICULTY_SETTINGS = {
    easy: {
        trafficDensity: 0.6,
        maxSpeed: 12,
        scoreMultiplier: 0.8,
        spawnInterval: 80,
        label: 'EASY'
    },
    medium: {
        trafficDensity: 1.0,
        maxSpeed: 15,
        scoreMultiplier: 1.0,
        spawnInterval: 60,
        label: 'MEDIUM'
    },
    hard: {
        trafficDensity: 1.5,
        maxSpeed: 18,
        scoreMultiplier: 1.5,
        spawnInterval: 40,
        label: 'HARD'
    }
};

// =====================================================
// GAME CONFIGURATION
// =====================================================
const CONFIG = {
    // Canvas
    WIDTH: 480,
    HEIGHT: 800,

    // Road
    ROAD_WIDTH: 340,
    LANE_COUNT: 4,
    ROAD_SEGMENT_HEIGHT: 200,

    // Player
    PLAYER_WIDTH: 55,
    PLAYER_HEIGHT: 100,
    PLAYER_START_Y: 0.70, // Percentage from top
    LANE_CHANGE_SPEED: 8,

    // Speed (pixels per frame at 60fps)
    MIN_SPEED: 3,
    MAX_SPEED: 15,
    ACCELERATION: 0.1,
    DECELERATION: 0.15,

    // Traffic
    TRAFFIC_SPAWN_INTERVAL: 60, // frames
    MIN_TRAFFIC_SPEED: 1,
    MAX_TRAFFIC_SPEED: 4,

    // Scoring
    SCORE_PER_FRAME: 0.5,
    OVERTAKE_BONUS: 50,
    OVERTAKE_COINS: 5,
    SPEED_MULTIPLIER_THRESHOLD: 200, // km/h

    // Difficulty
    DIFFICULTY_INCREASE_INTERVAL: 1000, // score
    MAX_DIFFICULTY: 10,

    // Revive
    REVIVE_COST: 100,
    COUNTDOWN_DURATION: 3, // seconds

    // Power-ups
    POWERUP_SPAWN_INTERVAL: 400,
    POWERUP_DURATION: 5000,

    // Combo/Fever
    FEVER_THRESHOLD: 5,
    FEVER_DURATION: 8000,
    FEVER_MULTIPLIER: 2,
};

// =====================================================
// POWER-UP TYPES
// =====================================================
const POWERUP_TYPES = {
    SHIELD: { id: 'shield', name: 'Shield', color: '#3498db', icon: '🛡️', duration: 5000 },
    MAGNET: { id: 'magnet', name: 'Magnet', color: '#9b59b6', icon: '🧲', duration: 6000 },
    DOUBLE_SCORE: { id: 'double_score', name: '2x Score', color: '#f39c12', icon: '⭐', duration: 8000 },
    SPEED_BOOST: { id: 'speed_boost', name: 'Speed Boost', color: '#e74c3c', icon: '🚀', duration: 4000 },
    SLOW_MO: { id: 'slow_mo', name: 'Slow Motion', color: '#1abc9c', icon: '⏱️', duration: 5000 },
};

// =====================================================
// ACHIEVEMENTS
// =====================================================
const ACHIEVEMENTS = [
    { id: 'road_warrior_1', name: 'Road Warrior I', desc: 'Travel 1 km', type: 'distance', target: 1000, reward: 100 },
    { id: 'road_warrior_2', name: 'Road Warrior II', desc: 'Travel 5 km', type: 'distance', target: 5000, reward: 500 },
    { id: 'road_warrior_3', name: 'Road Warrior III', desc: 'Travel 10 km', type: 'distance', target: 10000, reward: 1000 },
    { id: 'coin_collector_1', name: 'Coin Collector I', desc: 'Collect 1000 coins', type: 'coins', target: 1000, reward: 200 },
    { id: 'coin_collector_2', name: 'Coin Collector II', desc: 'Collect 5000 coins', type: 'coins', target: 5000, reward: 1000 },
    { id: 'overtaker_1', name: 'Overtaker I', desc: 'Overtake 50 cars', type: 'overtakes', target: 50, reward: 150 },
    { id: 'overtaker_2', name: 'Overtaker II', desc: 'Overtake 200 cars', type: 'overtakes', target: 200, reward: 600 },
    { id: 'speed_demon', name: 'Speed Demon', desc: 'Reach 280 km/h', type: 'speed', target: 280, reward: 300 },
    { id: 'fever_master', name: 'Fever Master', desc: 'Trigger fever 10 times', type: 'fever', target: 10, reward: 500 },
    { id: 'survivor', name: 'Survivor', desc: 'Survive 60 seconds no-hit', type: 'survival', target: 60, reward: 400 },
];

// =====================================================
// DAILY REWARDS
// =====================================================
const DAILY_REWARDS = [
    { day: 1, coins: 100, bonus: null },
    { day: 2, coins: 150, bonus: null },
    { day: 3, coins: 200, bonus: null },
    { day: 4, coins: 300, bonus: null },
    { day: 5, coins: 400, bonus: null },
    { day: 6, coins: 500, bonus: null },
    { day: 7, coins: 1000, bonus: 'midnight_blue' },
];

// =====================================================
// DAILY MISSIONS
// =====================================================
const MISSION_TEMPLATES = [
    { id: 'overtake', desc: 'Overtake {target} cars', targets: [10, 15, 20, 25], reward: 100 },
    { id: 'distance', desc: 'Travel {target} meters', targets: [500, 1000, 2000, 3000], reward: 150 },
    { id: 'coins', desc: 'Collect {target} coins', targets: [100, 200, 300, 500], reward: 100 },
    { id: 'speed', desc: 'Reach {target} km/h', targets: [200, 220, 250, 280], reward: 200 },
    { id: 'fever', desc: 'Trigger fever {target} times', targets: [1, 2, 3], reward: 250 },
];

// =====================================================
// PURCHASABLE CAR MODELS
// =====================================================
const PLAYER_CARS = [
    {
        id: 'navy_racer',
        name: 'Navy Racer',
        price: 0, // Free - starter car
        bodyColor: '#1e3a5f',
        accentColor: '#152a45',
        style: 'muscle',
        hasWing: false,
        owned: true, // Starter car is always owned
    },
    {
        id: 'crimson_sport',
        name: 'Crimson Sport',
        price: 6000,
        bodyColor: '#dc2626',
        accentColor: '#991b1b',
        style: 'sports',
        hasWing: true,
        owned: false,
    },
    {
        id: 'midnight_blue',
        name: 'Midnight Blue',
        price: 10000,
        bodyColor: '#1c3d5a',
        accentColor: '#152d42',
        style: 'sports',
        hasWing: false,
        owned: false,
    },
    {
        id: 'silver_arrow',
        name: 'Silver Arrow',
        price: 12000,
        bodyColor: '#c0c0c0',
        accentColor: '#a0a0a0',
        style: 'sports',
        hasWing: true,
        owned: false,
    },
    {
        id: 'shadow_black',
        name: 'Shadow Black',
        price: 15000,
        bodyColor: '#1a1a1a',
        accentColor: '#333333',
        style: 'sedan',
        hasWing: false,
        owned: false,
    },
    {
        id: 'neon_striker',
        name: 'Neon Striker',
        price: 18000,
        bodyColor: '#00ff88',
        accentColor: '#00cc6a',
        style: 'sports',
        hasWing: true,
        owned: false,
        speedBonus: 0.05,
    },
    {
        id: 'golden_thunder',
        name: 'Golden Thunder',
        price: 22000,
        bodyColor: '#ffd700',
        accentColor: '#daa520',
        style: 'muscle',
        hasWing: false,
        owned: false,
        coinBonus: 0.1,
    },
    {
        id: 'stealth_phantom',
        name: 'Stealth Phantom',
        price: 25000,
        bodyColor: '#2c2c54',
        accentColor: '#1a1a34',
        style: 'sports',
        hasWing: true,
        owned: false,
        smallerHitbox: true,
    },
    {
        id: 'electric_storm',
        name: 'Electric Storm',
        price: 30000,
        bodyColor: '#00d4ff',
        accentColor: '#0099cc',
        style: 'electric',
        hasWing: false,
        owned: false,
        startsWithShield: true,
    },
    {
        id: 'desert_runner',
        name: 'Desert Runner',
        price: 28000,
        bodyColor: '#d2691e',
        accentColor: '#8b4513',
        style: 'muscle',
        hasWing: false,
        owned: false,
        handlingBonus: 0.2,
    },
    {
        id: 'police_interceptor',
        name: 'Police Interceptor',
        price: 35000,
        bodyColor: '#1a1a2e',
        accentColor: '#16213e',
        style: 'sedan',
        hasWing: false,
        owned: false,
        hasSiren: true,
    },
    {
        id: 'ufo_racer',
        name: 'UFO Racer',
        price: 50000,
        bodyColor: '#9400d3',
        accentColor: '#6a0dad',
        style: 'electric',
        hasWing: false,
        owned: false,
        floatingEffect: true,
    },
];

// =====================================================
// CAR MODELS - Traffic cars
// =====================================================
const CAR_MODELS = {
    // Traffic cars
    TRAFFIC: [
        {
            name: 'Onyx Sedan',
            bodyColor: '#0a0a0a',
            accentColor: '#1a1a1a',
            style: 'sedan',
            hasWing: false,
        },
        {
            name: 'Silver Sedan',
            bodyColor: '#c0c0c0',
            accentColor: '#a0a0a0',
            style: 'sedan',
            hasWing: false,
        },
        {
            name: 'Ocean Sedan',
            bodyColor: '#1c3d5a',
            accentColor: '#152d42',
            style: 'sedan',
            hasWing: false,
        },
        {
            name: 'Pearl Sedan',
            bodyColor: '#e8e8e8',
            accentColor: '#d0d0d0',
            style: 'sedan',
            hasWing: false,
        },
        {
            name: 'Cherry Classic',
            bodyColor: '#b91c1c',
            accentColor: '#8b1515',
            style: 'classic',
            hasWing: false,
        },
        {
            name: 'Amber Muscle',
            bodyColor: '#f59e0b',
            accentColor: '#d97706',
            style: 'muscle',
            hasWing: false,
        },
        {
            name: 'Slate Electric',
            bodyColor: '#475569',
            accentColor: '#334155',
            style: 'electric',
            hasWing: false,
        },
        {
            name: 'Stone Sedan',
            bodyColor: '#78716c',
            accentColor: '#57534e',
            style: 'sedan',
            hasWing: false,
        },
        {
            name: 'Golden Sport',
            bodyColor: '#fbbf24',
            accentColor: '#d97706',
            style: 'sports',
            hasWing: true,
        },
    ],
};

// =====================================================
// GAME STATE
// =====================================================
const game = {
    canvas: null,
    ctx: null,
    state: 'menu',
    score: 0,
    highScore: 0,
    coins: 0,
    coinsEarnedThisRun: 0,
    difficulty: 1,
    selectedDifficulty: 'medium',
    selectedCarIndex: 0,
    frameCount: 0,
    lastTime: 0,
    deltaTime: 0,
    isPaused: false,
    revivesUsed: 0,
    maxRevives: 99,  // Allow many revives for coin-based system
    // Power-up state
    activePowerups: {},
    // Combo/Fever state
    combo: 0,
    maxCombo: 0,
    isFever: false,
    feverEndTime: 0,
    totalFeverCount: 0,
    // Achievement tracking
    totalDistance: 0,
    totalCoins: 0,
    totalCoinsEarned: 0,
    gamesPlayed: 0,
    totalOvertakes: 0,
    maxSpeed: 0,
    noHitTimer: 0,
    unlockedAchievements: [],
    // Daily rewards
    lastDailyReward: null,
    dailyStreak: 0,
    // Missions
    dailyMissions: [],
    missionsLastRefresh: null,
    // Night mode
    isNight: false,
    dayNightTimer: 0,
};

// Global reference for SDK callbacks
window.gameInstance = {
    pauseForAd: function () {
        console.log("⏸️ SDK requested pause for ad");
        if (game.state === 'playing') {
            pauseGame();
        }
        // Always mute audio regardless of state
        if (SoundSystem && SoundSystem.audioContext) {
            SoundSystem.audioContext.suspend();
        }
    },
    resumeAfterAd: function () {
        console.log("▶️ SDK requested resume after ad");
        if (game.state === 'paused' || game.isPaused) {
            resumeGame();
        }
        // Always resume audio context
        if (SoundSystem && SoundSystem.audioContext) {
            SoundSystem.audioContext.resume();
        }
    }
};

// =====================================================
// PLAYER
// =====================================================
const player = {
    x: 0,
    y: 0,
    targetX: 0,
    width: CONFIG.PLAYER_WIDTH,
    height: CONFIG.PLAYER_HEIGHT,
    lane: 1, // 0-3
    speed: CONFIG.MIN_SPEED,
    model: PLAYER_CARS[0], // Default to first car
};

// =====================================================
// ROAD
// =====================================================
const road = {
    offset: 0,
    segments: [],
    laneWidth: 0,
    leftEdge: 0,
    rightEdge: 0,
};

// =====================================================
// TRAFFIC
// =====================================================
const traffic = {
    cars: [],
    spawnTimer: 0,
    overtakenCars: new Set(),
    powerups: [],
    powerupSpawnTimer: 0,
};

// =====================================================
// GAME LOOP CONTROL
// =====================================================
let gameLoopId = null;

function stopGameLoop() {
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
    }
}

// =====================================================
// INPUT
// =====================================================
const input = {
    left: false,
    right: false,
    up: false,
    down: false,
};

// =====================================================
// VISUAL EFFECTS
// =====================================================
const effects = {
    screenShake: 0,
    trees: [],
    barriers: [],
};

// =====================================================
// INITIALIZATION
// =====================================================
async function init() {
    // Loading progress helper
    const loadingBar = document.getElementById('loading-bar');
    const loadingText = document.querySelector('.loading-text');
    const updateLoading = (percent, text) => {
        if (loadingBar) loadingBar.style.width = `${percent}%`;
        if (loadingText) loadingText.textContent = text;
    };

    updateLoading(10, 'Initializing...');

    // Get canvas and context
    game.canvas = document.getElementById('gameCanvas');
    game.ctx = game.canvas.getContext('2d');

    updateLoading(20, 'Loading SDK...');

    // Initialize Platform SDK (Non-blocking)
    PlatformSDK.gameLoadingStart();
    await PlatformSDK.init().catch(console.error);

    updateLoading(35, 'Loading settings...');

    // Initialize Settings
    Settings.init();

    // (Leaderboard removed — stats screen used instead)

    updateLoading(50, 'Loading audio...');

    // Initialize Sound System
    SoundSystem.init();

    // Set canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    // Handle mobile orientation changes
    window.addEventListener('orientationchange', () => {
        setTimeout(resizeCanvas, 100); // Delay to allow viewport to update
    });

    updateLoading(65, 'Loading game data...');

    // Load saved data
    loadGameData();
    updateHUD();
    updateMenuCoins();

    updateLoading(80, 'Setting up controls...');

    // Setup input handlers
    setupInputHandlers();

    // Setup button handlers
    // Setup button handlers
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', startGame);
    document.getElementById('garage-btn').addEventListener('click', showGarage);
    document.getElementById('garage-back-btn').addEventListener('click', hideGarage);
    document.getElementById('settings-btn').addEventListener('click', showSettings);
    document.getElementById('settings-back-btn').addEventListener('click', hideSettings);
    document.getElementById('menu-btn').addEventListener('click', showMenu);

    // Coin Shop handlers (replaces ad buttons)
    document.getElementById('buy-coins-btn')?.addEventListener('click', () => CoinShop.show());
    document.getElementById('garage-buy-coins-btn')?.addEventListener('click', () => CoinShop.show());
    document.getElementById('shop-close-btn')?.addEventListener('click', () => CoinShop.hide());

    // Stats screen handlers
    document.getElementById('stats-btn').addEventListener('click', showStats);
    document.getElementById('stats-back-btn').addEventListener('click', hideStats);

    // Social share handlers
    document.getElementById('share-twitter').addEventListener('click', () => SocialShare.shareTwitter(Math.floor(game.score)));
    document.getElementById('share-facebook').addEventListener('click', () => SocialShare.shareFacebook(Math.floor(game.score)));
    document.getElementById('share-whatsapp').addEventListener('click', () => SocialShare.shareWhatsApp(Math.floor(game.score)));
    document.getElementById('share-copy').addEventListener('click', async () => {
        await SocialShare.copyLink(Math.floor(game.score));
        document.getElementById('share-copy').classList.add('copied');
        setTimeout(() => document.getElementById('share-copy').classList.remove('copied'), 2000);
    });

    // Pause handlers
    document.getElementById('pause-btn').addEventListener('click', pauseGame);
    document.getElementById('resume-btn').addEventListener('click', resumeGame);
    document.getElementById('pause-menu-btn').addEventListener('click', pauseToMenu);

    // Revive handlers
    document.getElementById('revive-coins-btn').addEventListener('click', reviveWithCoins);
    document.getElementById('revive-skip-btn').addEventListener('click', skipRevive);
    document.getElementById('revive-menu-btn').addEventListener('click', reviveToMenu);

    // Setup difficulty buttons
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', () => setDifficulty(btn.dataset.difficulty));
    });

    updateLoading(90, 'Building environment...');

    // Initialize road
    initRoad();

    // Initialize environment
    initEnvironment();

    // Create ad loading overlay
    createAdLoadingOverlay();

    // Create toast container
    createToastContainer();

    // Initialize new retention systems
    Tutorial.init();
    MuteToggle.init();

    LuckyWheel.init();

    // Initialize Coin Shop
    // CoinShop.init() removed

    // Control Type Listeners
    document.getElementById('ctrl-buttons-btn').addEventListener('click', () => setControlType('buttons'));
    document.getElementById('ctrl-swipe-btn').addEventListener('click', () => setControlType('swipe'));

    updateLoading(100, 'Ready!');

    // Mark loading as finished
    PlatformSDK.gameLoadingFinished();

    // Hide loading screen with delay for smooth transition
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.classList.add('hidden');
    }, 500);

    // Start game loop
    gameLoopId = requestAnimationFrame(gameLoop);
}

function setControlType(type) {
    Settings.controlType = type;
    PlatformSDK.setData('trafficRacerControlType', type);
    updateControlUI();
}

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
}

function updateControlUI() {
    // Update settings buttons
    const buttonsBtn = document.getElementById('ctrl-buttons-btn');
    const swipeBtn = document.getElementById('ctrl-swipe-btn');

    if (buttonsBtn && swipeBtn) {
        if (Settings.controlType === 'buttons') {
            buttonsBtn.classList.add('active');
            swipeBtn.classList.remove('active');
        } else {
            buttonsBtn.classList.remove('active');
            swipeBtn.classList.add('active');
        }
    }

    // Show/hide touch controls based on setting
    const touchControls = document.getElementById('touch-controls');
    if (touchControls) {
        if (Settings.controlType === 'buttons' && isMobile()) {
            touchControls.style.display = 'flex';
        } else {
            touchControls.style.display = 'none';
        }
    }
}

function loadGameData() {
    // Load high score
    game.highScore = parseInt(PlatformSDK.getData('trafficRacerHighScore')) || 0;

    // Load coins
    game.coins = parseInt(PlatformSDK.getData('trafficRacerCoins')) || 0;

    // Load owned cars
    const ownedCars = JSON.parse(PlatformSDK.getData('trafficRacerOwnedCars') || 'null') || ['navy_racer'];
    PLAYER_CARS.forEach(car => {
        car.owned = ownedCars.includes(car.id);
    });

    // Load selected car
    const selectedCarId = PlatformSDK.getData('trafficRacerSelectedCar') || 'navy_racer';
    game.selectedCarIndex = PLAYER_CARS.findIndex(c => c.id === selectedCarId);
    if (game.selectedCarIndex === -1) game.selectedCarIndex = 0; // Fallback

    // Load control settings
    Settings.controlType = PlatformSDK.getData('trafficRacerControlType') || 'buttons'; // 'buttons' or 'swipe'
    updateControlUI();
    player.model = PLAYER_CARS[game.selectedCarIndex];

    // Load difficulty
    game.selectedDifficulty = PlatformSDK.getData('trafficRacerDifficulty') || 'medium';
    updateDifficultyButtons();

    // Load achievements
    game.unlockedAchievements = JSON.parse(PlatformSDK.getData('trafficRacerAchievements') || '[]');
    game.totalDistance = parseFloat(PlatformSDK.getData('trafficRacerTotalDistance')) || 0;
    game.totalOvertakes = parseInt(PlatformSDK.getData('trafficRacerTotalOvertakes')) || 0;
    game.totalFeverCount = parseInt(PlatformSDK.getData('trafficRacerTotalFever')) || 0;
    game.totalCoinsEarned = parseInt(PlatformSDK.getData('trafficRacerTotalCoinsEarned')) || 0;
    game.gamesPlayed = parseInt(PlatformSDK.getData('trafficRacerGamesPlayed')) || 0;

    // Load daily rewards
    game.lastDailyReward = PlatformSDK.getData('trafficRacerLastDaily') || null;
    game.dailyStreak = parseInt(PlatformSDK.getData('trafficRacerDailyStreak')) || 0;

    // Check for daily reward
    checkDailyReward();
}

function saveGameData() {
    PlatformSDK.saveData('trafficRacerHighScore', game.highScore);
    PlatformSDK.saveData('trafficRacerCoins', game.coins);

    const ownedCars = PLAYER_CARS.filter(c => c.owned).map(c => c.id);
    PlatformSDK.saveData('trafficRacerOwnedCars', JSON.stringify(ownedCars));

    PlatformSDK.saveData('trafficRacerSelectedCar', PLAYER_CARS[game.selectedCarIndex].id);
    PlatformSDK.saveData('trafficRacerDifficulty', game.selectedDifficulty);

    // Save achievements and stats
    PlatformSDK.saveData('trafficRacerAchievements', JSON.stringify(game.unlockedAchievements));
    PlatformSDK.saveData('trafficRacerTotalDistance', game.totalDistance);
    PlatformSDK.saveData('trafficRacerTotalOvertakes', game.totalOvertakes);
    PlatformSDK.saveData('trafficRacerTotalCoinsEarned', game.totalCoinsEarned);
    PlatformSDK.saveData('trafficRacerGamesPlayed', game.gamesPlayed);
    PlatformSDK.saveData('trafficRacerTotalFever', game.totalFeverCount);

    // Save daily rewards
    PlatformSDK.saveData('trafficRacerLastDaily', game.lastDailyReward);
    PlatformSDK.saveData('trafficRacerDailyStreak', game.dailyStreak);
}

// =====================================================
// DAILY REWARDS SYSTEM
// =====================================================
function checkDailyReward() {
    const today = new Date().toDateString();

    if (game.lastDailyReward !== today) {
        // Check if streak continues
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (game.lastDailyReward === yesterday.toDateString()) {
            game.dailyStreak = Math.min(game.dailyStreak + 1, 7);
        } else if (game.lastDailyReward !== today) {
            game.dailyStreak = 1;
        }

        // Show daily reward modal
        showDailyRewardModal();
    }
}

function showDailyRewardModal() {
    const day = game.dailyStreak;
    const reward = DAILY_REWARDS[day - 1] || DAILY_REWARDS[6];

    document.getElementById('reward-day').textContent = day;
    document.getElementById('reward-coins').textContent = reward.coins;

    const bonusEl = document.getElementById('reward-bonus');
    if (reward.bonus) {
        bonusEl.classList.remove('hidden');
    } else {
        bonusEl.classList.add('hidden');
    }

    document.getElementById('daily-reward-modal').classList.remove('hidden');

    // Add claim handler
    document.getElementById('claim-reward-btn').onclick = () => claimDailyReward(reward);
}

function claimDailyReward(reward) {
    game.coins += reward.coins;
    game.lastDailyReward = new Date().toDateString();

    // Unlock bonus car if applicable
    if (reward.bonus) {
        const car = PLAYER_CARS.find(c => c.id === reward.bonus);
        if (car && !car.owned) {
            car.owned = true;
            showToast(`🚗 Bonus car unlocked: ${car.name}!`, 'success');
        }
    }

    saveGameData();
    updateMenuCoins();

    document.getElementById('daily-reward-modal').classList.add('hidden');
    SoundSystem.playCoin();
    showToast(`+${reward.coins} coins claimed!`, 'success');
}

// =====================================================
// COUNTDOWN SYSTEM
// =====================================================
function startCountdown(callback) {
    game.state = 'countdown';
    const overlay = document.getElementById('countdown-overlay');
    const numberEl = document.getElementById('countdown-number');

    overlay.classList.remove('hidden');

    let count = CONFIG.COUNTDOWN_DURATION;
    numberEl.textContent = count;
    numberEl.style.animation = 'none';
    numberEl.offsetHeight; // Trigger reflow
    numberEl.style.animation = 'countdownPulse 1s ease-out';

    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            numberEl.textContent = count;
            numberEl.style.animation = 'none';
            numberEl.offsetHeight;
            numberEl.style.animation = 'countdownPulse 1s ease-out';
        } else if (count === 0) {
            numberEl.textContent = 'GO!';
            numberEl.style.animation = 'none';
            numberEl.offsetHeight;
            numberEl.style.animation = 'countdownPulse 0.5s ease-out';
        } else {
            clearInterval(countdownInterval);
            overlay.classList.add('hidden');
            if (callback) callback();
        }
    }, 1000);
}

// =====================================================
// PAUSE SYSTEM
// =====================================================
function pauseGame() {
    if (game.state !== 'playing') return;

    game.state = 'paused';
    game.isPaused = true;

    // Stop sounds
    SoundSystem.stopEngine();
    SoundSystem.stopBackgroundMusic();

    // Show pause screen
    document.getElementById('pause-screen').classList.remove('hidden');
    document.getElementById('pause-btn').classList.add('hidden');

    // Notify SDK
    PlatformSDK.gameplayStop();
}

function resumeGame() {
    if (game.state !== 'paused') return;

    document.getElementById('pause-screen').classList.add('hidden');

    // Start countdown then resume
    startCountdown(() => {
        game.state = 'playing';
        game.isPaused = false;
        document.getElementById('pause-btn').classList.remove('hidden');

        // Resume sounds
        SoundSystem.startEngine();
        SoundSystem.startBackgroundMusic();

        // Notify SDK
        PlatformSDK.gameplayStart();
    });
}

function pauseToMenu() {
    game.isPaused = false;
    document.getElementById('pause-screen').classList.add('hidden');
    showMenu();
}

// =====================================================
// REVIVE SYSTEM
// =====================================================
function showReviveScreen() {
    game.state = 'revive';

    // Update crash stats display
    document.getElementById('crash-score').textContent = Math.floor(game.score);
    document.getElementById('crash-speed').textContent = `${Math.floor(player.speed)} km/h`;
    document.getElementById('crash-coins-earned').textContent = `+${game.coinsEarnedThisRun}`;
    document.getElementById('crash-highscore').textContent = game.highScore;

    // Update revive screen info
    document.getElementById('revive-coins').textContent = `💰 ${game.coins}`;
    document.getElementById('revive-cost').textContent = CONFIG.REVIVE_COST;

    // Enable/disable coin revive based on player coins
    const coinBtn = document.getElementById('revive-coins-btn');
    coinBtn.disabled = game.coins < CONFIG.REVIVE_COST;

    // Show revive screen
    document.getElementById('revive-screen').classList.remove('hidden');

    // Stop music but keep game rendering
    SoundSystem.stopBackgroundMusic();
}

function reviveWithCoins() {
    if (game.coins < CONFIG.REVIVE_COST) return;

    game.coins -= CONFIG.REVIVE_COST;
    game.revivesUsed++;
    saveGameData();

    document.getElementById('revive-screen').classList.add('hidden');
    continueGame();
}

function updateMenuCoins() {
    document.getElementById('menu-coins').textContent = `💰 ${game.coins} COINS`;
    document.getElementById('garage-coins').textContent = `💰 ${game.coins}`;
}

// =====================================================
// MENU SCREENS
// =====================================================
function showMenu() {
    // Stop the game loop to prevent continued updates
    stopGameLoop();

    // Reset all game state
    effects.screenShake = 0;
    game.state = 'menu';

    // Reset input state
    input.left = false;
    input.right = false;
    input.up = false;
    input.down = false;

    // Clear traffic and powerups
    traffic.cars = [];
    traffic.powerups = [];
    traffic.overtakenCars.clear();

    // Reset player position
    player.lane = 1;
    player.x = getLaneX(1);
    player.targetX = player.x;
    player.speed = CONFIG.MIN_SPEED;

    // Stop sounds
    SoundSystem.stopEngine();
    SoundSystem.stopBackgroundMusic();

    // Hide game elements, show menu
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('pause-btn').classList.add('hidden');
    document.getElementById('revive-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('garage-screen').classList.add('hidden');
    document.getElementById('settings-screen').classList.add('hidden');

    // Hide touch controls
    const touchControls = document.getElementById('touch-controls');
    if (touchControls) touchControls.style.display = 'none';

    updateMenuCoins();
}

function showGarage() {
    game.state = 'garage';
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('garage-screen').classList.remove('hidden');
    updateMenuCoins();
    renderGarage();
}

function hideGarage() {
    game.state = 'menu';
    document.getElementById('garage-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
}

function showSettings() {
    game.state = 'settings';
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('settings-screen').classList.remove('hidden');
}

function hideSettings() {
    game.state = 'menu';
    document.getElementById('settings-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
}

function setDifficulty(diff) {
    game.selectedDifficulty = diff;
    updateDifficultyButtons();
    saveGameData();
}

function updateDifficultyButtons() {
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.difficulty === game.selectedDifficulty);
    });
}

// =====================================================
// GARAGE SYSTEM
// =====================================================
function renderGarage() {
    const grid = document.getElementById('car-grid');
    grid.innerHTML = '';

    PLAYER_CARS.forEach((car, index) => {
        const card = document.createElement('div');
        card.className = 'car-card';
        if (index === game.selectedCarIndex) card.classList.add('selected');
        if (!car.owned) card.classList.add('locked');

        const preview = document.createElement('div');
        preview.className = 'car-preview';
        const canvas = document.createElement('canvas');
        canvas.width = 60;
        canvas.height = 90;
        drawCarPreview(canvas, car);
        preview.appendChild(canvas);

        const name = document.createElement('div');
        name.className = 'car-name';
        name.textContent = car.name;

        const price = document.createElement('div');
        price.className = 'car-price' + (car.owned ? ' owned' : '');
        price.textContent = car.owned ? '✓ OWNED' : `💰 ${car.price}`;

        card.appendChild(preview);
        card.appendChild(name);
        card.appendChild(price);

        if (car.owned) {
            const btn = document.createElement('button');
            btn.className = 'car-btn select';
            btn.textContent = index === game.selectedCarIndex ? 'SELECTED' : 'SELECT';
            btn.onclick = () => selectCar(index);
            card.appendChild(btn);
        } else {
            const btn = document.createElement('button');
            btn.className = 'car-btn buy';
            btn.textContent = 'BUY';
            btn.disabled = game.coins < car.price;
            btn.onclick = () => buyCar(index);
            card.appendChild(btn);
        }

        grid.appendChild(card);
    });
}

function drawCarPreview(canvas, car) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw a simplified car representation
    const x = 5;
    const y = 5;
    const w = 50;
    const h = 80;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2 + 2, y + h - 5, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = car.bodyColor;
    ctx.beginPath();
    ctx.roundRect(x, y + h * 0.2, w, h * 0.6, 5);
    ctx.fill();

    // Hood
    ctx.fillStyle = car.accentColor;
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 3, w - 6, h * 0.25, 4);
    ctx.fill();

    // Windshield
    ctx.fillStyle = 'rgba(100, 150, 200, 0.7)';
    ctx.beginPath();
    ctx.moveTo(x + 8, y + h * 0.28);
    ctx.lineTo(x + w - 8, y + h * 0.28);
    ctx.lineTo(x + w - 12, y + h * 0.1);
    ctx.lineTo(x + 12, y + h * 0.1);
    ctx.closePath();
    ctx.fill();

    // Headlights
    ctx.fillStyle = '#fffde7';
    ctx.fillRect(x + 5, y + 8, 10, 6);
    ctx.fillRect(x + w - 15, y + 8, 10, 6);

    // Taillights
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(x + 5, y + h - 12, 12, 6);
    ctx.fillRect(x + w - 17, y + h - 12, 12, 6);
}

function selectCar(index) {
    game.selectedCarIndex = index;
    player.model = PLAYER_CARS[index];
    saveGameData();
    renderGarage();
}

function buyCar(index) {
    const car = PLAYER_CARS[index];
    if (game.coins >= car.price && !car.owned) {
        game.coins -= car.price;
        car.owned = true;
        saveGameData();
        updateMenuCoins();
        renderGarage();
    }
}

// NOTE: Old watchAd() function removed - use watchAdForCoins() instead (located at line ~3429)
// The old function gave coins immediately without showing an ad, which violates platform policies.

// Double Coins Logic
// Double Coins Logic
async function watchAdForDoubleCoins() {
    const btn = document.getElementById('double-coins-btn');
    if (btn.classList.contains('claimed')) return;

    btn.querySelector('.btn-text').textContent = 'Loading...';

    // Show ad
    const success = await PlatformSDK.showRewardedAd();

    if (success) {
        // Success
        const doubledAmount = game.coinsEarnedThisRun;
        game.coins += doubledAmount;
        saveGameData();

        // UI Feedback
        btn.classList.add('hidden');
        const successEl = document.getElementById('double-coins-success');
        document.getElementById('doubled-amount').textContent = doubledAmount;
        successEl.classList.remove('hidden');

        // Play coin sound repeatedly
        for (let i = 0; i < 3; i++) {
            setTimeout(() => SoundSystem.playCoin(), i * 200);
        }

        // Update display
        document.getElementById('coins-earned').textContent = `💰 ${game.coinsEarnedThisRun + doubledAmount}`;
        updateMenuCoins();
    } else {
        // Fail
        btn.querySelector('.btn-text').textContent = '2x COINS';
        // showToast('Ad failed to load'); // Optional: show error toast
    }
}

// NOTE: Old reviveWithAd() function removed - use reviveWithAdReal() instead (located at line ~3437)
// The old function gave revives immediately without showing an ad.

function skipRevive() {
    document.getElementById('revive-screen').classList.add('hidden');
    gameOverFinal();
}

function reviveToMenu() {
    document.getElementById('revive-screen').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');

    // Reset critical game state
    effects.screenShake = 0;
    game.isPaused = false;
    game.revivesUsed = 0;
    Settings.controlType = PlatformSDK.getData('trafficRacerControlType') || 'buttons'; // Ensure control type is re-read
    updateControlUI(); // Ensure UI matches

    // Reset game state and show menu
    game.state = 'menu';
    game.lastMenuTime = Date.now(); // Cooldown to prevent immediate restart
    SoundSystem.stopBackgroundMusic();
    SoundSystem.stopEngine();
    showMenu();
}

function continueGame() {
    // Clear ALL traffic near or ahead of player to prevent immediate crash
    traffic.cars = traffic.cars.filter(car => {
        const distance = Math.abs(car.y - player.y);
        // Remove cars that are within 300 pixels or ahead of player
        if (distance < 300 || car.y < player.y + 150) {
            return false;
        }
        return true;
    });

    // Move player to a safe lane if possible
    const safeLane = findSafeLane();
    if (safeLane !== -1) {
        player.lane = safeLane;
        player.x = getLaneX(safeLane);
        player.targetX = player.x;
    }

    // Start countdown then resume
    startCountdown(() => {
        game.state = 'playing';
        document.getElementById('pause-btn').classList.remove('hidden');
        SoundSystem.startEngine();
        SoundSystem.startBackgroundMusic();

        // Grant temporary invincibility after revive to prevent immediate re-crash
        game.invincible = true;
        setTimeout(() => {
            game.invincible = false;
        }, 3000); // 3 seconds of invincibility
    });
}

// Find a safe lane without traffic
function findSafeLane() {
    const lanesBlocked = new Array(CONFIG.LANE_COUNT).fill(false);

    for (const car of traffic.cars) {
        if (car.y > player.y - 150 && car.y < player.y + 200) {
            lanesBlocked[car.lane] = true;
        }
    }

    // Prefer middle lanes
    const preferredOrder = [1, 2, 0, 3];
    for (const lane of preferredOrder) {
        if (!lanesBlocked[lane]) {
            return lane;
        }
    }

    return player.lane; // Keep current lane if no safe lane found
}

function resizeCanvas() {
    const container = document.getElementById('game-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Ensure we have valid dimensions (fix for mobile initial load)
    if (containerWidth === 0 || containerHeight === 0) {
        // Retry after a short delay if container isn't ready
        setTimeout(resizeCanvas, 100);
        return;
    }

    // Calculate scale to fit while maintaining aspect ratio
    const scale = Math.min(containerWidth / CONFIG.WIDTH, containerHeight / CONFIG.HEIGHT);

    // Set the canvas internal resolution (keep fixed for game logic consistency)
    game.canvas.width = CONFIG.WIDTH;
    game.canvas.height = CONFIG.HEIGHT;

    // Set CSS display size to fit container
    game.canvas.style.width = `${CONFIG.WIDTH * scale}px`;
    game.canvas.style.height = `${CONFIG.HEIGHT * scale}px`;

    // Center the canvas in container
    game.canvas.style.marginLeft = 'auto';
    game.canvas.style.marginRight = 'auto';
    game.canvas.style.display = 'block';
}

function initRoad() {
    road.laneWidth = CONFIG.ROAD_WIDTH / CONFIG.LANE_COUNT;
    road.leftEdge = (CONFIG.WIDTH - CONFIG.ROAD_WIDTH) / 2;
    road.rightEdge = road.leftEdge + CONFIG.ROAD_WIDTH;

    // Initialize road segments
    const segmentCount = Math.ceil(CONFIG.HEIGHT / CONFIG.ROAD_SEGMENT_HEIGHT) + 1;
    for (let i = 0; i < segmentCount; i++) {
        road.segments.push({
            y: i * CONFIG.ROAD_SEGMENT_HEIGHT,
        });
    }
}

function initEnvironment() {
    // Initialize trees on both sides
    for (let i = 0; i < 20; i++) {
        effects.trees.push({
            x: Math.random() < 0.5 ? Math.random() * 50 : CONFIG.WIDTH - Math.random() * 50,
            y: i * 50 + Math.random() * 30,
            size: 15 + Math.random() * 10,
            type: Math.floor(Math.random() * 3),
        });
    }

    // Initialize barriers
    for (let i = 0; i < 30; i++) {
        effects.barriers.push({
            y: i * 30,
        });
    }
}

function setupInputHandlers() {
    // Keyboard
    window.addEventListener('keydown', (e) => {
        handleKeyDown(e.code);
        // Prevent default for arrow keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', (e) => {
        handleKeyUp(e.code);
    });

    // =====================================================
    // TOUCH BUTTON CONTROLS
    // =====================================================
    const touchLeft = document.getElementById('touch-left');
    const touchRight = document.getElementById('touch-right');
    const touchUp = document.getElementById('touch-up');
    const touchDown = document.getElementById('touch-down');

    // Helper for touch handling
    const handleTouchStart = (direction, e) => {
        if (Settings.controlType !== 'buttons') return;
        e.preventDefault();

        // Resume audio context on mobile (required for sound to work)
        SoundSystem.resume();

        if (direction === 'left') input.left = true;
        if (direction === 'right') input.right = true;
        if (direction === 'up') input.up = true;
        if (direction === 'down') input.down = true;
    };

    const handleTouchEnd = (direction, e) => {
        if (Settings.controlType !== 'buttons') return;
        e.preventDefault();
        if (direction === 'left') input.left = false;
        if (direction === 'right') input.right = false;
        if (direction === 'up') input.up = false;
        if (direction === 'down') input.down = false;
    };

    if (touchLeft) {
        touchLeft.addEventListener('touchstart', (e) => handleTouchStart('left', e), { passive: false });
        touchLeft.addEventListener('touchend', (e) => handleTouchEnd('left', e), { passive: false });
    }

    if (touchRight) {
        touchRight.addEventListener('touchstart', (e) => handleTouchStart('right', e), { passive: false });
        touchRight.addEventListener('touchend', (e) => handleTouchEnd('right', e), { passive: false });
    }

    if (touchUp) {
        touchUp.addEventListener('touchstart', (e) => handleTouchStart('up', e), { passive: false });
        touchUp.addEventListener('touchend', (e) => handleTouchEnd('up', e), { passive: false });
    }

    if (touchDown) {
        touchDown.addEventListener('touchstart', (e) => handleTouchStart('down', e), { passive: false });
        touchDown.addEventListener('touchend', (e) => handleTouchEnd('down', e), { passive: false });
    }

    // =====================================================
    // SWIPE CONTROLS
    // =====================================================
    let touchStartX = 0;
    let touchStartY = 0;
    const SWIPE_THRESHOLD = 30; // Reduced threshold for better responsiveness

    document.addEventListener('touchstart', (e) => {
        if (Settings.controlType !== 'swipe') return;
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: false }); // non-passive to allow preventing default if needed

    document.addEventListener('touchmove', (e) => {
        if (Settings.controlType !== 'swipe') return;
        // Only prevent scrolling on canvas during active gameplay
        if (game.state === 'playing' && e.target.id === 'gameCanvas') {
            e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
        if (Settings.controlType !== 'swipe') return;
        if (game.state !== 'playing') return;

        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;

        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;

        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal Swipe
            if (Math.abs(dx) > SWIPE_THRESHOLD) {
                if (dx > 0) {
                    // Swipe Right
                    if (player.lane < CONFIG.LANE_COUNT - 1) {
                        player.lane++;
                        player.targetX = getLaneX(player.lane);
                        SoundSystem.playTireScreech();
                    }
                } else {
                    // Swipe Left
                    if (player.lane > 0) {
                        player.lane--;
                        player.targetX = getLaneX(player.lane);
                        SoundSystem.playTireScreech();
                    }
                }
            }
        } else {
            // Vertical Swipe
            if (Math.abs(dy) > SWIPE_THRESHOLD) {
                if (dy < 0) {
                    // Swipe Up (Accelerate)
                    input.up = true;
                    setTimeout(() => input.up = false, 200);
                } else {
                    // Swipe Down (Brake)
                    input.down = true;
                    setTimeout(() => input.down = false, 200);
                }
            }
        }
    });
}

function handleKeyDown(code) {
    switch (code) {
        case 'ArrowLeft':
        case 'KeyA':
            input.left = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            input.right = true;
            break;
        case 'ArrowUp':
        case 'KeyW':
            input.up = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            input.down = true;
            break;
    }
}

function handleKeyUp(code) {
    switch (code) {
        case 'ArrowLeft':
        case 'KeyA':
            input.left = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            input.right = false;
            break;
        case 'ArrowUp':
        case 'KeyW':
            input.up = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            input.down = false;
            break;
    }
}

// =====================================================
// GAME STATE MANAGEMENT
// =====================================================
// Note: startGame() and actuallyStartGame() are defined at the end of the file
// to support the tutorial system. This placeholder ensures existing code works.

function _legacyStartGamePlaceholder() {
    // This function is replaced by startGame() at end of file
}

function gameOver() {
    // Play crash sound
    SoundSystem.playCrash();
    SoundSystem.stopEngine();

    // Screen shake effect
    effects.screenShake = 20;
    document.getElementById('pause-btn').classList.add('hidden');

    // Check if revive is available
    if (game.revivesUsed < game.maxRevives) {
        showReviveScreen();
    } else {
        gameOverFinal();
    }
}

function gameOverFinal() {
    game.state = 'gameover';
    effects.screenShake = 0; // Stop shaking on static game over screen

    // Stop sounds and gameplay
    SoundSystem.stopBackgroundMusic();
    PlatformSDK.gameplayStop();

    // Hide gameplay UI elements
    MuteToggle.hide();

    // Show interstitial ad at game over
    PlatformSDK.showInterstitialAd();

    // Apply score multiplier based on difficulty
    const diffSettings = DIFFICULTY_SETTINGS[game.selectedDifficulty];
    const finalScore = Math.floor(game.score * diffSettings.scoreMultiplier);

    // Add earned coins to total
    game.coins += game.coinsEarnedThisRun;

    // Check for new high score
    const isNewRecord = finalScore > game.highScore;
    if (isNewRecord) {
        game.highScore = finalScore;
    }

    // Track cumulative stats
    game.totalCoinsEarned += game.coinsEarnedThisRun;
    game.gamesPlayed++;

    // Save all data
    saveGameData();

    // Reset Double Coins UI (if it exists - may have been removed)
    const doubleBtn = document.getElementById('double-coins-btn');
    if (doubleBtn) {
        doubleBtn.classList.remove('hidden', 'claimed');
        const btnText = doubleBtn.querySelector('.btn-text');
        if (btnText) btnText.textContent = '2x COINS';
    }
    const doubleSuccess = document.getElementById('double-coins-success');
    if (doubleSuccess) doubleSuccess.classList.add('hidden');

    // Update game over screen
    document.getElementById('final-score').textContent = finalScore;
    document.getElementById('coins-earned').textContent = `💰 ${game.coinsEarnedThisRun}`;
    document.getElementById('final-highscore').textContent = game.highScore;

    const newRecordEl = document.getElementById('new-record');
    if (isNewRecord) {
        newRecordEl.classList.remove('hidden');
    } else {
        newRecordEl.classList.add('hidden');
    }

    // Show game over screen
    document.getElementById('gameover-screen').classList.remove('hidden');
}

// =====================================================
// GAME LOOP
// =====================================================
function gameLoop(timestamp) {
    // Calculate delta time
    game.deltaTime = timestamp - game.lastTime;
    game.lastTime = timestamp;

    // Update
    if (game.state === 'playing') {
        update();
    }

    // Render
    render();

    // Continue loop
    gameLoopId = requestAnimationFrame(gameLoop);
}

function update() {
    game.frameCount++;

    // Update player
    updatePlayer();

    // Update road
    updateRoad();

    // Update traffic
    updateTraffic();

    // Update power-ups (throttled - every 2 frames)
    if (game.frameCount % 2 === 0) {
        updatePowerups();
    }

    // Update combo/fever (throttled - every 10 frames)
    if (game.frameCount % 10 === 0) {
        updateComboFever();
    }

    // Update night/day cycle (throttled - every 30 frames)
    if (game.frameCount % 30 === 0) {
        updateDayNight();
    }

    // Track distance for achievements (every 5 frames)
    if (game.frameCount % 5 === 0) {
        game.totalDistance += player.speed * 0.1;
        game.noHitTimer += game.deltaTime / 200;
    }

    // Update environment
    updateEnvironment();

    // Update effects
    updateEffects();

    // Update score
    updateScore();

    // Update difficulty (every 60 frames)
    if (game.frameCount % 60 === 0) {
        updateDifficulty();
    }

    // Check collisions
    checkCollisions();

    // Update engine sound (every 3 frames to reduce audio overhead)
    if (game.frameCount % 3 === 0) {
        SoundSystem.updateEngineSound(player.speed, CONFIG.MAX_SPEED);
    }

    // Check achievements (every 180 frames = ~3 seconds)
    if (game.frameCount % 180 === 0) {
        checkAchievements();
        // Track max speed here instead of every frame
        const currentSpeed = getSpeedKMH();
        if (currentSpeed > game.maxSpeed) game.maxSpeed = currentSpeed;
    }

    // Update HUD (every 6 frames instead of 3)
    if (game.frameCount % 6 === 0) {
        updateHUD();
    }
}



function updatePlayer() {
    const sensitivity = Settings.getSensitivityMultiplier();

    // Handle horizontal movement
    if (input.left && player.lane > 0) {
        player.lane--;
        player.targetX = getLaneX(player.lane);
        input.left = false; // Tap-to-lane-change
    }
    if (input.right && player.lane < CONFIG.LANE_COUNT - 1) {
        player.lane++;
        player.targetX = getLaneX(player.lane);
        input.right = false; // Tap-to-lane-change
    }

    // Smooth lane transition with sensitivity
    const dx = player.targetX - player.x;
    if (Math.abs(dx) > 1) {
        player.x += dx * 0.15 * sensitivity; // Apply sensitivity
    } else {
        player.x = player.targetX;
    }


    // Handle speed
    if (input.up) {
        player.speed = Math.min(player.speed + CONFIG.ACCELERATION, CONFIG.MAX_SPEED);
    } else if (input.down) {
        player.speed = Math.max(player.speed - CONFIG.DECELERATION, CONFIG.MIN_SPEED);
    } else {
        // Natural deceleration
        if (player.speed > CONFIG.MIN_SPEED + 2) {
            player.speed -= CONFIG.DECELERATION * 0.3;
        }
    }
}

function updateRoad() {
    // Scroll road based on player speed
    road.offset += player.speed;

    // Wrap road segments
    for (const segment of road.segments) {
        segment.y += player.speed;
        if (segment.y > CONFIG.HEIGHT) {
            segment.y -= road.segments.length * CONFIG.ROAD_SEGMENT_HEIGHT;
        }
    }
}

function updateEnvironment() {
    // Update trees
    for (const tree of effects.trees) {
        tree.y += player.speed * 0.5;
        if (tree.y > CONFIG.HEIGHT + 50) {
            tree.y = -50;
            tree.x = tree.x < CONFIG.WIDTH / 2 ? Math.random() * 50 : CONFIG.WIDTH - Math.random() * 50;
        }
    }

    // Update barriers
    for (const barrier of effects.barriers) {
        barrier.y += player.speed;
        if (barrier.y > CONFIG.HEIGHT + 30) {
            barrier.y = -30;
        }
    }
}

function updateTraffic() {
    // Spawn new traffic based on difficulty
    const diffSettings = DIFFICULTY_SETTINGS[game.selectedDifficulty];
    traffic.spawnTimer++;
    const baseInterval = Math.max(30, CONFIG.TRAFFIC_SPAWN_INTERVAL - game.difficulty * 5);
    const spawnInterval = Math.floor(baseInterval / diffSettings.trafficDensity);

    if (traffic.spawnTimer >= spawnInterval) {
        spawnTrafficCar();
        traffic.spawnTimer = 0;
    }

    // Update existing traffic
    for (let i = traffic.cars.length - 1; i >= 0; i--) {
        const car = traffic.cars[i];

        // Move car relative to player speed
        car.y += player.speed - car.speed;

        // Check if overtaken
        if (!car.overtaken && car.y > player.y + player.height) {
            car.overtaken = true;
            if (!traffic.overtakenCars.has(car.id)) {
                traffic.overtakenCars.add(car.id);

                // Combo system
                game.combo++;
                game.totalOvertakes++;
                if (game.combo > game.maxCombo) game.maxCombo = game.combo;

                // Check for fever mode
                if (game.combo >= CONFIG.FEVER_THRESHOLD && !game.isFever) {
                    triggerFeverMode();
                }

                // Calculate score with multipliers
                let scoreMultiplier = game.isFever ? CONFIG.FEVER_MULTIPLIER : 1;
                if (game.activePowerups.double_score) scoreMultiplier *= 2;

                game.score += CONFIG.OVERTAKE_BONUS * scoreMultiplier;

                // Calculate coins with car bonus
                let coinBonus = player.model.coinBonus || 0;
                let coinsEarned = Math.floor(CONFIG.OVERTAKE_COINS * (1 + coinBonus));
                if (game.isFever) coinsEarned *= 2;
                game.coinsEarnedThisRun += coinsEarned;

                showBonusPopup(game.isFever ? 'FEVER!' : null);
                showCoinPopup(coinsEarned);
                SoundSystem.playOvertake();
                updateComboDisplay();
            }
        }

        // Remove if off screen
        if (car.y > CONFIG.HEIGHT + 100 || car.y < -200) {
            traffic.cars.splice(i, 1);
        }
    }
}

function spawnTrafficCar() {
    // Choose a random lane
    const lane = Math.floor(Math.random() * CONFIG.LANE_COUNT);

    // Check if lane is blocked
    const laneX = getLaneX(lane);
    const isTooClose = traffic.cars.some(car => {
        return Math.abs(car.x - laneX) < road.laneWidth * 0.5 && car.y < 150;
    });

    if (isTooClose) return;

    // Pick a random car model
    const model = CAR_MODELS.TRAFFIC[Math.floor(Math.random() * CAR_MODELS.TRAFFIC.length)];

    // Create car
    const car = {
        id: Date.now() + Math.random(),
        x: laneX,
        y: -CONFIG.PLAYER_HEIGHT - 20,
        width: CONFIG.PLAYER_WIDTH - 5,
        height: CONFIG.PLAYER_HEIGHT - 10,
        speed: CONFIG.MIN_TRAFFIC_SPEED + Math.random() * (CONFIG.MAX_TRAFFIC_SPEED - CONFIG.MIN_TRAFFIC_SPEED),
        model: model,
        lane: lane,
        overtaken: false,
    };

    traffic.cars.push(car);
}

// =====================================================
// POWER-UP SYSTEM
// =====================================================
function updatePowerups() {
    // Spawn power-ups
    traffic.powerupSpawnTimer++;
    if (traffic.powerupSpawnTimer >= CONFIG.POWERUP_SPAWN_INTERVAL) {
        spawnPowerup();
        traffic.powerupSpawnTimer = 0;
    }

    // Update existing power-ups
    for (let i = traffic.powerups.length - 1; i >= 0; i--) {
        const powerup = traffic.powerups[i];
        powerup.y += player.speed;

        // Check collection
        if (checkPowerupCollision(powerup)) {
            activatePowerup(powerup.type);
            traffic.powerups.splice(i, 1);
            continue;
        }

        // Remove if off screen
        if (powerup.y > CONFIG.HEIGHT + 50) {
            traffic.powerups.splice(i, 1);
        }
    }

    // Update active power-up timers - optimized with cached timestamp
    const now = performance.now();
    const keysToDelete = [];
    for (const key in game.activePowerups) {
        if (now >= game.activePowerups[key]) {
            keysToDelete.push(key);
        }
    }
    if (keysToDelete.length > 0) {
        keysToDelete.forEach(key => {
            // Reset invincibility when shield expires
            if (key === 'shield') {
                game.invincible = false;
            }
            delete game.activePowerups[key];
        });
        updatePowerupHUD();
    }
}

function spawnPowerup() {
    const lane = Math.floor(Math.random() * CONFIG.LANE_COUNT);
    const types = Object.values(POWERUP_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];

    traffic.powerups.push({
        x: getLaneX(lane),
        y: -50,
        type: type,
        size: 30,
    });
}

function checkPowerupCollision(powerup) {
    const dx = Math.abs(powerup.x - player.x);
    const dy = Math.abs(powerup.y - (player.y + player.height / 2));
    return dx < 40 && dy < 60;
}

function activatePowerup(type) {
    SoundSystem.playPowerup();
    game.activePowerups[type.id] = performance.now() + type.duration;

    // Special effects
    if (type.id === 'shield') {
        game.invincible = true;
        showToast('🛡️ Shield Active!', 'success');
    } else if (type.id === 'speed_boost') {
        player.speed = Math.min(player.speed + 5, CONFIG.MAX_SPEED + 3);
        showToast('🚀 Speed Boost!', 'success');
    } else if (type.id === 'slow_mo') {
        showToast('⏱️ Slow Motion!', 'success');
    } else if (type.id === 'magnet') {
        showToast('🧲 Coin Magnet!', 'success');
    } else if (type.id === 'double_score') {
        showToast('⭐ 2x Score!', 'success');
    }

    updatePowerupHUD();
}

// Cache for power-up type lookup
const POWERUP_TYPES_BY_ID = {};
for (const type of Object.values(POWERUP_TYPES)) {
    POWERUP_TYPES_BY_ID[type.id] = type;
}

// Cached DOM element
let cachedPowerupContainer = null;

function updatePowerupHUD() {
    if (!cachedPowerupContainer) {
        cachedPowerupContainer = document.getElementById('powerup-indicators');
    }
    if (!cachedPowerupContainer) return;

    cachedPowerupContainer.innerHTML = '';
    const now = performance.now();

    for (const key in game.activePowerups) {
        const remaining = Math.ceil((game.activePowerups[key] - now) / 1000);
        if (remaining > 0) {
            const type = POWERUP_TYPES_BY_ID[key];
            if (type) {
                const div = document.createElement('div');
                div.className = 'powerup-indicator';
                div.textContent = `${type.icon} ${remaining}s`;
                div.style.background = type.color;
                cachedPowerupContainer.appendChild(div);
            }
        }
    }
}

// =====================================================
// COMBO / FEVER SYSTEM
// =====================================================
function updateComboFever() {
    // Check fever expiration using performance.now()
    if (game.isFever && performance.now() >= game.feverEndTime) {
        game.isFever = false;
        document.body.classList.remove('fever-mode');
        // Combo persists after fever ends - only resets on crash
        updateComboDisplay();
    }
}

function triggerFeverMode() {
    game.isFever = true;
    game.feverEndTime = performance.now() + CONFIG.FEVER_DURATION;
    game.totalFeverCount++;
    document.body.classList.add('fever-mode');
    SoundSystem.playFever();
    showToast('🔥 FEVER MODE! 2x EVERYTHING!', 'success');
}

function updateComboDisplay() {
    const comboEl = document.getElementById('combo-counter');
    if (!comboEl) return;

    if (game.combo >= 2) {
        comboEl.textContent = `x${game.combo}`;
        comboEl.classList.remove('hidden');
        comboEl.style.animation = 'none';
        comboEl.offsetHeight;
        comboEl.style.animation = 'comboPulse 0.3s ease-out';
    } else {
        comboEl.classList.add('hidden');
    }
}

// =====================================================
// NIGHT/DAY CYCLE
// =====================================================
function updateDayNight() {
    game.dayNightTimer += game.deltaTime;

    // Toggle every 60 seconds
    if (game.dayNightTimer >= 60000) {
        game.dayNightTimer = 0;
        game.isNight = !game.isNight;
        document.body.classList.toggle('night-mode', game.isNight);
    }
}

// =====================================================
// ACHIEVEMENT SYSTEM
// =====================================================
function checkAchievements() {
    for (const ach of ACHIEVEMENTS) {
        if (game.unlockedAchievements.includes(ach.id)) continue;

        let progress = 0;
        switch (ach.type) {
            case 'distance': progress = game.totalDistance; break;
            case 'coins': progress = game.totalCoins + game.coins; break;
            case 'overtakes': progress = game.totalOvertakes; break;
            case 'speed': progress = game.maxSpeed; break;
            case 'fever': progress = game.totalFeverCount; break;
            case 'survival': progress = game.noHitTimer; break;
        }

        if (progress >= ach.target) {
            unlockAchievement(ach);
        }
    }
}

function unlockAchievement(ach) {
    game.unlockedAchievements.push(ach.id);
    game.coins += ach.reward;
    saveGameData();
    showToast(`🏆 ${ach.name} - +${ach.reward} coins!`, 'success');
    SoundSystem.playAchievement();
}

function updateEffects() {
    // Screen shake decay
    if (effects.screenShake > 0) {
        effects.screenShake *= 0.9;
        if (effects.screenShake < 0.5) effects.screenShake = 0;
    }
}

function updateScore() {
    // Distance score
    const speedMultiplier = getSpeedKMH() > CONFIG.SPEED_MULTIPLIER_THRESHOLD ? 1.5 : 1;
    game.score += CONFIG.SCORE_PER_FRAME * (player.speed / CONFIG.MIN_SPEED) * speedMultiplier;
}

function updateDifficulty() {
    const newDifficulty = Math.min(
        Math.floor(game.score / CONFIG.DIFFICULTY_INCREASE_INTERVAL) + 1,
        CONFIG.MAX_DIFFICULTY
    );
    game.difficulty = newDifficulty;
}

function checkCollisions() {
    // Skip collision check if invincible
    if (game.invincible) return;

    const playerBox = {
        x: player.x - player.width / 2,
        y: player.y,
        width: player.width,
        height: player.height,
    };

    for (const car of traffic.cars) {
        const carBox = {
            x: car.x - car.width / 2,
            y: car.y,
            width: car.width,
            height: car.height,
        };

        // Standard collision check for current position
        if (boxCollision(playerBox, carBox)) {
            gameOver();
            return;
        }

        // Swept collision detection for high-speed tunneling prevention
        // Calculate how much the car moved this frame relative to player
        const relativeSpeed = player.speed - car.speed;

        // If the car moved more than half its height, check intermediate positions
        if (relativeSpeed > car.height / 2) {
            // Check previous position - the car was at (car.y - relativeSpeed) last frame
            const prevCarY = car.y - relativeSpeed;

            // Create a swept box that covers the entire path the car traveled
            const sweptCarBox = {
                x: car.x - car.width / 2,
                y: Math.min(prevCarY, car.y),
                width: car.width,
                height: car.height + Math.abs(relativeSpeed),
            };

            if (boxCollision(playerBox, sweptCarBox)) {
                gameOver();
                return;
            }
        }
    }
}

function boxCollision(a, b) {
    // Add small padding for more forgiving collisions
    const padding = 5;
    return (
        a.x + padding < b.x + b.width - padding &&
        a.x + a.width - padding > b.x + padding &&
        a.y + padding < b.y + b.height - padding &&
        a.y + a.height - padding > b.y + padding
    );
}

// =====================================================
// RENDERING
// =====================================================
function render() {
    const ctx = game.ctx;

    // Apply screen shake
    ctx.save();
    if (effects.screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * effects.screenShake;
        const shakeY = (Math.random() - 0.5) * effects.screenShake;
        ctx.translate(shakeX, shakeY);
    }

    // Draw sky/background
    drawBackground(ctx);

    // Draw environment (grass, trees)
    drawEnvironment(ctx);

    // Draw road
    drawRoad(ctx);

    // Draw barriers
    drawBarriers(ctx);

    // Draw power-ups
    drawPowerups(ctx);

    // Draw traffic
    drawTraffic(ctx);

    // Draw player
    if (game.state === 'playing') {
        drawPlayer(ctx);
    }

    ctx.restore();
}

// Draw power-ups on road
function drawPowerups(ctx) {
    for (const powerup of traffic.powerups) {
        const x = powerup.x;
        const y = powerup.y;
        const size = powerup.size;

        // Glow effect
        ctx.shadowColor = powerup.type.color;
        ctx.shadowBlur = 15;

        // Outer ring
        ctx.fillStyle = powerup.type.color;
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();

        // Inner circle
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, size / 3, 0, Math.PI * 2);
        ctx.fill();

        // Icon
        ctx.shadowBlur = 0;
        ctx.font = `${size * 0.6}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(powerup.type.icon, x, y);
    }
    ctx.shadowBlur = 0;
}

function drawBackground(ctx) {
    // Sky gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, CONFIG.HEIGHT);
    skyGradient.addColorStop(0, '#87CEEB'); // Light blue sky
    skyGradient.addColorStop(0.3, '#B0E2FF');
    skyGradient.addColorStop(1, '#E8F5E9'); // Horizon
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
}

function drawEnvironment(ctx) {
    // Grass on sides
    ctx.fillStyle = '#4a7c59'; // Realistic grass green
    ctx.fillRect(0, 0, road.leftEdge - 15, CONFIG.HEIGHT);
    ctx.fillRect(road.rightEdge + 15, 0, CONFIG.WIDTH - road.rightEdge - 15, CONFIG.HEIGHT);

    // Grass texture (simple dots)
    ctx.fillStyle = '#3d6b4a';
    for (let i = 0; i < 100; i++) {
        const x = Math.random() < 0.5 ? Math.random() * (road.leftEdge - 20) : road.rightEdge + 20 + Math.random() * (CONFIG.WIDTH - road.rightEdge - 20);
        const y = (road.offset * 0.3 + i * 15) % CONFIG.HEIGHT;
        ctx.fillRect(x, y, 2, 3);
    }

    // Draw trees
    for (const tree of effects.trees) {
        drawTree(ctx, tree.x, tree.y, tree.size, tree.type);
    }
}

function drawTree(ctx, x, y, size, type) {
    // Tree trunk
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(x - 3, y + size * 0.6, 6, size * 0.5);

    // Tree foliage based on type
    if (type === 0) {
        // Round tree
        ctx.fillStyle = '#2E7D32';
        ctx.beginPath();
        ctx.arc(x, y + size * 0.3, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#388E3C';
        ctx.beginPath();
        ctx.arc(x - 5, y + size * 0.2, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
    } else if (type === 1) {
        // Pine tree
        ctx.fillStyle = '#1B5E20';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + size * 0.5, y + size * 0.7);
        ctx.lineTo(x - size * 0.5, y + size * 0.7);
        ctx.closePath();
        ctx.fill();
    } else {
        // Bush
        ctx.fillStyle = '#33691E';
        ctx.beginPath();
        ctx.ellipse(x, y + size * 0.4, size * 0.6, size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawRoad(ctx) {
    // Road shoulder (darker edge)
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(road.leftEdge - 15, 0, CONFIG.ROAD_WIDTH + 30, CONFIG.HEIGHT);

    // Main asphalt
    const asphaltGradient = ctx.createLinearGradient(road.leftEdge, 0, road.rightEdge, 0);
    asphaltGradient.addColorStop(0, '#3a3a3a');
    asphaltGradient.addColorStop(0.1, '#4a4a4a');
    asphaltGradient.addColorStop(0.5, '#505050');
    asphaltGradient.addColorStop(0.9, '#4a4a4a');
    asphaltGradient.addColorStop(1, '#3a3a3a');
    ctx.fillStyle = asphaltGradient;
    ctx.fillRect(road.leftEdge, 0, CONFIG.ROAD_WIDTH, CONFIG.HEIGHT);

    // Asphalt texture (subtle noise)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    for (let i = 0; i < 200; i++) {
        const x = road.leftEdge + Math.random() * CONFIG.ROAD_WIDTH;
        const y = Math.random() * CONFIG.HEIGHT;
        ctx.fillRect(x, y, 2, 2);
    }

    // Road edge lines (solid white)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(road.leftEdge + 5, 0);
    ctx.lineTo(road.leftEdge + 5, CONFIG.HEIGHT);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(road.rightEdge - 5, 0);
    ctx.lineTo(road.rightEdge - 5, CONFIG.HEIGHT);
    ctx.stroke();

    // Lane markings (dashed white)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.setLineDash([50, 40]);

    const markingOffset = road.offset % 90;

    for (let i = 1; i < CONFIG.LANE_COUNT; i++) {
        const x = road.leftEdge + i * road.laneWidth;
        ctx.beginPath();
        ctx.moveTo(x, -90 + markingOffset);
        ctx.lineTo(x, CONFIG.HEIGHT + 90);
        ctx.stroke();
    }

    ctx.setLineDash([]);
}

function drawBarriers(ctx) {
    const barrierWidth = 8;
    const barrierHeight = 20;
    const markingOffset = road.offset % 30;

    // Left barrier
    for (let i = 0; i < 30; i++) {
        const y = i * 30 - 30 + markingOffset;

        // Metal post
        ctx.fillStyle = '#6b7280';
        ctx.fillRect(road.leftEdge - 12, y, 4, barrierHeight);

        // Guardrail
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(road.leftEdge - 14, y + 5, barrierWidth, 6);

        // Highlight
        ctx.fillStyle = '#d1d5db';
        ctx.fillRect(road.leftEdge - 14, y + 5, barrierWidth, 2);
    }

    // Right barrier
    for (let i = 0; i < 30; i++) {
        const y = i * 30 - 30 + markingOffset;

        // Metal post
        ctx.fillStyle = '#6b7280';
        ctx.fillRect(road.rightEdge + 8, y, 4, barrierHeight);

        // Guardrail
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(road.rightEdge + 6, y + 5, barrierWidth, 6);

        // Highlight
        ctx.fillStyle = '#d1d5db';
        ctx.fillRect(road.rightEdge + 6, y + 5, barrierWidth, 2);
    }
}

function drawTraffic(ctx) {
    for (const car of traffic.cars) {
        drawRealisticCar(ctx, car.x, car.y, car.width, car.height, car.model, false);
    }
}

function drawPlayer(ctx) {
    drawRealisticCar(ctx, player.x, player.y, player.width, player.height, player.model, true);
}

function drawRealisticCar(ctx, x, y, width, height, model, isPlayer) {
    // Blink effect if invincible
    if (isPlayer && player.blink && Math.floor(game.frameCount / 5) % 2 === 0) {
        return;
    }

    const carX = x - width / 2;
    const carY = y;

    // Car shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + height + 3, width * 0.45, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw based on car style
    switch (model.style) {
        case 'sports':
            drawSportsCar(ctx, carX, carY, width, height, model, isPlayer);
            break;
        case 'muscle':
            drawMuscleCar(ctx, carX, carY, width, height, model, isPlayer);
            break;
        case 'classic':
            drawClassicCar(ctx, carX, carY, width, height, model, isPlayer);
            break;
        case 'electric':
            drawElectricCar(ctx, carX, carY, width, height, model, isPlayer);
            break;
        default:
            drawSedanCar(ctx, carX, carY, width, height, model, isPlayer);
    }
}

function drawSportsCar(ctx, x, y, w, h, model, isPlayer) {
    // Low, sleek sports car (Porsche style)

    // Main body
    ctx.fillStyle = model.bodyColor;
    roundRect(ctx, x, y + h * 0.25, w, h * 0.55, 8, true);

    // Hood (sloped, aerodynamic)
    ctx.fillStyle = model.accentColor;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + h * 0.3);
    ctx.lineTo(x + w - 5, y + h * 0.3);
    ctx.lineTo(x + w - 8, y + 5);
    ctx.lineTo(x + 8, y + 5);
    ctx.closePath();
    ctx.fill();

    // Roof
    ctx.fillStyle = model.bodyColor;
    roundRect(ctx, x + w * 0.15, y + h * 0.25, w * 0.7, h * 0.35, 5, true);

    // Rear (with spoiler if applicable)
    ctx.fillStyle = model.accentColor;
    roundRect(ctx, x + 5, y + h * 0.7, w - 10, h * 0.25, 5, true);

    // Spoiler
    if (model.hasWing) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(x + 5, y + h * 0.62, w - 10, 4);
        ctx.fillRect(x, y + h * 0.6, 4, 8);
        ctx.fillRect(x + w - 4, y + h * 0.6, 4, 8);
    }

    // Windshield
    const glassColor = isPlayer ? 'rgba(100, 200, 255, 0.7)' : 'rgba(100, 150, 200, 0.7)';
    ctx.fillStyle = glassColor;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.2, y + h * 0.3);
    ctx.lineTo(x + w * 0.8, y + h * 0.3);
    ctx.lineTo(x + w * 0.75, y + h * 0.12);
    ctx.lineTo(x + w * 0.25, y + h * 0.12);
    ctx.closePath();
    ctx.fill();

    // Rear window
    ctx.fillStyle = 'rgba(80, 120, 160, 0.6)';
    roundRect(ctx, x + w * 0.25, y + h * 0.55, w * 0.5, h * 0.12, 3, true);

    // Headlights
    ctx.fillStyle = '#fffde7';
    if (isPlayer) {
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 10;
    }
    roundRect(ctx, x + 3, y + 8, 12, 8, 2, true);
    roundRect(ctx, x + w - 15, y + 8, 12, 8, 2, true);
    ctx.shadowBlur = 0;

    // Taillights
    ctx.fillStyle = '#dc2626';
    ctx.shadowColor = '#dc2626';
    ctx.shadowBlur = 8;
    roundRect(ctx, x + 3, y + h - 12, 15, 6, 2, true);
    roundRect(ctx, x + w - 18, y + h - 12, 15, 6, 2, true);
    ctx.shadowBlur = 0;

    // Wheels
    drawWheel(ctx, x + 8, y + h * 0.2, 10);
    drawWheel(ctx, x + w - 18, y + h * 0.2, 10);
    drawWheel(ctx, x + 8, y + h * 0.7, 10);
    drawWheel(ctx, x + w - 18, y + h * 0.7, 10);
}

function drawSedanCar(ctx, x, y, w, h, model, isPlayer) {
    // Classic sedan shape

    // Main body
    ctx.fillStyle = model.bodyColor;
    roundRect(ctx, x, y + h * 0.22, w, h * 0.58, 6, true);

    // Hood
    ctx.fillStyle = model.accentColor;
    roundRect(ctx, x + 3, y + 3, w - 6, h * 0.28, 5, true);

    // Trunk
    ctx.fillStyle = model.accentColor;
    roundRect(ctx, x + 3, y + h * 0.72, w - 6, h * 0.22, 5, true);

    // Roof/cabin
    ctx.fillStyle = model.bodyColor;
    roundRect(ctx, x + w * 0.12, y + h * 0.2, w * 0.76, h * 0.4, 5, true);

    // Windshield
    ctx.fillStyle = 'rgba(100, 150, 200, 0.7)';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.15, y + h * 0.28);
    ctx.lineTo(x + w * 0.85, y + h * 0.28);
    ctx.lineTo(x + w * 0.78, y + h * 0.1);
    ctx.lineTo(x + w * 0.22, y + h * 0.1);
    ctx.closePath();
    ctx.fill();

    // Rear window
    ctx.fillStyle = 'rgba(80, 120, 160, 0.6)';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.2, y + h * 0.52);
    ctx.lineTo(x + w * 0.8, y + h * 0.52);
    ctx.lineTo(x + w * 0.75, y + h * 0.68);
    ctx.lineTo(x + w * 0.25, y + h * 0.68);
    ctx.closePath();
    ctx.fill();

    // Side windows
    ctx.fillStyle = 'rgba(100, 140, 180, 0.5)';
    ctx.fillRect(x + 3, y + h * 0.28, 8, h * 0.2);
    ctx.fillRect(x + w - 11, y + h * 0.28, 8, h * 0.2);

    // Grille (Mercedes style)
    ctx.fillStyle = '#1f1f1f';
    roundRect(ctx, x + w * 0.3, y + 5, w * 0.4, 12, 2, true);
    ctx.fillStyle = '#4a4a4a';
    for (let i = 0; i < 4; i++) {
        ctx.fillRect(x + w * 0.32 + i * (w * 0.08), y + 7, 2, 8);
    }

    // Headlights
    ctx.fillStyle = '#fffde7';
    roundRect(ctx, x + 4, y + 6, 14, 10, 3, true);
    roundRect(ctx, x + w - 18, y + 6, 14, 10, 3, true);

    // Taillights
    ctx.fillStyle = '#dc2626';
    ctx.shadowColor = '#dc2626';
    ctx.shadowBlur = 6;
    roundRect(ctx, x + 4, y + h - 14, 14, 8, 2, true);
    roundRect(ctx, x + w - 18, y + h - 14, 14, 8, 2, true);
    ctx.shadowBlur = 0;

    // Wheels
    drawWheel(ctx, x + 8, y + h * 0.18, 10);
    drawWheel(ctx, x + w - 18, y + h * 0.18, 10);
    drawWheel(ctx, x + 8, y + h * 0.68, 10);
    drawWheel(ctx, x + w - 18, y + h * 0.68, 10);
}

function drawMuscleCar(ctx, x, y, w, h, model, isPlayer) {
    // Muscular car style

    // Main body - wider, aggressive stance
    ctx.fillStyle = model.bodyColor;
    roundRect(ctx, x - 2, y + h * 0.2, w + 4, h * 0.6, 5, true);

    // Hood with bulge
    ctx.fillStyle = model.accentColor;
    roundRect(ctx, x, y + 2, w, h * 0.32, 5, true);
    // Hood bulge
    ctx.fillStyle = model.bodyColor;
    roundRect(ctx, x + w * 0.3, y + 8, w * 0.4, h * 0.15, 3, true);

    // Trunk
    ctx.fillStyle = model.accentColor;
    roundRect(ctx, x + 2, y + h * 0.72, w - 4, h * 0.22, 4, true);

    // Cabin
    ctx.fillStyle = model.bodyColor;
    roundRect(ctx, x + w * 0.1, y + h * 0.2, w * 0.8, h * 0.38, 4, true);

    // Windshield
    ctx.fillStyle = 'rgba(80, 130, 180, 0.7)';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.12, y + h * 0.28);
    ctx.lineTo(x + w * 0.88, y + h * 0.28);
    ctx.lineTo(x + w * 0.8, y + h * 0.1);
    ctx.lineTo(x + w * 0.2, y + h * 0.1);
    ctx.closePath();
    ctx.fill();

    // Rear window
    ctx.fillStyle = 'rgba(70, 110, 150, 0.6)';
    roundRect(ctx, x + w * 0.2, y + h * 0.52, w * 0.6, h * 0.12, 3, true);

    // Racing stripes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(x + w * 0.38, y, 4, h * 0.7);
    ctx.fillRect(x + w * 0.58, y, 4, h * 0.7);

    // Headlights (aggressive rectangular)
    ctx.fillStyle = '#fffde7';
    ctx.fillRect(x + 4, y + 10, 16, 8);
    ctx.fillRect(x + w - 20, y + 10, 16, 8);

    // Taillights (triple)
    ctx.fillStyle = '#dc2626';
    ctx.shadowColor = '#dc2626';
    ctx.shadowBlur = 6;
    for (let i = 0; i < 3; i++) {
        ctx.fillRect(x + 5 + i * 6, y + h - 12, 4, 6);
        ctx.fillRect(x + w - 9 - i * 6, y + h - 12, 4, 6);
    }
    ctx.shadowBlur = 0;

    // Wheels
    drawWheel(ctx, x + 8, y + h * 0.16, 11);
    drawWheel(ctx, x + w - 19, y + h * 0.16, 11);
    drawWheel(ctx, x + 8, y + h * 0.66, 11);
    drawWheel(ctx, x + w - 19, y + h * 0.66, 11);
}

function drawClassicCar(ctx, x, y, w, h, model, isPlayer) {
    // Classic Ferrari 250 GT style

    // Main body - elegant curves
    ctx.fillStyle = model.bodyColor;

    // Front rounded
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.1, w * 0.45, h * 0.15, 0, Math.PI, 0);
    ctx.fill();

    roundRect(ctx, x + 2, y + h * 0.15, w - 4, h * 0.65, 6, true);

    // Hood
    ctx.fillStyle = model.accentColor;
    roundRect(ctx, x + 5, y + 5, w - 10, h * 0.28, 8, true);

    // Trunk
    roundRect(ctx, x + 5, y + h * 0.72, w - 10, h * 0.2, 5, true);

    // Cabin (classic rounded)
    ctx.fillStyle = model.bodyColor;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.35, w * 0.38, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Windshield (curved)
    ctx.fillStyle = 'rgba(100, 150, 200, 0.6)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.25, w * 0.3, h * 0.12, 0, Math.PI, 0);
    ctx.fill();

    // Rear window (small, classic)
    ctx.fillStyle = 'rgba(80, 120, 160, 0.5)';
    roundRect(ctx, x + w * 0.3, y + h * 0.5, w * 0.4, h * 0.1, 3, true);

    // Chrome grille
    ctx.fillStyle = '#c0c0c0';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + 12, w * 0.25, 8, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 5; i++) {
        ctx.fillRect(x + w * 0.28 + i * (w * 0.09), y + 6, 2, 10);
    }

    // Round headlights (classic)
    ctx.fillStyle = '#fffde7';
    ctx.beginPath();
    ctx.arc(x + 12, y + 12, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w - 12, y + 12, 7, 0, Math.PI * 2);
    ctx.fill();

    // Chrome headlight bezels
    ctx.strokeStyle = '#c0c0c0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 12, y + 12, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + w - 12, y + 12, 8, 0, Math.PI * 2);
    ctx.stroke();

    // Round taillights
    ctx.fillStyle = '#dc2626';
    ctx.shadowColor = '#dc2626';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(x + 10, y + h - 10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w - 10, y + h - 10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Wheels (wire spoke style)
    drawWheel(ctx, x + 10, y + h * 0.15, 10);
    drawWheel(ctx, x + w - 20, y + h * 0.15, 10);
    drawWheel(ctx, x + 10, y + h * 0.65, 10);
    drawWheel(ctx, x + w - 20, y + h * 0.65, 10);
}

function drawElectricCar(ctx, x, y, w, h, model, isPlayer) {
    // Modern electric car (BYD Seal style)

    // Main body - smooth, aerodynamic
    ctx.fillStyle = model.bodyColor;
    roundRect(ctx, x, y + h * 0.18, w, h * 0.62, 8, true);

    // Hood (flat, modern)
    ctx.fillStyle = model.accentColor;
    roundRect(ctx, x + 2, y + 2, w - 4, h * 0.25, 6, true);

    // Trunk (integrated spoiler look)
    roundRect(ctx, x + 2, y + h * 0.72, w - 4, h * 0.22, 5, true);

    // Cabin (sleek, sloped)
    ctx.fillStyle = model.bodyColor;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + h * 0.28);
    ctx.lineTo(x + w - 5, y + h * 0.28);
    ctx.lineTo(x + w * 0.85, y + h * 0.55);
    ctx.lineTo(x + w * 0.15, y + h * 0.55);
    ctx.closePath();
    ctx.fill();

    // Panoramic windshield
    ctx.fillStyle = 'rgba(50, 100, 150, 0.75)';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.1, y + h * 0.26);
    ctx.lineTo(x + w * 0.9, y + h * 0.26);
    ctx.lineTo(x + w * 0.82, y + h * 0.08);
    ctx.lineTo(x + w * 0.18, y + h * 0.08);
    ctx.closePath();
    ctx.fill();

    // Rear window (sloped)
    ctx.fillStyle = 'rgba(40, 80, 120, 0.65)';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.18, y + h * 0.55);
    ctx.lineTo(x + w * 0.82, y + h * 0.55);
    ctx.lineTo(x + w * 0.75, y + h * 0.7);
    ctx.lineTo(x + w * 0.25, y + h * 0.7);
    ctx.closePath();
    ctx.fill();

    // LED headlights (thin strip)
    ctx.fillStyle = '#e0f7fa';
    ctx.shadowColor = '#00bcd4';
    ctx.shadowBlur = 8;
    roundRect(ctx, x + 4, y + 8, w * 0.35, 4, 2, true);
    roundRect(ctx, x + w - 4 - w * 0.35, y + 8, w * 0.35, 4, 2, true);
    ctx.shadowBlur = 0;

    // LED Taillights (full-width strip)
    ctx.fillStyle = '#dc2626';
    ctx.shadowColor = '#dc2626';
    ctx.shadowBlur = 8;
    roundRect(ctx, x + 8, y + h - 10, w - 16, 4, 2, true);
    ctx.shadowBlur = 0;

    // Aero wheels
    drawWheel(ctx, x + 10, y + h * 0.16, 11);
    drawWheel(ctx, x + w - 21, y + h * 0.16, 11);
    drawWheel(ctx, x + 10, y + h * 0.65, 11);
    drawWheel(ctx, x + w - 21, y + h * 0.65, 11);
}

function drawWheel(ctx, x, y, size) {
    // Tire
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Rim
    ctx.fillStyle = '#4a4a4a';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 3, 0, Math.PI * 2);
    ctx.fill();

    // Center hub
    ctx.fillStyle = '#6b7280';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 6, 0, Math.PI * 2);
    ctx.fill();
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================
function getLaneX(lane) {
    return road.leftEdge + road.laneWidth * lane + road.laneWidth / 2;
}

function getSpeedKMH() {
    // Convert game speed to "km/h" for display (arbitrary scaling)
    return Math.floor(player.speed * 20);
}

function updateHUD() {
    document.getElementById('score').textContent = Math.floor(game.score);
    document.getElementById('coins').textContent = `💰 ${game.coinsEarnedThisRun}`;
    document.getElementById('speed').innerHTML = `${getSpeedKMH()} <small>KM/H</small>`;
    document.getElementById('highscore').textContent = game.highScore;
}

function showBonusPopup() {
    const popup = document.getElementById('bonus-popup');
    popup.classList.remove('hidden');

    // Reset animation
    popup.style.animation = 'none';
    popup.offsetHeight; // Trigger reflow
    popup.style.animation = 'bonusPop 0.8s ease-out forwards';

    // Hide after animation
    setTimeout(() => {
        popup.classList.add('hidden');
    }, 800);
}

function showCoinPopup() {
    const popup = document.getElementById('coin-popup');
    popup.textContent = `+${CONFIG.OVERTAKE_COINS} 💰`;
    popup.classList.remove('hidden');

    // Reset animation
    popup.style.animation = 'none';
    popup.offsetHeight; // Trigger reflow
    popup.style.animation = 'coinPop 0.8s ease-out forwards';

    // Hide after animation
    setTimeout(() => {
        popup.classList.add('hidden');
    }, 800);
}

// =====================================================
// START THE GAME
// =====================================================
window.addEventListener('DOMContentLoaded', init);

// Save on exit
window.addEventListener('beforeunload', () => {
    saveGameData();
});

// =====================================================
// STATS SCREEN UI FUNCTIONS
// =====================================================
function showStats() {
    game.state = 'stats';
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('stats-screen').classList.remove('hidden');
    renderStats();
}

function hideStats() {
    game.state = 'menu';
    document.getElementById('stats-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
}

function renderStats() {
    document.getElementById('stat-best-score').textContent = game.highScore.toLocaleString();

    // Format distance
    const dist = Math.floor(game.totalDistance);
    if (dist >= 1000) {
        document.getElementById('stat-total-distance').textContent = `${(dist / 1000).toFixed(1)} km`;
    } else {
        document.getElementById('stat-total-distance').textContent = `${dist} m`;
    }

    document.getElementById('stat-total-overtakes').textContent = game.totalOvertakes.toLocaleString();
    document.getElementById('stat-total-coins').textContent = game.totalCoinsEarned.toLocaleString();
    document.getElementById('stat-total-fever').textContent = game.totalFeverCount.toLocaleString();

    // Cars owned
    const carsOwned = PLAYER_CARS.filter(c => c.owned).length;
    document.getElementById('stat-cars-owned').textContent = `${carsOwned} / ${PLAYER_CARS.length}`;

    // Achievements
    const achievementsUnlocked = game.unlockedAchievements.length;
    document.getElementById('stat-achievements').textContent = `${achievementsUnlocked} / ${ACHIEVEMENTS.length}`;

    // Games played
    document.getElementById('stat-games-played').textContent = game.gamesPlayed.toLocaleString();
}

// =====================================================
// AD FUNCTIONS WITH REAL SDK
// =====================================================
async function watchAdForCoins() {
    const btn = document.getElementById('watch-ad-btn');
    btn.textContent = '⏳ Loading...';
    btn.disabled = true;

    const success = await PlatformSDK.showRewardedAd();

    if (success) {
        game.coins += 500;
        saveGameData();
        updateMenuCoins();
        showToast('+500 coins!', 'success');
        renderGarage();
    } else {
        showToast('Ad not available', 'error');
    }

    btn.textContent = '📺 Watch Ad (+500)';
    btn.disabled = false;
}

async function reviveWithAdReal() {
    const btn = document.getElementById('revive-ad-btn');
    btn.querySelector('.revive-text').textContent = '⏳ Loading...';

    const success = await PlatformSDK.showRewardedAd();

    if (success) {
        game.revivesUsed++;
        document.getElementById('revive-screen').classList.add('hidden');
        continueGame();
    } else {
        showToast('Ad not available, try again', 'error');
    }

    btn.querySelector('.revive-text').textContent = 'Watch Ad (Free)';
}

// =====================================================
// UI HELPER FUNCTIONS
// =====================================================
function createAdLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'ad-loading-overlay';
    overlay.className = 'ad-loading-overlay hidden';
    overlay.innerHTML = `
        <div class="ad-loading-spinner"></div>
        <div class="ad-loading-text">LOADING AD...</div>
    `;
    document.body.appendChild(overlay);
}

function showAdLoadingOverlay() {
    const overlay = document.getElementById('ad-loading-overlay');
    if (overlay) overlay.classList.remove('hidden');
}

function hideAdLoadingOverlay() {
    const overlay = document.getElementById('ad-loading-overlay');
    if (overlay) overlay.classList.add('hidden');
}

function createToastContainer() {
    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast ${type}`;

    // Show toast
    setTimeout(() => toast.classList.add('show'), 10);

    // Hide after 2 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

// =====================================================
// TUTORIAL SYSTEM
// =====================================================
const Tutorial = {
    hasSeenTutorial: false,

    init() {
        this.hasSeenTutorial = PlatformSDK.getData('trafficRacerTutorialSeen') === 'true';

        // Setup dismiss button
        const dismissBtn = document.getElementById('tutorial-dismiss-btn');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => this.dismiss());
        }
    },

    show() {
        if (this.hasSeenTutorial) return false;

        const overlay = document.getElementById('tutorial-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            return true;
        }
        return false;
    },

    dismiss() {
        const overlay = document.getElementById('tutorial-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
        this.hasSeenTutorial = true;
        PlatformSDK.saveData('trafficRacerTutorialSeen', 'true');

        // Start the game after dismissing tutorial
        actuallyStartGame();
    }
};

// =====================================================
// MUTE TOGGLE
// =====================================================
const MuteToggle = {
    isMuted: false,

    init() {
        this.isMuted = PlatformSDK.getData('trafficRacerMuted') === 'true';

        const btn = document.getElementById('mute-btn');
        if (btn) {
            btn.addEventListener('click', () => this.toggle());
            this.updateUI();
        }
    },

    toggle() {
        this.isMuted = !this.isMuted;
        PlatformSDK.saveData('trafficRacerMuted', this.isMuted.toString());
        this.apply();
        this.updateUI();
    },

    apply() {
        if (this.isMuted) {
            SoundSystem.sfxEnabled = false;
            SoundSystem.musicEnabled = false;
            SoundSystem.stopEngine();
            SoundSystem.stopBackgroundMusic();
        } else {
            SoundSystem.sfxEnabled = true;
            SoundSystem.musicEnabled = true;
            if (game.state === 'playing') {
                SoundSystem.startEngine();
                SoundSystem.startBackgroundMusic();
            }
        }
    },

    updateUI() {
        const btn = document.getElementById('mute-btn');
        if (btn) {
            btn.textContent = this.isMuted ? '🔇' : '🔊';
            btn.classList.toggle('muted', this.isMuted);
        }
    },

    show() {
        const btn = document.getElementById('mute-btn');
        if (btn) btn.classList.remove('hidden');
    },

    hide() {
        const btn = document.getElementById('mute-btn');
        if (btn) btn.classList.add('hidden');
    }
};

// =====================================================
// LUCKY WHEEL SYSTEM
// =====================================================
const LuckyWheel = {
    prizes: [
        { label: '50', value: 50, color: '#e74c3c' },
        { label: '100', value: 100, color: '#3498db' },
        { label: '200', value: 200, color: '#2ecc71' },
        { label: '50', value: 50, color: '#9b59b6' },
        { label: '500', value: 500, color: '#f39c12' },
        { label: '100', value: 100, color: '#1abc9c' },
        { label: '1000', value: 1000, color: '#e67e22' },
        { label: '200', value: 200, color: '#34495e' },
    ],
    rotation: 0,
    isSpinning: false,
    hasSpunToday: false,
    hasExtraSpin: false,

    init() {
        const lastSpin = PlatformSDK.getData('trafficRacerLastWheelSpin');
        const today = new Date().toDateString();
        this.hasSpunToday = lastSpin === today;
        this.hasExtraSpin = PlatformSDK.getData('trafficRacerExtraSpin') === 'true';

        // Draw initial wheel
        this.draw();

        // Setup buttons
        document.getElementById('lucky-wheel-btn')?.addEventListener('click', () => this.showModal());
        document.getElementById('wheel-close-btn')?.addEventListener('click', () => this.hideModal());
        document.getElementById('spin-wheel-btn')?.addEventListener('click', () => this.spin());
        document.getElementById('extra-spin-btn')?.addEventListener('click', () => this.getExtraSpin());

        this.updateButtons();
    },

    showModal() {
        document.getElementById('lucky-wheel-modal')?.classList.remove('hidden');
        document.getElementById('wheel-result')?.classList.add('hidden');
        this.updateButtons();
        this.draw();

        // Start countdown if we can't spin
        if (this.hasSpunToday && !this.hasExtraSpin) {
            this.startCountdown();
        }
    },

    hideModal() {
        document.getElementById('lucky-wheel-modal')?.classList.add('hidden');
        this.stopCountdown();
    },

    startCountdown() {
        this.stopCountdown(); // Clear existing
        this.updateButtons(); // Initial update

        this.countdownInterval = setInterval(() => {
            if (!this.hasSpunToday || this.hasExtraSpin) {
                this.stopCountdown();
                this.updateButtons();
                return;
            }
            this.updateButtons();
        }, 1000);
    },

    stopCountdown() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
    },

    draw() {
        const canvas = document.getElementById('lucky-wheel-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 130;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const sliceAngle = (2 * Math.PI) / this.prizes.length;

        this.prizes.forEach((prize, i) => {
            const startAngle = this.rotation + i * sliceAngle;
            const endAngle = startAngle + sliceAngle;

            // Draw slice
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = prize.color;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw text
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + sliceAngle / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px Orbitron';
            ctx.fillText(prize.label, radius - 15, 5);
            ctx.restore();
        });

        // Draw center circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffd700';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
    },

    spin() {
        if (this.isSpinning) return;

        if (this.hasSpunToday && !this.hasExtraSpin) {
            showToast('Come back tomorrow for another spin!', 'error');
            return;
        }

        this.isSpinning = true;

        // Use extra spin if daily already used
        if (this.hasSpunToday && this.hasExtraSpin) {
            this.hasExtraSpin = false;
            PlatformSDK.saveData('trafficRacerExtraSpin', 'false');
        } else {
            this.hasSpunToday = true;
            PlatformSDK.saveData('trafficRacerLastWheelSpin', new Date().toDateString());
        }

        this.updateButtons();

        // Random prize (weighted towards lower values)
        const targetPrize = Math.floor(Math.random() * this.prizes.length);
        const sliceAngle = (2 * Math.PI) / this.prizes.length;

        // Calculate target rotation (at least 5 full spins)
        const spins = 5 + Math.random() * 3;
        const targetAngle = -(targetPrize * sliceAngle + sliceAngle / 2) - Math.PI / 2;
        const totalRotation = spins * 2 * Math.PI + targetAngle - this.rotation;

        const duration = 4000;
        const startTime = Date.now();
        const startRotation = this.rotation;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-out cubic)
            const eased = 1 - Math.pow(1 - progress, 3);

            this.rotation = startRotation + totalRotation * eased;
            this.draw();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.isSpinning = false;
                this.claimPrize(this.prizes[targetPrize]);

                // Start countdown after spin if daily is used
                if (this.hasSpunToday && !this.hasExtraSpin) {
                    this.startCountdown();
                }
            }
        };

        animate();
    },

    claimPrize(prize) {
        game.coins += prize.value;
        saveGameData();
        updateMenuCoins();

        const resultEl = document.getElementById('wheel-result');
        if (resultEl) {
            resultEl.textContent = `+${prize.value} COINS!`;
            resultEl.classList.remove('hidden');
        }

        SoundSystem.playCoin();
        showToast(`You won ${prize.value} coins!`, 'success');
        this.updateButtons();
    },

    async getExtraSpin() {
        if (this.hasExtraSpin || this.isSpinning) return;

        const success = await PlatformSDK.showRewardedAd();
        if (success) {
            this.hasExtraSpin = true;
            PlatformSDK.saveData('trafficRacerExtraSpin', 'true');
            showToast('Extra spin unlocked!', 'success');
            this.stopCountdown(); // Stop countdown if valid
            this.updateButtons();
        }
    },

    updateButtons() {
        const spinBtn = document.getElementById('spin-wheel-btn');

        if (spinBtn) {
            const canSpin = !this.hasSpunToday || this.hasExtraSpin;
            spinBtn.disabled = !canSpin || this.isSpinning;

            if (canSpin) {
                spinBtn.querySelector('.btn-text').textContent = '🎲 SPIN!';
            } else {
                // Calculate time until midnight
                const now = new Date();
                const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                const diff = tomorrow - now;

                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);

                const format = (n) => n.toString().padStart(2, '0');
                const timeStr = `${format(hours)}:${format(minutes)}:${format(seconds)}`;

                spinBtn.querySelector('.btn-text').textContent = `⏳ Refreshes in ${timeStr}`;
            }
        }
    }
};

// =====================================================
// COIN SHOP
// =====================================================
// CoinShop and PaymentSystem removed


// =====================================================
// SHIELD START
// =====================================================
async function startGameWithShield() {
    const btn = document.getElementById('shield-start-btn');
    if (btn) btn.querySelector('.btn-text').textContent = '⏳ Loading...';

    const success = await PlatformSDK.showRewardedAd();

    if (success) {
        // Start game with shield power-up
        game.activePowerups.shield = {
            type: POWERUP_TYPES.SHIELD,
            endTime: Date.now() + POWERUP_TYPES.SHIELD.duration
        };
        actuallyStartGame();
    } else {
        showToast('Ad not available', 'error');
    }

    if (btn) btn.querySelector('.btn-text').textContent = '🛡️ START WITH SHIELD';
}

// Modified startGame to check for tutorial
function startGame() {
    // Prevent starting too soon after returning to menu (fixes auto-restart bug)
    if (Date.now() - (game.lastMenuTime || 0) < 500) return;

    // Check if first time - show tutorial
    if (Tutorial.show()) {
        return; // Tutorial will call actuallyStartGame when dismissed
    }

    actuallyStartGame();
}

function actuallyStartGame() {
    effects.screenShake = 0; // Reset shake
    game.state = 'playing';
    game.score = 0;
    game.coinsEarnedThisRun = 0;
    game.difficulty = 1;
    game.revivesUsed = 0;
    game.combo = 0;
    game.maxCombo = 0;
    game.isFever = false;
    game.noHitTimer = 0;
    game.invincible = false; // Reset invincibility at game start
    updateComboDisplay(); // Reset combo UI to hidden state

    // Clear power-ups (except shield if started with it)
    const shieldStart = game.activePowerups.shield;
    game.activePowerups = {};
    if (shieldStart) game.activePowerups.shield = shieldStart;

    // Check if selected car starts with shield
    if (player.model.startsWithShield && !game.activePowerups.shield) {
        game.activePowerups.shield = {
            type: POWERUP_TYPES.SHIELD,
            endTime: Date.now() + POWERUP_TYPES.SHIELD.duration
        };
    }

    // Reset player position
    player.lane = 1;
    player.x = getLaneX(player.lane);
    player.targetX = player.x;
    player.y = game.canvas.height * CONFIG.PLAYER_START_Y;
    player.speed = CONFIG.MIN_SPEED;
    player.model = PLAYER_CARS[game.selectedCarIndex];

    // Clear traffic
    traffic.cars = [];
    traffic.powerups = [];
    traffic.overtakenCars.clear();
    traffic.spawnTimer = 0;
    traffic.powerupSpawnTimer = 0;

    // Reset road
    road.offset = 0;

    // Apply difficulty settings
    const diff = DIFFICULTY_SETTINGS[game.selectedDifficulty];
    CONFIG.MAX_SPEED = diff.maxSpeed;
    CONFIG.TRAFFIC_SPAWN_INTERVAL = diff.spawnInterval;

    // Hide menus and modals, show game elements
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('coin-shop-modal')?.classList.add('hidden');
    document.getElementById('lucky-wheel-modal')?.classList.add('hidden');
    document.getElementById('daily-reward-modal')?.classList.add('hidden');
    document.getElementById('pause-btn').classList.remove('hidden');
    MuteToggle.show();

    // Start countdown
    startCountdown(() => {
        game.state = 'playing';

        // Restart game loop if it was stopped
        if (!gameLoopId) {
            gameLoopId = requestAnimationFrame(gameLoop);
        }

        // Show touch controls if enabled
        Settings.updateTouchControlsVisibility();

        // Start sounds if not muted
        if (!MuteToggle.isMuted) {
            SoundSystem.startEngine();
            SoundSystem.startBackgroundMusic();
        }

        PlatformSDK.gameplayStart();
    });
}

// Initialize new systems in init()
