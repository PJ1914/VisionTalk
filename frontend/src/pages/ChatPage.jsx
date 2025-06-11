import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import SendIcon from '@mui/icons-material/Send';
import ImageIcon from '@mui/icons-material/Image';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import AddIcon from '@mui/icons-material/Add';
import HomeIcon from '@mui/icons-material/Home';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ClearIcon from '@mui/icons-material/Clear';
import MicIcon from '@mui/icons-material/Mic';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import './ChatPage.css';
import { db, auth } from '../config/firebase';
import { collection, doc, setDoc, updateDoc, arrayUnion, serverTimestamp, query, getDocs, deleteDoc, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

function ChatUI() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isNavbarHidden, setIsNavbarHidden] = useState(false);
  const [image, setImage] = useState(null);
  const [isExtensionMenuOpen, setIsExtensionMenuOpen] = useState(false);
  const [isClosingMenu, setIsClosingMenu] = useState(false);
  const [selectedExtension, setSelectedExtension] = useState(null);
  const [chatId, setChatId] = useState(localStorage.getItem('chatId') || null);
  const [chatHistory, setChatHistory] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(null);
  const [currentWordIndex, setCurrentWordIndex] = useState({});
  const [voiceSample, setVoiceSample] = useState(null);
  const [settings, setSettings] = useState({
    voiceId: null,
    voiceFileUrl: null,
    narrationSpeed: 1,
    narrationVolume: 0.8,
    narrationPitch: 1,
    language: 'en-US', // Default language
  });
  const messagesEndRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const fileInputRef = useRef(null);
  const voiceInputRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const extensionMenuRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const maxDisplayedHistoryItems = 5;
  const maxDisplayedMessages = 10;

  // Load settings from localStorage
  useEffect(() => {
    const storedSettings = localStorage.getItem('appSettings');
    if (storedSettings) {
      setSettings(JSON.parse(storedSettings));
    }
  }, []);

  // Initialize speech recognition with improved settings
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true; // Enable interim results for real-time feedback
      recognition.lang = settings.language || 'en-US'; // Use the user's language setting

      // Attempt to enable noise suppression (browser support varies)
      if ('webkitAudioContext' in window) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        recognition.audioContext = audioContext;
      }

      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        // Process both final and interim results
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Update input with the latest transcript
        setInput(finalTranscript || interimTranscript);
        if (finalTranscript) {
          setIsRecording(false);
          announceStatus('Speech recorded: ' + finalTranscript);
        } else {
          announceStatus('Processing speech...');
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        let errorMessage = 'Speech recognition failed. ';
        if (event.error === 'no-speech') {
          errorMessage += 'No speech was detected. Please try again.';
        } else if (event.error === 'audio-capture') {
          errorMessage += 'Microphone access denied or unavailable.';
        } else if (event.error === 'not-allowed') {
          errorMessage += 'Microphone permission denied.';
        } else if (event.error === 'aborted') {
          errorMessage += 'Speech recognition was aborted. Please try again.';
        } else {
          errorMessage += 'An error occurred: ' + event.error;
        }
        announceStatus(errorMessage);
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (!input) {
          announceStatus('Speech recognition ended without a result. Please try again.');
        }
      };

      recognitionRef.current = recognition;
    } else {
      console.warn('SpeechRecognition API not supported in this browser.');
      announceStatus('Speech recognition is not supported in this browser.');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [settings.language]);

  // Cleanup speech synthesis and audio on unmount
  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Cleanup camera stream on unmount or when cameraStream changes
  useEffect(() => {
    return () => {
      if (cameraStream) {
        const tracks = cameraStream.getTracks();
        tracks.forEach((track) => track.stop());
        setCameraStream(null);
        setIsVideoReady(false);
      }
    };
  }, [cameraStream]);

  // Initialize a new chat session in Firestore
  const initializeChatSession = async (currentUser) => {
    if (!currentUser) {
      console.error('User not authenticated in initializeChatSession');
      announceStatus('Please sign in to start a chat.');
      return;
    }

    const newChatId = Date.now().toString();
    const chatRef = doc(db, 'users', currentUser.uid, 'sessions', newChatId);
    try {
      await setDoc(chatRef, {
        createdAt: serverTimestamp(),
        messages: [],
      });
      console.log(`Chat session initialized with ID: ${newChatId} for user: ${currentUser.uid}`);
      setChatId(newChatId);
      localStorage.setItem('chatId', newChatId);
      setMessages([]);
      await fetchChatHistory(currentUser);
    } catch (err) {
      console.error('Error initializing chat session:', err.message, err.code);
      announceStatus('Failed to start a new chat. Please try again.');
    }
  };

  // Save messages to Firestore
  const saveMessageToFirestore = async (message) => {
    if (!chatId) {
      console.error('No chat session active.');
      announceStatus('No active chat session. Please start a new chat.');
      return;
    }

    const chatRef = doc(db, 'users', user.uid, 'sessions', chatId);
    try {
      await updateDoc(chatRef, {
        messages: arrayUnion({
          ...message,
          createdAt: serverTimestamp(),
        }),
      });
      console.log(`Message saved to Firestore for chatId: ${chatId}`);
    } catch (err) {
      console.error('Error saving message to Firestore:', err.message, err.code);
      announceStatus('Failed to save message. It may not persist.');
    }
  };

  // Fetch chat history for the current user
  const fetchChatHistory = async (currentUser) => {
    if (!currentUser) return;

    try {
      const sessionsRef = collection(db, 'users', currentUser.uid, 'sessions');
      const q = query(sessionsRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const history = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setChatHistory(history);
      console.log('Chat history fetched:', history);

      // Auto-load the most recent chat if no chatId is set
      if (history.length > 0 && !chatId) {
        const mostRecentChat = history[0];
        setChatId(mostRecentChat.id);
        localStorage.setItem('chatId', mostRecentChat.id);
        setMessages(mostRecentChat.messages || []);
        announceStatus(`Loaded most recent chat with ID: ${mostRecentChat.id}`);
      }
    } catch (err) {
      console.error('Error fetching chat history:', err.message, err.code);
      announceStatus('Failed to load chat history.');
    }
  };

  // Load a previous chat
  const loadChat = (chat) => {
    setChatId(chat.id);
    localStorage.setItem('chatId', chat.id);
    setMessages(chat.messages || []);
    const chatDate = chat.createdAt?.toDate ? chat.createdAt.toDate().toLocaleString() : 'unknown date';
    announceStatus(`Loaded chat from ${chatDate}`);
  };

  // Delete a chat
  const deleteChat = async (chatIdToDelete) => {
    try {
      const chatRef = doc(db, 'users', user.uid, 'sessions', chatIdToDelete);
      await deleteDoc(chatRef);
      setChatHistory((prev) => prev.filter((chat) => chat.id !== chatIdToDelete));
      if (chatId === chatIdToDelete) {
        setChatId(null);
        localStorage.removeItem('chatId');
        setMessages([]);
      }
      announceStatus('Chat deleted successfully.');
    } catch (err) {
      console.error('Error deleting chat:', err.message, err.code);
      announceStatus('Failed to delete chat.');
    }
  };

  // Open the camera for photo capture
  const handleCameraOpen = async () => {
    if (isProcessing) return;
    if (isLoadingAuth) {
      announceStatus('Please wait, authentication is still loading.');
      return;
    }
    if (!user) {
      announceStatus('Please sign in to use the camera.');
      return;
    }
    if (!chatId) {
      announceStatus('Please start a new chat session.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      setIsCameraOpen(true);
      setIsVideoReady(false);
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        cameraVideoRef.current.onloadedmetadata = () => {
          cameraVideoRef.current.play().catch((err) => {
            console.error('Error playing video:', err);
            announceStatus('Error playing camera feed. Please try again.');
          });
          setIsVideoReady(true);
          announceStatus('Camera feed is ready. Use the capture button to take a photo.');
        };
      }
      announceStatus('Camera opened.');
    } catch (err) {
      console.error('Error accessing camera:', err);
      let errorMessage = 'Failed to open camera. ';
      if (err.name === 'NotAllowedError') {
        errorMessage += 'Camera permission denied. Please allow access.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'No camera found on this device.';
      } else {
        errorMessage += err.message;
      }
      announceStatus(errorMessage);
    }
  };

  // Capture a photo from the camera feed
  const handleCapturePhoto = async () => {
    if (!cameraVideoRef.current || !cameraStream || !isVideoReady) {
      console.warn('Video feed not ready for capture');
      announceStatus('Camera feed is not ready. Please wait a moment and try again.');
      return;
    }

    const video = cameraVideoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('Video dimensions are not available');
      announceStatus('Cannot capture photo: Video dimensions are not available.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      console.log('Photo captured, converting to Blob...');

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            console.error('Failed to convert canvas to Blob');
            announceStatus('Failed to capture photo. Please try again.');
            return;
          }

          console.log('Blob created, size:', blob.size);
          const file = new File([blob], 'captured-photo.jpg', { type: 'image/jpeg' });

          const event = { target: { files: [file] } };
          await handleImageUpload(event);

          handleCameraClose();
          announceStatus('Photo captured and uploaded.');
        },
        'image/jpeg',
        0.8
      );
    } catch (err) {
      console.error('Error capturing photo:', err);
      announceStatus('Error capturing photo: ' + err.message);
    }
  };

  // Close the camera and stop the stream
  const handleCameraClose = () => {
    if (cameraStream) {
      const tracks = cameraStream.getTracks();
      tracks.forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
    setIsVideoReady(false);
    announceStatus('Camera closed.');
  };

  // Handle voice sample upload
  const handleVoiceSampleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) {
      announceStatus('No voice sample selected.');
      return;
    }
    setVoiceSample(file);
    announceStatus('Voice sample uploaded: ' + file.name);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    document.body.classList.add('chat-route');
    if (isNavbarHidden) {
      document.body.classList.add('navbar-hidden');
      announceStatus('Navbar hidden');
    } else {
      document.body.classList.remove('navbar-hidden');
      announceStatus('Navbar visible');
    }
    return () => {
      document.body.classList.remove('chat-route', 'navbar-hidden');
    };
  }, [isNavbarHidden]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (extensionMenuRef.current && !extensionMenuRef.current.contains(event.target)) {
        toggleExtensionMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoadingAuth(false);
      if (currentUser) {
        console.log('User authenticated:', currentUser.uid);
        fetchChatHistory(currentUser);
      } else {
        console.log('No user authenticated');
        setChatId(null);
        localStorage.removeItem('chatId');
        setMessages([]);
        setChatHistory([]);
        announceStatus('User signed out. Please sign in to continue.');
      }
    });
    return () => unsubscribe();
  }, []);

  const handleNewChat = async () => {
    if (isLoadingAuth) {
      announceStatus('Please wait, authentication is still loading.');
      return;
    }
    if (!user) {
      announceStatus('Please sign in to start a new chat.');
      return;
    }
    setIsTyping(false);
    setIsNavbarHidden(false);
    setImage(null);
    setSelectedExtension(null);
    announceStatus('New chat started');
    await initializeChatSession(user);
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (e.target.value.trim()) {
      setIsNavbarHidden(true);
    } else {
      setIsNavbarHidden(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    if (isLoadingAuth) {
      announceStatus('Please wait, authentication is still loading.');
      return;
    }
    if (!user) {
      announceStatus('Please sign in to send messages.');
      return;
    }
    if (!chatId) {
      announceStatus('Please start a new chat session.');
      return;
    }

    setIsProcessing(true);
    const userMessage = {
      text: input,
      words: input.split(/\s+/),
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'text',
    };
    setMessages((prev) => [...prev, userMessage]);
    await saveMessageToFirestore(userMessage);
    setInput('');
    setIsTyping(true);

    try {
      console.log('Sending message to backend:', { message: input, language: settings.language || 'en' });
      const res = await axios.post('api/chat', {
        message: input,
        language: settings.language || 'en',
      }, {
        timeout: 20000,
      });
      console.log('Backend response:', res.data);
      const aiMessage = {
        text: res.data.response || 'No response received from server.',
        words: (res.data.response || 'No response received from server.').split(/\s+/),
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'text',
      };
      setMessages((prev) => [...prev, aiMessage]);
      await saveMessageToFirestore(aiMessage);
    } catch (err) {
      console.error('Chat error:', err);
      let errorMessage = 'Sorry, I couldn’t process your message. ';
      if (err.code === 'ERR_NETWORK') {
        errorMessage += 'Network error: Please check your internet connection and ensure the backend server is running.';
      } else if (err.code === 'ECONNABORTED') {
        errorMessage += 'Request timed out: The backend server took too long to respond.';
      } else if (err.response) {
        errorMessage += `Server error: ${err.response.status} - ${err.response.data.message || 'Unknown error'}.`;
        if (err.response.status === 404) {
          errorMessage += ' The endpoint /api/chat might not exist on the server.';
        } else if (err.response.status === 500) {
          errorMessage += ' There might be an issue with the server’s configuration.';
        }
      } else if (err.message.includes('CORS')) {
        errorMessage += 'CORS error: The backend server may not be configured to allow requests from this origin.';
      } else {
        errorMessage += 'An unexpected error occurred: ' + err.message;
      }
      const errorMsg = {
        text: errorMessage,
        words: errorMessage.split(/\s+/),
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'text',
      };
      setMessages((prev) => [...prev, errorMsg]);
      await saveMessageToFirestore(errorMsg);
    } finally {
      setIsTyping(false);
      setIsProcessing(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || isProcessing) return;
    if (isLoadingAuth) {
      announceStatus('Please wait, authentication is still loading.');
      return;
    }
    if (!user) {
      announceStatus('Please sign in to upload images.');
      return;
    }
    if (!chatId) {
      announceStatus('Please start a new chat session.');
      return;
    }

    setIsProcessing(true);
    const imageUrl = URL.createObjectURL(file);
    setImage(imageUrl);

    const userImageMessage = {
      text: 'Image uploaded',
      words: ['Image', 'uploaded'],
      imageUrl,
      type: 'image',
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      altText: 'User-uploaded image awaiting description',
    };
    setMessages((prev) => [...prev, userImageMessage]);
    await saveMessageToFirestore(userImageMessage);
    setIsTyping(true);

    try {
      console.log('Uploading image to backend');
      const formData = new FormData();
      formData.append('image', file);
      formData.append('language', settings.language || 'en');

      const res = await axios.post('api/upload', formData, {});
      console.log('Backend response for image upload:', res.data);
      const aiMessage = {
        text: res.data.description || 'No description received from server.',
        words: (res.data.description || 'No description received from server.').split(/\s+/),
        type: 'text',
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMessage]);
      await saveMessageToFirestore(aiMessage);
    } catch (err) {
      console.error('Image upload error:', err);
      let errorMessage = 'Sorry, I couldn’t analyze the image. ';
      if (err.code === 'ERR_NETWORK') {
        errorMessage += 'Network error: Please check your internet connection and ensure the backend server is running.';
      } else if (err.code === 'ECONNABORTED') {
        errorMessage += 'Request timed out: The backend server took too long to respond.';
      } else if (err.response) {
        errorMessage += `Server error: ${err.response.status} - ${err.response.data.message || 'Unknown error'}.`;
      } else if (err.message.includes('CORS')) {
        errorMessage += 'CORS error: The backend server may not be configured to allow requests from this origin.';
      } else {
        errorMessage += 'An unexpected error occurred: ' + err.message;
      }
      const errorMsg = {
        text: errorMessage,
        words: errorMessage.split(/\s+/),
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'text',
      };
      setMessages((prev) => [...prev, errorMsg]);
      await saveMessageToFirestore(errorMsg);
    } finally {
      setIsTyping(false);
      setIsProcessing(false);
    }
  };

  const handleExtensionOption = async (option) => {
    if (isProcessing) return;
    setSelectedExtension(option);
    announceStatus(`${option} selected`);
    setIsClosingMenu(true);
    setTimeout(() => {
      setIsExtensionMenuOpen(false);
      setIsClosingMenu(false);
    }, 300);

    if (option === 'Voice') {
      voiceInputRef.current.click();
      return;
    }

    if (isLoadingAuth) {
      announceStatus('Please wait, authentication is still loading.');
      return;
    }
    if (!user) {
      announceStatus('Please sign in to use extensions.');
      return;
    }
    if (!chatId) {
      announceStatus('Please start a new chat session.');
      return;
    }

    setIsProcessing(true);
    setIsTyping(true);
    try {
      console.log(`Sending ${option} request to backend`);
      let aiMessage;
      if (option === 'Music') {
        const res = await axios.post('api/generate-music', { culture: 'indian_raga', language: settings.language || 'en' }, {
          timeout: 600000,
        });
        console.log('Backend response for music:', res.data);
        console.log(res.data.audio_url);
        aiMessage = {
          text: 'Here’s your generated music:',
          words: ['Here’s', 'your', 'generated', 'music:'],
          audioUrl: res.data.audio_url || 'Audio generation failed.',
          sender: 'ai',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'audio',
        };
      } else if (option === 'Story') {
        const res = await axios.post('api/storytelling', { choice: '', language: settings.language || 'en' }, {
          timeout: 60000,
        });
        console.log('Backend response for story:', res.data);
        aiMessage = {
          text: res.data.story_prompt || 'Story generation failed.',
          words: (res.data.story_prompt || 'Story generation failed.').split(/\s+/),
          sender: 'ai',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'story',
        };
      } else if (option === 'Learn') {
        aiMessage = {
          text: 'Learning feature is not yet available. Stay tuned!',
          words: ['Learning', 'feature', 'is', 'not', 'yet', 'available.', 'Stay', 'tuned!'],
          sender: 'ai',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'text',
        };
      } else if (option === 'Navigation') {
        const res = await axios.post('api/navigation', { language: settings.language || 'en' }, {
          timeout: 60000,
        });
        console.log('Backend response for navigation:', res.data);
        aiMessage = {
          text: res.data.guidance || 'Navigation guidance failed.',
          words: (res.data.guidance || 'Navigation guidance failed.').split(/\s+/),
          sender: 'ai',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'navigation',
        };
      }
      setMessages((prev) => [...prev, aiMessage]);
      await saveMessageToFirestore(aiMessage);
    } catch (err) {
      console.error(`${option} API error:`, err);
      let errorMessage = `Sorry, I couldn’t process the ${option} request. `;
      if (err.code === 'ERR_NETWORK') {
        errorMessage += 'Network error: Please check your internet connection and ensure the backend server is running.';
      } else if (err.code === 'ECONNABORTED') {
        errorMessage += 'Request timed out: The backend server took too long to respond.';
      } else if (err.response) {
        errorMessage += `Server error: ${err.response.status} - ${err.response.data.message || 'Unknown error'}.`;
      } else if (err.message.includes('CORS')) {
        errorMessage += 'CORS error: The backend server may not be configured to allow requests from this origin.';
      } else {
        errorMessage += 'An unexpected error occurred: ' + err.message;
      }
      const errorMsg = {
        text: errorMessage,
        words: errorMessage.split(/\s+/),
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'text',
      };
      setMessages((prev) => [...prev, errorMsg]);
      await saveMessageToFirestore(errorMsg);
    } finally {
      setIsTyping(false);
      setIsProcessing(false);
    }
  };

  const handlePlayPause = async (messageId, text, words) => {
    // If already playing this message, pause it
    if (isPlaying === messageId) {
      if (synthRef.current.speaking) {
        synthRef.current.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlaying(null);
      setCurrentWordIndex((prev) => ({ ...prev, [messageId]: -1 }));
      announceStatus('Playback paused');
      return;
    }

    // Cleanup any ongoing playback
    if (synthRef.current.speaking) {
      synthRef.current.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Start new playback
    setIsPlaying(messageId);
    setCurrentWordIndex((prev) => ({ ...prev, [messageId]: -1 }));

    // Check if a voice sample or custom voice is available
    let voiceFile = null;
    let voiceSource = '';
    if (voiceSample) {
      voiceFile = voiceSample;
      voiceSource = 'uploaded voice sample';
    } else if (settings.voiceId && settings.voiceFileUrl) {
      try {
        const response = await fetch(settings.voiceFileUrl);
        if (!response.ok) throw new Error('Failed to fetch custom voice file');
        const blob = await response.blob();
        voiceFile = new File([blob], 'custom-voice.wav', { type: 'audio/wav' });
        voiceSource = 'custom voice from settings';
      } catch (error) {
        console.error('Error fetching custom voice file:', error);
        announceStatus('Failed to fetch custom voice: ' + error.message);
      }
    }

    if (voiceFile) {
      // Send the voice file and text to the backend for TTS processing
      try {
        console.log('Sending TTS request to backend with voice file...');
        const timestamp = Date.now();
        const sessionKey = chatId || 'default_session';
        const audioUrlPath = `/media/output/tts_${sessionKey}_${timestamp}.wav`;

        const ttsRequest = {
          audio_url: audioUrlPath,
          tts: {
            text: text,
            language: settings.language || 'en',
            voice: 'cloned',
          },
        };

        const formData = new FormData();
        formData.append('request', JSON.stringify(ttsRequest));
        formData.append('voice_file', voiceFile);

        const res = await axios.post('http://localhost:8000/api/tts', formData, {
          timeout: 30000,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        console.log('Backend response for TTS:', res.data);
        if (res.data.error) {
          throw new Error(res.data.error);
        }

        const audioUrl = res.data.audio_url || audioUrlPath;
        audioRef.current = new Audio(audioUrl);

        audioRef.current.onended = () => {
          setIsPlaying(null);
          setCurrentWordIndex((prev) => ({ ...prev, [messageId]: -1 }));
        };

        audioRef.current.onerror = (err) => {
          console.error('Audio playback error:', err);
          announceStatus('Failed to play the audio');
          setIsPlaying(null);
          setCurrentWordIndex((prev) => ({ ...prev, [messageId]: -1 }));
        };

        // Simulate word highlighting
        const duration = text.length * 50; // Rough estimate: 50ms per character
        const wordDuration = duration / words.length;
        let currentWord = 0;
        const interval = setInterval(() => {
          setCurrentWordIndex((prev) => ({ ...prev, [messageId]: currentWord }));
          currentWord++;
          if (currentWord >= words.length) {
            clearInterval(interval);
          }
        }, wordDuration);

        audioRef.current.onended = () => {
          clearInterval(interval);
          setIsPlaying(null);
          setCurrentWordIndex((prev) => ({ ...prev, [messageId]: -1 }));
        };

        await audioRef.current.play();
        announceStatus(`Playing message with ${voiceSource}`);
      } catch (err) {
        console.error('TTS error:', err);
        let errorMessage = 'Sorry, I couldn’t process the TTS request. ';
        if (err.code === 'ERR_NETWORK') {
          errorMessage += 'Network error: Please check your internet connection.';
        } else if (err.response) {
          errorMessage += `Server error: ${err.response.status}.`;
        } else {
          errorMessage += err.message;
        }
        announceStatus(errorMessage);
        setIsPlaying(null);
        setCurrentWordIndex((prev) => ({ ...prev, [messageId]: -1 }));
        // Fallback to default speech synthesis
        playWithDefaultSpeech(messageId, text, words);
      }
    } else {
      // No voice sample or custom voice available, use default speech synthesis
      playWithDefaultSpeech(messageId, text, words);
    }
  };

  const playWithDefaultSpeech = (messageId, text, words) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = settings.narrationSpeed || 1;
    utterance.volume = settings.narrationVolume || 0.8;
    utterance.pitch = settings.narrationPitch || 1;
    utterance.lang = settings.language || 'en-US';

    utterance.onend = () => {
      setIsPlaying(null);
      setCurrentWordIndex((prev) => ({ ...prev, [messageId]: -1 }));
      announceStatus('Playback finished');
    };

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const charIndex = event.charIndex;
        let wordIndex = 0;
        let currentChar = 0;
        for (let i = 0; i < words.length; i++) {
          currentChar += words[i].length + 1;
          if (charIndex < currentChar) {
            wordIndex = i;
            break;
          }
        }
        setCurrentWordIndex((prev) => ({ ...prev, [messageId]: wordIndex }));
      }
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
      announceStatus('Failed to play message: ' + event.error);
      setIsPlaying(null);
      setCurrentWordIndex((prev) => ({ ...prev, [messageId]: -1 }));
    };

    synthRef.current.speak(utterance);
    announceStatus('Playing message with default voice');
  };

  const toggleExtensionMenu = () => {
    if (isExtensionMenuOpen) {
      setIsClosingMenu(true);
      setTimeout(() => {
        setIsExtensionMenuOpen(false);
        setIsClosingMenu(false);
        announceStatus('Extension menu closed');
      }, 300);
    } else {
      setIsExtensionMenuOpen(true);
      announceStatus('Extension menu opened');
    }
  };

  const clearSelectedExtension = () => {
    setSelectedExtension(null);
    announceStatus('Selected extension cleared');
  };

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      announceStatus('Speech recognition is not supported in this browser.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        announceStatus('Recording started. Speak now.');
      } catch (err) {
        console.error('Error starting speech recognition:', err);
        announceStatus('Failed to start recording. Please check microphone permissions.');
      }
    }
  };

  const announceStatus = (message) => {
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('style', 'position: absolute; left: -9999px;');
    liveRegion.textContent = message;
    document.body.appendChild(liveRegion);
    setTimeout(() => document.body.removeChild(liveRegion), 1000);
  };

  const handleKeyDown = (e, action, ...args) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action(...args);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarHidden((prev) => !prev);
    announceStatus(isSidebarHidden ? 'Sidebar shown' : 'Sidebar hidden');
  };

  return (
    <div className="chat-container">
      <style>
        {`
          .chat-container {
            display: flex;
            min-height: 100vh;
          }
          .chat-sidebar.hidden {
            display: none;
          }
          .chat-main {
            flex: 1;
            transition: all 0.3s ease;
            display: flex;
            flex-direction: column;
          }
          .chat-main.full-width {
            width: 100%;
          }
          .sidebar-toggle-button {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 5px;
            margin-left: 10px;
            color: #fff;
          }
          .sidebar-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .chat-messages {
            flex: 1;
            overflow-y: auto; /* Enable vertical scrolling */
            padding: 0.5rem;
            display: flex;
            flex-direction: column;
            gap: 1rem;
            position: relative;
            scrollbar-width: thin;
            scrollbar-color: #38BDF8 #1E2A3C;
          }
          .chat-messages::-webkit-scrollbar {
            width: 8px;
          }
          .chat-messages::-webkit-scrollbar-track {
            background: #1E2A3C;
          }
          .chat-messages::-webkit-scrollbar-thumb {
            background: #38BDF8;
            border-radius: 4px;
          }
          .chat-messages::-webkit-scrollbar-thumb:hover {
            background: #EC4899;
          }
          .camera-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            padding: 1rem;
          }
          .camera-modal video {
            max-width: 90%;
            max-height: 60%;
            border-radius: 8px;
            border: 2px solid #38BDF8;
          }
          .camera-modal-buttons {
            display: flex;
            gap: 1rem;
            margin-top: 1rem;
          }
          .camera-modal-buttons button {
            padding: 0.5rem 1rem;
            font-size: 1rem;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          .camera-modal-buttons .capture-button {
            background: #38BDF8;
            color: #0D1117;
          }
          .camera-modal-buttons .capture-button:disabled {
            background: #666;
            cursor: not-allowed;
            transform: none;
          }
          .camera-modal-buttons .capture-button:hover:not(:disabled) {
            background: #EC4899;
            transform: scale(1.05);
          }
          .camera-modal-buttons .cancel-button {
            background: #ff4d4d;
            color: #fff;
          }
          .camera-modal-buttons .cancel-button:hover {
            background: #cc3333;
            transform: scale(1.05);
          }
          .camera-button, .voice-upload-button {
            padding: 0.5rem;
            background: transparent;
            color: #38BDF8;
            font-size: 1.2rem;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          .camera-button:hover, .voice-upload-button:hover {
            background: rgba(56, 189, 248, 0.2);
            transform: scale(1.1);
          }
          .camera-button:focus, .voice-upload-button:focus {
            outline: 2px solid #38BDF8;
            outline-offset: 2px;
          }
          .message-word {
            display: inline-block;
            margin-right: 0.2rem;
            transition: background-color 0.2s ease;
          }
          .message-word.highlighted {
            background-color: #38BDF8;
            color: #0D1117;
            padding: 0.1rem 0.3rem;
            border-radius: 4px;
          }
        `}
      </style>

      <aside className={`chat-sidebar glass ${isSidebarHidden ? 'hidden' : ''}`}>
        <div className="sidebar-header">
          <h2>👓 Vision Talk</h2>
          <button
            className="sidebar-toggle-button"
            onClick={toggleSidebar}
            onKeyDown={(e) => handleKeyDown(e, toggleSidebar)}
            aria-label={isSidebarHidden ? 'Show sidebar' : 'Hide sidebar'}
          >
            {isSidebarHidden ? <VisibilityIcon /> : <VisibilityOffIcon />}
          </button>
        </div>
        <p>Your AI-powered assistant for the visually impaired</p>
        <button
          className="new-chat-button"
          onClick={handleNewChat}
          onKeyDown={(e) => handleKeyDown(e, handleNewChat)}
          disabled={isLoadingAuth}
          aria-label="Start a new chat"
        >
          <AddIcon /> New Chat
        </button>
        <Link to="/" className="home-link">
          <HomeIcon /> Back to Home
        </Link>
        <div className="chat-history">
          <h3>Chat History</h3>
          {isLoadingAuth ? (
            <p className="chat-history-placeholder">Loading chat history...</p>
          ) : chatHistory.length === 0 ? (
            <p className="chat-history-placeholder">No chat history available.</p>
          ) : (
            <>
              {chatHistory.slice(0, maxDisplayedHistoryItems).map((chat) => (
                <div key={chat.id} className="history-item">
                  <span
                    className="history-text"
                    onClick={() => loadChat(chat)}
                    onKeyDown={(e) => handleKeyDown(e, loadChat, chat)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Load chat from ${chat.createdAt?.toDate ? chat.createdAt.toDate().toLocaleString() : 'unknown date'}: ${
                      chat.messages.length > 0 ? chat.messages[0].text.substring(0, 30) : 'Empty chat'
                    }`}
                  >
                    {chat.messages.length > 0
                      ? chat.messages[0].text.substring(0, 30) + (chat.messages[0].text.length > 30 ? '...' : '')
                      : 'Empty chat'}
                  </span>
                  <button
                    className="delete-button"
                    onClick={() => deleteChat(chat.id)}
                    onKeyDown={(e) => handleKeyDown(e, deleteChat, chat.id)}
                    aria-label={`Delete chat from ${chat.createdAt?.toDate ? chat.createdAt.toDate().toLocaleString() : 'unknown date'}`}
                  >
                    <DeleteIcon />
                  </button>
                </div>
              ))}
              {chatHistory.length > maxDisplayedHistoryItems && (
                <div className="fade-out" aria-hidden="true"></div>
              )}
            </>
          )}
        </div>
      </aside>

      <section className={`chat-main ${isSidebarHidden ? 'full-width' : ''}`}>
        <div className="chat-messages">
          {messages.length > 0 ? (
            <>
              {messages.map((msg, idx) => (
                <div
                  key={`${msg.timestamp}-${idx}`}
                  className={`message ${msg.sender} glass`}
                  role="article"
                  aria-label={`Message from ${msg.sender === 'user' ? 'User' : 'Vision Talk'} at ${msg.timestamp}`}
                >
                  {msg.type === 'image' && msg.imageUrl ? (
                    <>
                      <img
                        src={msg.imageUrl}
                        alt={msg.altText}
                        className="message-image"
                        aria-describedby={`image-desc-${idx}`}
                      />
                      <div id={`image-desc-${idx}`} className="message-content">
                        {msg.words.map((word, wordIdx) => (
                          <span
                            key={wordIdx}
                            className={`message-word ${
                              isPlaying === idx && currentWordIndex[idx] === wordIdx ? 'highlighted' : ''
                            }`}
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : msg.type === 'audio' && msg.audioUrl ? (
                    <>
                      <div className="message-content">
                        {msg.words.map((word, wordIdx) => (
                          <span
                            key={wordIdx}
                            className={`message-word ${
                              isPlaying === idx && currentWordIndex[idx] === wordIdx ? 'highlighted' : ''
                            }`}
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                      <audio
                        controls
                        src={msg.audioUrl}
                        className="message-audio"
                        aria-label="Generated music audio"
                      >
                        Your browser does not support the audio element.
                      </audio>
                    </>
                  ) : msg.type === 'story' || msg.type === 'navigation' ? (
                    <div className="message-content">
                      {msg.words.map((word, wordIdx) => (
                        <span
                          key={wordIdx}
                          className={`message-word ${
                            isPlaying === idx && currentWordIndex[idx] === wordIdx ? 'highlighted' : ''
                          }`}
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="message-content">
                      {msg.words.map((word, wordIdx) => (
                        <span
                          key={wordIdx}
                          className={`message-word ${
                            isPlaying === idx && currentWordIndex[idx] === wordIdx ? 'highlighted' : ''
                          }`}
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="message-footer">
                    <span className="message-timestamp">{msg.timestamp}</span>
                    <button
                      className="play-pause-button glass"
                      onClick={() => handlePlayPause(idx, msg.type === 'image' ? msg.altText : msg.text, msg.words)}
                      onKeyDown={(e) => handleKeyDown(e, handlePlayPause, idx, msg.type === 'image' ? msg.altText : msg.text, msg.words)}
                      aria-label={isPlaying === idx ? 'Pause message' : 'Play message'}
                    >
                      {isPlaying === idx ? <PauseIcon /> : <PlayArrowIcon />}
                    </button>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <p className="chat-messages-placeholder">No messages yet. Start chatting!</p>
          )}
          {isTyping && (
            <div className="message ai glass typing-indicator">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-section">
          {selectedExtension && (
            <div className="selected-extension glass">
              <span>Selected: {selectedExtension}</span>
              <button
                className="clear-extension-button"
                onClick={clearSelectedExtension}
                onKeyDown={(e) => handleKeyDown(e, clearSelectedExtension)}
                aria-label="Clear selected extension"
              >
                <ClearIcon />
              </button>
            </div>
          )}
          <div className={`chat-input-area glass ${input.trim() ? 'typing' : ''}`}>
            <button
              className="extension-button"
              onClick={toggleExtensionMenu}
              onKeyDown={(e) => handleKeyDown(e, toggleExtensionMenu)}
              aria-label={isExtensionMenuOpen ? 'Close extension menu' : 'Open extension menu'}
              aria-expanded={isExtensionMenuOpen}
              aria-controls="extension-menu"
            >
              {isExtensionMenuOpen ? <KeyboardArrowDownIcon /> : <KeyboardArrowUpIcon />}
            </button>
            {isExtensionMenuOpen && (
              <div className="extension-menu" id="extension-menu" ref={extensionMenuRef}>
                {['Story', 'Music', 'Navigation'].map((opt, index) => (
                  <button
                    key={opt}
                    className={`extension-option glass ${isClosingMenu ? 'closing' : ''}`}
                    onClick={() => handleExtensionOption(opt)}
                    onKeyDown={(e) => handleKeyDown(e, handleExtensionOption, opt)}
                    style={{ animationDelay: `${index * 0.1}s` }}
                    aria-label={`Select ${opt} option`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
            <textarea
              className="chat-input"
              placeholder="Type your message or describe an image..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              ref={textareaRef}
              rows="1"
              aria-label="Type your message"
            />
            <button
              className={`mic-button ${isRecording ? 'recording' : ''}`}
              onClick={handleMicClick}
              onKeyDown={(e) => handleKeyDown(e, handleMicClick)}
              aria-label={isRecording ? 'Stop recording' : 'Start recording with microphone'}
            >
              <MicIcon />
            </button>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageUpload}
              style={{ display: 'none' }}
              id="image-upload"
              aria-label="Upload an image"
            />
            <button
              className="image-upload-button"
              onClick={() => fileInputRef.current.click()}
              onKeyDown={(e) => handleKeyDown(e, () => fileInputRef.current.click())}
              aria-label="Upload image"
            >
              <ImageIcon />
            </button>
            <input
              type="file"
              accept="audio/*"
              ref={voiceInputRef}
              onChange={handleVoiceSampleUpload}
              style={{ display: 'none' }}
              id="voice-upload"
              aria-label="Upload voice sample"
            />
            <button
              className="voice-upload-button"
              onClick={() => voiceInputRef.current.click()}
              onKeyDown={(e) => handleKeyDown(e, () => voiceInputRef.current.click())}
              aria-label="Upload voice sample"
            >
              <AudiotrackIcon />
            </button>
            <button
              className="camera-button"
              onClick={handleCameraOpen}
              onKeyDown={(e) => handleKeyDown(e, handleCameraOpen)}
              aria-label="Open camera to take a photo"
            >
              <CameraAltIcon />
            </button>
            <button
              className="send-button"
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              onKeyDown={(e) => handleKeyDown(e, handleSend)}
              aria-label="Send message"
            >
              <SendIcon />
            </button>
          </div>
        </div>

        {isCameraOpen && (
          <div className="camera-modal">
            <video
              ref={cameraVideoRef}
              autoPlay
              playsInline
              muted
            />
            <div className="camera-modal-buttons">
              <button
                className="capture-button"
                onClick={handleCapturePhoto}
                onKeyDown={(e) => handleKeyDown(e, handleCapturePhoto)}
                disabled={!isVideoReady}
                aria-label="Capture photo"
              >
                {isVideoReady ? 'Capture' : 'Loading...'}
              </button>
              <button
                className="cancel-button"
                onClick={handleCameraClose}
                onKeyDown={(e) => handleKeyDown(e, handleCameraClose)}
                aria-label="Cancel camera"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default ChatUI;