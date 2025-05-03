import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import "./DetectionPage.css";

const ObjectDetectionPage = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const intervalRef = useRef(null);

  const [sceneDescription, setSceneDescription] = useState(""); // State to store meta_description
  const [isDetecting, setIsDetecting] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [cameraStatus, setCameraStatus] = useState("Starting camera...");
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState(""); // To display backend errors

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch((err) => {
              console.error("Error playing video:", err);
              setCameraStatus("Error: Could not play video. Please refresh the page.");
            });
            setCameraStatus("Camera active");
            setIsVideoReady(true);
            announceStatus("Camera feed is ready. Start detection to describe the scene.");
          };
        } else {
          setCameraStatus("Error: Video element not found");
          announceStatus("Error: Video element not found.");
        }
      } catch (error) {
        console.error("Error accessing webcam:", error);
        let errorMessage;
        if (error.name === "NotAllowedError") {
          errorMessage = "Error: Webcam permission denied. Please allow access.";
        } else if (error.name === "NotFoundError") {
          errorMessage = "Error: No webcam found. Please connect a camera.";
        } else {
          errorMessage = `Error: ${error.message}`;
        }
        setCameraStatus(errorMessage);
        announceStatus(errorMessage);
      }
    };

    startCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop());
      }
      setIsVideoReady(false);
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (isDetecting) {
      intervalRef.current = setInterval(captureAndRecognize, 20000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setSceneDescription("");
      setErrorMessage("");
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isDetecting]);

  const captureAndRecognize = async () => {
    if (!videoRef.current || !canvasRef.current || !isVideoReady) {
      console.warn("Video or canvas not ready for frame capture");
      announceStatus("Camera feed is not ready. Please wait a moment and try again.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error("Video dimensions are not available");
      announceStatus("Cannot capture frame: Video dimensions are not available.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      console.log("Captured frame, converting to base64...");

      const frameData = canvas.toDataURL("image/jpeg", 0.8);
      console.log("Frame converted to base64, sending to backend...");

      const response = await axios.post("/api/live-recognition/", {
        image: frameData,
      });

      console.log("Backend response:", JSON.stringify(response.data, null, 2));

      // Validate the response structure
      if (!response.data || typeof response.data !== "object") {
        throw new Error("Invalid response from backend: Response data is not an object.");
      }

      const metaDescription = response.data.meta_description || "No description available.";
      setSceneDescription(metaDescription);
      setErrorMessage(""); // Clear any previous error messages

      // Speak the description if audio is enabled
      if (audioEnabled) {
        speakDescription(metaDescription);
      }
    } catch (error) {
      console.error("Error during scene description:", error);
      let errorMessage = "Error describing scene: ";
      if (error.code === "ERR_NETWORK") {
        errorMessage += "Network error. Please check your internet connection.";
      } else if (error.response) {
        errorMessage += `Server error: ${error.response.status} - ${error.response.data.message || "Unknown error"}.`;
      } else {
        errorMessage += error.message;
      }
      setErrorMessage(errorMessage);
      announceStatus(errorMessage);
      setSceneDescription(""); // Reset description on error
    }
  };

  const speakDescription = (text) => {
    if (synthRef.current) {
      synthRef.current.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.onend = () => {
        console.log("Finished speaking description");
        announceStatus("Scene description spoken.");
      };
      utterance.onerror = (event) => {
        console.error("Speech synthesis error:", event);
        announceStatus("Failed to speak the scene description.");
      };
      synthRef.current.speak(utterance);
      announceStatus("Speaking scene description.");
    } else {
      console.warn("Speech Synthesis API not supported in this browser.");
      announceStatus("Speech synthesis is not supported in this browser.");
    }
  };

  const toggleDetection = () => {
    setIsDetecting((prev) => !prev);
    announceStatus(isDetecting ? "Scene description stopped." : "Scene description started.");
  };

  const toggleAudio = () => {
    setAudioEnabled((prev) => !prev);
    if (synthRef.current) {
      synthRef.current.cancel(); // Stop any ongoing speech when muting
    }
    announceStatus(audioEnabled ? "Audio muted." : "Audio enabled.");
  };

  const announceStatus = (message) => {
    const liveRegion = document.createElement("div");
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.setAttribute("style", "position: absolute; left: -9999px;");
    liveRegion.textContent = message;
    document.body.appendChild(liveRegion);
    setTimeout(() => document.body.removeChild(liveRegion), 1000);
  };

  const handleKeyDown = (e, action, ...args) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action(...args);
    }
  };

  return (
    <div className="detection-page">
      <header className="detection-header">
        <h2>Real-Time Scene Description</h2>
        <p>{cameraStatus}</p>
      </header>

      <main className="detection-main">
        <section className="scene-description glass">
          <h3>Scene Description</h3>
          {errorMessage ? (
            <p className="error-message">{errorMessage}</p>
          ) : sceneDescription ? (
            <p>{sceneDescription}</p>
          ) : (
            <p>No scene description available yet. Start detection to describe the scene.</p>
          )}
        </section>

        <section className="video-section">
          <div className="video-container">
            <video
              ref={videoRef}
              className="video-feed"
              autoPlay
              playsInline
              muted
            />
          </div>
          <div className="controls">
            <button
              onClick={toggleDetection}
              className="control-button"
              disabled={cameraStatus !== "Camera active"}
              onKeyDown={(e) => handleKeyDown(e, toggleDetection)}
              aria-label={isDetecting ? "Stop scene description" : "Start scene description"}
            >
              {isDetecting ? "Stop Description" : "Start Description"}
            </button>
            <button
              onClick={toggleAudio}
              className="control-button audio-toggle"
              onKeyDown={(e) => handleKeyDown(e, toggleAudio)}
              aria-label={audioEnabled ? "Mute audio descriptions" : "Enable audio descriptions"}
            >
              {audioEnabled ? "Mute Audio" : "Enable Audio"}
            </button>
          </div>
        </section>
      </main>

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
};

export default ObjectDetectionPage;