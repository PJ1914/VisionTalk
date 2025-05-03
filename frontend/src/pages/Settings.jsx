import { useState, useEffect, useRef } from 'react';
import './Settings.css';
import { auth } from '../config/firebase';

function Settings() {
  const [userProfile, setUserProfile] = useState(null);
  const [settings, setSettings] = useState({
    theme: 'dark',
    voiceModule: 'default',
    voiceId: null, // Add voiceId for custom voices
    voiceFileUrl: null, // Store the URL of the uploaded .wav file
    narrationSpeed: 1,
    narrationVolume: 0.8,
    narrationPitch: 1,
    musicEnhancement: false,
    backgroundMusic: 'none',
    objectDetectionMode: 'visual',
    objectDetectionSensitivity: 'medium',
    hapticFeedback: false,
    fontSize: 'medium',
    highContrast: false,
    language: 'en',
    notifications: true,
  });
  const [toastMessage, setToastMessage] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    voice: true,
    ai: true,
    accessibility: true,
    display: true,
  });
  const [voices, setVoices] = useState([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);
  const [previewTheme, setPreviewTheme] = useState(null);
  const toastTimeoutRef = useRef(null);
  const announceTimeoutRef = useRef(null);
  const customVoiceInputRef = useRef(null);

  // Load user profile and settings
  useEffect(() => {
    const storedProfile = localStorage.getItem('userProfile');
    setUserProfile(storedProfile ? JSON.parse(storedProfile) : null);

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        const profile = {
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
        };
        setUserProfile(profile);
        localStorage.setItem('userProfile', JSON.stringify(profile));
      } else {
        setUserProfile(null);
        localStorage.removeItem('userProfile');
      }
    });

    const storedSettings = localStorage.getItem('appSettings');
    const initialSettings = storedSettings ? JSON.parse(storedSettings) : settings;
    setSettings(initialSettings);

    return () => unsubscribe();
  }, []);

  // Load voices for speech synthesis
  useEffect(() => {
    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const availableVoices = synth.getVoices();
      setVoices(availableVoices);
      setIsLoadingVoices(false);
    };

    loadVoices();
    synth.onvoiceschanged = loadVoices;

    return () => {
      synth.onvoiceschanged = null;
    };
  }, []);

  const handleSettingsChange = (key, value, additionalUpdates = {}) => {
    const updatedSettings = { ...settings, [key]: value, ...additionalUpdates };
    setSettings(updatedSettings);
    localStorage.setItem('appSettings', JSON.stringify(updatedSettings));
    if (key === 'theme') {
      setPreviewTheme(null);
    }
    showToast('Settings saved!');
    announceChange(`Setting ${key} updated to ${value}`);
  };

  const handleCustomVoiceUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'audio/wav') {
      showToast('Please upload a .wav file.');
      announceChange('Invalid file type. Please upload a .wav file.');
      return;
    }

    const voiceId = '1'; // Use a fixed voiceId
    const voiceFileUrl = URL.createObjectURL(file); // Create a URL for the file

    handleSettingsChange('voiceModule', 'custom', {
      voiceId,
      voiceFileUrl,
    });
  };

  const resetSettings = () => {
    if (!window.confirm('Are you sure you want to reset all settings to default?')) return;
    const defaultSettings = {
      theme: 'dark',
      voiceModule: 'default',
      voiceId: null,
      voiceFileUrl: null,
      narrationSpeed: 1,
      narrationVolume: 0.8,
      narrationPitch: 1,
      musicEnhancement: false,
      backgroundMusic: 'none',
      objectDetectionMode: 'visual',
      objectDetectionSensitivity: 'medium',
      hapticFeedback: false,
      fontSize: 'medium',
      highContrast: false,
      language: 'en',
      notifications: true,
    };
    setSettings(defaultSettings);
    localStorage.setItem('appSettings', JSON.stringify(defaultSettings));
    setPreviewTheme(null);
    showToast('Settings reset to default!');
    announceChange('Settings reset to default');
  };

  const previewVoice = () => {
    if (isLoadingVoices) {
      showToast('Voices are still loading, please wait...');
      return;
    }
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance('This is a preview of your selected voice settings.');
    const selectedVoice = voices.find(voice => voice.name === settings.voiceModule) || voices[0];
    utterance.voice = selectedVoice;
    utterance.rate = settings.narrationSpeed;
    utterance.volume = settings.narrationVolume;
    utterance.pitch = settings.narrationPitch;
    utterance.lang = settings.language;
    synth.speak(utterance);
    announceChange('Previewing voice settings');
  };

  const exportSettings = () => {
    const dataStr = JSON.stringify(settings);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'visiontalk-settings.json';
    link.click();
    URL.revokeObjectURL(url);
    showToast('Settings exported!');
    announceChange('Settings exported');
  };

  const importSettings = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedSettings = JSON.parse(e.target.result);
        setSettings(importedSettings);
        localStorage.setItem('appSettings', JSON.stringify(importedSettings));
        showToast('Settings imported successfully!');
        announceChange('Settings imported successfully');
      } catch (error) {
        showToast('Failed to import settings. Invalid file format.');
        announceChange('Failed to import settings');
      }
    };
    reader.readAsText(file);
  };

  const showToast = (message) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage('');
      toastTimeoutRef.current = null;
    }, 3000);
  };

  const announceChange = (message) => {
    if (announceTimeoutRef.current) {
      clearTimeout(announceTimeoutRef.current);
    }
    announceTimeoutRef.current = setTimeout(() => {
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('style', 'position: absolute; left: -9999px;');
      liveRegion.textContent = message;
      document.body.appendChild(liveRegion);
      setTimeout(() => document.body.removeChild(liveRegion), 1000);
    }, 500);
  };

  const toggleSection = (section) => {
    setExpandedSections({ ...expandedSections, [section]: !expandedSections[section] });
    announceChange(`${section} settings ${expandedSections[section] ? 'collapsed' : 'expanded'}`);
  };

  return (
    <div className={`settings-page ${previewTheme || settings.theme} font-${settings.fontSize} ${settings.highContrast ? 'high-contrast' : ''}`}>
      {userProfile ? (
        <div className="user-profile-container settings-glass">
          <h2>User Profile & Settings</h2>
          <div className="profile-info">
            <img
              src={userProfile.photoURL || '/default-profile.png'}
              alt="User profile"
              className="profile-pic"
            />
            <h3>{userProfile.displayName}</h3>
            <p>{userProfile.email}</p>
          </div>
        </div>
      ) : (
        <div className="user-profile-container settings-glass">
          <h2>User Profile & Settings</h2>
          <p>Please log in to view your profile.</p>
        </div>
      )}

      <div className="settings-container settings-glass">
        <h2>App Settings</h2>

        <div className="settings-section">
          <button
            className="section-toggle"
            onClick={() => toggleSection('voice')}
            aria-expanded={expandedSections.voice}
            aria-label="Toggle voice settings"
          >
            Voice Settings {expandedSections.voice ? '▼' : '▶'}
          </button>
          {expandedSections.voice && (
            <div className="section-content">
              <div className="setting-item">
                <label htmlFor="voice-module">
                  Voice Module:
                  <span className="tooltip">Choose the voice for narration</span>
                </label>
                <select
                  id="voice-module"
                  value={settings.voiceModule}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Reset voiceId and voiceFileUrl for default voices
                    if (value !== 'custom') {
                      handleSettingsChange('voiceModule', value, {
                        voiceId: null,
                        voiceFileUrl: null,
                      });
                    } else {
                      // Trigger file input click for custom voice
                      customVoiceInputRef.current.click();
                    }
                  }}
                  aria-label="Select voice module"
                  disabled={isLoadingVoices}
                >
                  <option value="default">Default Voice</option>
                  <option value="female-1">Female Voice 1</option>
                  <option value="male-1">Male Voice 1</option>
                  <option value="neutral-1">Neutral Voice 1</option>
                  <option value="custom">{settings.voiceFileUrl ? 'Custom Voice (Uploaded)' : 'Custom Voice (Upload)'}</option>
                </select>
                <input
                  type="file"
                  accept="audio/wav"
                  ref={customVoiceInputRef}
                  onChange={handleCustomVoiceUpload}
                  style={{ display: 'none' }}
                  aria-label="Upload custom voice file in WAV format"
                />
              </div>
              <div className="setting-item">
                <label htmlFor="narration-speed">
                  Narration Speed: {settings.narrationSpeed}x
                  <span className="tooltip">Adjust the speed of narration</span>
                </label>
                <input
                  id="narration-speed"
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={settings.narrationSpeed}
                  onChange={(e) => handleSettingsChange('narrationSpeed', parseFloat(e.target.value))}
                  aria-label="Adjust narration speed"
                />
              </div>
              <div className="setting-item">
                <label htmlFor="narration-volume">
                  Narration Volume: {(settings.narrationVolume * 100).toFixed(0)}%
                  <span className="tooltip">Adjust the volume of narration</span>
                </label>
                <input
                  id="narration-volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.narrationVolume}
                  onChange={(e) => handleSettingsChange('narrationVolume', parseFloat(e.target.value))}
                  aria-label="Adjust narration volume"
                />
              </div>
              <div className="setting-item">
                <label htmlFor="narration-pitch">
                  Narration Pitch: {settings.narrationPitch}
                  <span className="tooltip">Adjust the pitch of narration</span>
                </label>
                <input
                  id="narration-pitch"
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.narrationPitch}
                  onChange={(e) => handleSettingsChange('narrationPitch', parseFloat(e.target.value))}
                  aria-label="Adjust narration pitch"
                />
              </div>
              <div className="setting-item">
                <label htmlFor="language">
                  Language:
                  <span className="tooltip">Select the language for narration and UI</span>
                </label>
                <select
                  id="language"
                  value={settings.language}
                  onChange={(e) => handleSettingsChange('language', e.target.value)}
                  aria-label="Select language"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>
              <button onClick={previewVoice} className="preview-button" disabled={isLoadingVoices}>
                {isLoadingVoices ? 'Loading Voices...' : 'Preview Voice'}
              </button>
            </div>
          )}
        </div>

        <div className="settings-section">
          <button
            className="section-toggle"
            onClick={() => toggleSection('ai')}
            aria-expanded={expandedSections.ai}
            aria-label="Toggle AI features"
          >
            AI Features {expandedSections.ai ? '▼' : '▶'}
          </button>
          {expandedSections.ai && (
            <div className="section-content">
              <div className="setting-item">
                <label htmlFor="music-enhancement">
                  AI-Powered Music Enhancement:
                  <span className="tooltip">Enhance background music with AI</span>
                  <input
                    id="music-enhancement"
                    type="checkbox"
                    checked={settings.musicEnhancement}
                    onChange={(e) => handleSettingsChange('musicEnhancement', e.target.checked)}
                    aria-label="Toggle AI-powered music enhancement"
                  />
                </label>
              </div>
              <div className="setting-item">
                <label htmlFor="background-music">
                  Background Music:
                  <span className="tooltip">Select background music for the app</span>
                </label>
                <select
                  id="background-music"
                  value={settings.backgroundMusic}
                  onChange={(e) => handleSettingsChange('backgroundMusic', e.target.value)}
                  aria-label="Select background music"
                >
                  <option value="none">None</option>
                  <option value="calm">Calm Melody</option>
                  <option value="upbeat">Upbeat Tune</option>
                  <option value="ambient">Ambient Sound</option>
                </select>
              </div>
              <div className="setting-item">
                <label htmlFor="object-detection-mode">
                  Object Detection Mode:
                  <span className="tooltip">Choose how objects are described</span>
                </label>
                <select
                  id="object-detection-mode"
                  value={settings.objectDetectionMode}
                  onChange={(e) => handleSettingsChange('objectDetectionMode', e.target.value)}
                  aria-label="Select object detection mode"
                >
                  <option value="visual">Visual Description</option>
                  <option value="audio">Audio Description</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div className="setting-item">
                <label htmlFor="object-detection-sensitivity">
                  Object Detection Sensitivity:
                  <span className="tooltip">Adjust sensitivity of object detection</span>
                </label>
                <select
                  id="object-detection-sensitivity"
                  value={settings.objectDetectionSensitivity}
                  onChange={(e) => handleSettingsChange('objectDetectionSensitivity', e.target.value)}
                  aria-label="Select object detection sensitivity"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="setting-item">
                <label htmlFor="notifications">
                  In-App Notifications:
                  <span className="tooltip">Enable notifications for AI detections</span>
                  <input
                    id="notifications"
                    type="checkbox"
                    checked={settings.notifications}
                    onChange={(e) => handleSettingsChange('notifications', e.target.checked)}
                    aria-label="Toggle in-app notifications"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="settings-section">
          <button
            className="section-toggle"
            onClick={() => toggleSection('accessibility')}
            aria-expanded={expandedSections.accessibility}
            aria-label="Toggle accessibility settings"
          >
            Accessibility {expandedSections.accessibility ? '▼' : '▶'}
          </button>
          {expandedSections.accessibility && (
            <div className="section-content">
              <div className="setting-item">
                <label htmlFor="haptic-feedback">
                  Haptic Feedback:
                  <span className="tooltip">Enable vibrations for interactions (mobile only)</span>
                  <input
                    id="haptic-feedback"
                    type="checkbox"
                    checked={settings.hapticFeedback}
                    onChange={(e) => handleSettingsChange('hapticFeedback', e.target.checked)}
                    aria-label="Toggle haptic feedback"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="settings-section">
          <button
            className="section-toggle"
            onClick={() => toggleSection('display')}
            aria-expanded={expandedSections.display}
            aria-label="Toggle display settings"
          >
            Display Settings {expandedSections.display ? '▼' : '▶'}
          </button>
          {expandedSections.display && (
            <div className="section-content">
              <div className="setting-item">
                <label htmlFor="theme">
                  Theme:
                  <span className="tooltip">Choose the app's visual theme</span>
                </label>
                <div className="theme-selector">
                  <select
                    id="theme"
                    value={previewTheme || settings.theme}
                    onChange={(e) => {
                      setPreviewTheme(e.target.value);
                    }}
                    aria-label="Select theme"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="neon">Neon</option>
                  </select>
                  {previewTheme && (
                    <button
                      onClick={() => handleSettingsChange('theme', previewTheme)}
                      className="apply-theme-button"
                    >
                      Apply Theme
                    </button>
                  )}
                </div>
              </div>
              <div className="setting-item">
                <label htmlFor="font-size">
                  Font Size:
                  <span className="tooltip">Adjust text size for better readability</span>
                </label>
                <select
                  id="font-size"
                  value={settings.fontSize}
                  onChange={(e) => handleSettingsChange('fontSize', e.target.value)}
                  aria-label="Select font size"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
              <div className="setting-item">
                <label htmlFor="high-contrast">
                  High Contrast Mode:
                  <span className="tooltip">Enable high contrast for better visibility</span>
                  <input
                    id="high-contrast"
                    type="checkbox"
                    checked={settings.highContrast}
                    onChange={(e) => handleSettingsChange('highContrast', e.target.checked)}
                    aria-label="Toggle high contrast mode"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="settings-actions">
          <button onClick={exportSettings} className="action-button">
            Export Settings
          </button>
          <label className="action-button import-button">
            Import Settings
            <input
              type="file"
              accept="application/json"
              onChange={importSettings}
              style={{ display: 'none' }}
              aria-label="Import settings from file"
            />
          </label>
          <button onClick={resetSettings} className="reset-button">
            Reset Settings
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="toast settings-glass">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default Settings;