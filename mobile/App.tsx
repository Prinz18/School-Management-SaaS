import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Easing,
  Modal,
  StatusBar
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Audio } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import { config } from './config';

const { width, height } = Dimensions.get('window');

// Injectable HTML code that handles AudioContext and WebSocket connections
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gemini Live Webview Handler</title>
  <style>
    body {
      background-color: #0f172a;
      color: #cbd5e1;
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 16px;
      display: flex;
      flex-direction: column;
      height: 100vh;
      box-sizing: border-box;
      justify-content: center;
      align-items: center;
    }
    #status {
      font-size: 18px;
      font-weight: bold;
      color: #38bdf8;
      margin-bottom: 8px;
    }
    #log {
      width: 100%;
      height: 120px;
      background-color: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 8px;
      font-family: monospace;
      font-size: 11px;
      overflow-y: auto;
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  <div id="status">WebView Loaded</div>
  <div id="log">Logs initialized...</div>

  <script>
    const statusEl = document.getElementById('status');
    const logEl = document.getElementById('log');

    function log(msg) {
      console.log(msg);
      logEl.innerText += "\\n" + msg;
      logEl.scrollTop = logEl.scrollHeight;
      sendToRN('log', msg);
    }

    function updateStatus(status) {
      statusEl.innerText = "Status: " + status;
    }

    let audioContext = null;
    let microphone = null;
    let processor = null;
    let ws = null;
    let isRecording = false;
    let isConnected = false;
    let playbackContext = null;
    let playbackNextTime = 0;
    let activeSources = [];

    // Helper: float 32 to PCM 16bit
    function floatTo16BitPCM(output, offset, input) {
      for (let i = 0; i < input.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }
    }

    // Helper: downsample buffer
    function downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
      if (inputSampleRate === outputSampleRate) {
        return buffer;
      }
      const sampleRateRatio = inputSampleRate / outputSampleRate;
      const newLength = Math.round(buffer.length / sampleRateRatio);
      const result = new Float32Array(newLength);
      let offsetResult = 0;
      let offsetBuffer = 0;
      while (offsetResult < result.length) {
        const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
        let idxAccum = 0, count = 0;
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
          idxAccum += buffer[i];
          count++;
        }
        result[offsetResult] = count > 0 ? idxAccum / count : 0;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
      }
      return result;
    }

    // Helper: ArrayBuffer to Base64
    function arrayBufferToBase64(buffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    }

    // Send data to React Native
    function sendToRN(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, data }));
      }
    }

    // Start Gemini Live API Session
    async function startSession(apiKey, model, hostUrl, systemInstruction) {
      try {
        if (ws) {
          log("Session already active, stopping old first...");
          stopSession();
        }

        log("Starting session with model: " + model);
        updateStatus("Connecting...");
        sendToRN('status', 'connecting');

        const wsHost = hostUrl || "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";
        const url = wsHost + "?key=" + apiKey;
        
        ws = new WebSocket(url);
        
        ws.onopen = () => {
          isConnected = true;
          log("WebSocket connection established!");
          sendToRN('status', 'connected');
          
          // Send setup message
          const setupMsg = {
            setup: {
              model: model || "models/gemini-2.0-flash-exp",
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: "Aoede" // Core voices: Aoede, Charon, Fenrir, Kore, Puck
                    }
                  }
                }
              }
            }
          };

          // Apply school-specific system instructions if provided
          if (systemInstruction) {
            log("Applying custom system instruction: " + systemInstruction.substring(0, 60) + "...");
            setupMsg.setup.generationConfig.systemInstruction = {
              parts: [{ text: systemInstruction }]
            };
          }

          ws.send(JSON.stringify(setupMsg));
          log("Setup message sent.");
          
          // Initialize recording
          startMicrophone();
        };

        ws.onmessage = async (event) => {
          let response;
          try {
            response = JSON.parse(event.data);
          } catch (e) {
            log("Error parsing websocket message: " + e.message);
            return;
          }

          if (response.serverContent) {
            const serverContent = response.serverContent;
            
            // Handle Interruption
            if (serverContent.interrupted) {
              log("Model interrupted!");
              sendToRN('interrupted', true);
              stopPlayback();
              return;
            }

            // Handle output parts
            if (serverContent.modelTurn && serverContent.modelTurn.parts) {
              for (const part of serverContent.modelTurn.parts) {
                if (part.text) {
                  log("Text: " + part.text);
                  sendToRN('text', part.text);
                }
                
                if (part.inlineData && part.inlineData.data) {
                  sendToRN('status', 'speaking');
                  updateStatus("Speaking...");
                  playAudioChunk(part.inlineData.data);
                }
              }
            }

            // Handle turn complete
            if (serverContent.turnComplete) {
              log("Turn complete.");
              sendToRN('status', 'listening');
              updateStatus("Listening...");
            }
          }
        };

        ws.onerror = (e) => {
          log("WebSocket error");
          sendToRN('error', 'WebSocket connection failed.');
        };

        ws.onclose = (e) => {
          log("WebSocket closed: " + e.code + " / " + e.reason);
          isConnected = false;
          sendToRN('status', 'disconnected');
          updateStatus("Disconnected");
          stopMicrophone();
          stopPlayback();
        };

      } catch (err) {
        log("Start session failed: " + err.message);
        sendToRN('error', err.message);
        sendToRN('status', 'error');
      }
    }

    // Start capturing audio from Microphone
    async function startMicrophone() {
      try {
        log("Accessing microphone...");
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const contextSR = audioContext.sampleRate;
        log("AudioContext sample rate: " + contextSR);
        
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        log("Microphone stream obtained.");
        microphone = audioContext.createMediaStreamSource(stream);
        
        // 2048 buffer size, 1 input, 1 output channel
        processor = audioContext.createScriptProcessor(2048, 1, 1);
        
        processor.onaudioprocess = (e) => {
          if (!isRecording || !isConnected || !ws || ws.readyState !== WebSocket.OPEN) return;
          
          let inputBuffer = e.inputBuffer.getChannelData(0);
          
          // Downsample if required
          if (contextSR !== 16000) {
            inputBuffer = downsampleBuffer(inputBuffer, contextSR, 16000);
          }
          
          // Convert Float32 to Int16 PCM
          const buffer = new ArrayBuffer(inputBuffer.length * 2);
          const view = new DataView(buffer);
          floatTo16BitPCM(view, 0, inputBuffer);
          
          const base64 = arrayBufferToBase64(buffer);
          
          ws.send(JSON.stringify({
            realtimeInput: {
              mediaChunks: [
                {
                  mimeType: "audio/pcm;rate=16000",
                  data: base64
                }
              ]
            }
          }));
        };
        
        microphone.connect(processor);
        processor.connect(audioContext.destination);
        
        isRecording = true;
        sendToRN('status', 'listening');
        updateStatus("Listening...");
        log("Microphone recording started.");
      } catch (err) {
        log("Microphone initialization failed: " + err.message);
        sendToRN('error', "Microphone: " + err.message);
        sendToRN('status', 'error');
      }
    }

    // Playback raw audio chunks from Gemini
    function playAudioChunk(base64Data) {
      try {
        if (!playbackContext) {
          playbackContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (playbackContext.state === 'suspended') {
          playbackContext.resume();
        }
        
        const binaryString = window.atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const numSamples = bytes.length / 2;
        const floatData = new Float32Array(numSamples);
        const view = new DataView(bytes.buffer);
        for (let i = 0; i < numSamples; i++) {
          floatData[i] = view.getInt16(i * 2, true) / 32768.0;
        }
        
        const audioBuffer = playbackContext.createBuffer(1, numSamples, 24000);
        audioBuffer.getChannelData(0).set(floatData);
        
        const source = playbackContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(playbackContext.destination);
        
        const now = playbackContext.currentTime;
        if (playbackNextTime < now) {
          playbackNextTime = now;
        }
        
        source.start(playbackNextTime);
        playbackNextTime += audioBuffer.duration;
        
        source.onended = () => {
          activeSources = activeSources.filter(s => s !== source);
        };
        activeSources.push(source);
        
      } catch (err) {
        log("Audio playback error: " + err.message);
      }
    }

    // Stop all audio playback
    function stopPlayback() {
      activeSources.forEach(src => {
        try { src.stop(); } catch(e) {}
      });
      activeSources = [];
      playbackNextTime = 0;
      log("Playback stopped.");
    }

    // Stop recording and close microphone
    function stopMicrophone() {
      isRecording = false;
      if (processor) {
        try { processor.disconnect(); } catch(e) {}
        processor = null;
      }
      if (microphone) {
        try { microphone.disconnect(); } catch(e) {}
        microphone = null;
      }
      if (audioContext) {
        try { audioContext.close(); } catch(e) {}
        audioContext = null;
      }
      log("Microphone stopped.");
    }

    // Stop session
    function stopSession() {
      log("Stopping session...");
      isRecording = false;
      
      if (ws) {
        try { ws.close(); } catch(e) {}
        ws = null;
      }
      
      stopMicrophone();
      stopPlayback();
      
      sendToRN('status', 'disconnected');
      updateStatus("Disconnected");
    }

    // Listen for messages from React Native
    window.addEventListener('message', (event) => {
      let data = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          // ignore
        }
      }

      if (data && data.action) {
        log("Received action: " + data.action);
        if (data.action === 'start') {
          startSession(data.apiKey, data.model, data.hostUrl, data.systemInstruction);
        } else if (data.action === 'stop') {
          stopSession();
        }
      }
    });

    document.addEventListener('message', (event) => {
      let data = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          // ignore
        }
      }

      if (data && data.action) {
        log("Received action (doc): " + data.action);
        if (data.action === 'start') {
          startSession(data.apiKey, data.model, data.hostUrl, data.systemInstruction);
        } else if (data.action === 'stop') {
          stopSession();
        }
      }
    });

    sendToRN('ready', true);
  </script>
</body>
</html>
`;

interface UserProfile {
  name: string;
  role: string;
  schoolId: string;
  schoolName: string;
  schoolMotto: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'portal' | 'assistant'>('portal');
  
  // School Portal State
  const [portalUrl, setPortalUrl] = useState<string>(config.defaultPortalUrl);
  const [portalLoading, setPortalLoading] = useState<boolean>(true);
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);
  
  // Multi-Tenant User Profile state (pushed from School Portal login)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  // Assistant Configuration State
  const [apiKey, setApiKey] = useState<string>(config.geminiApiKey);
  const [model, setModel] = useState<string>(config.geminiModel);
  const [hostUrl, setHostUrl] = useState<string>(config.geminiLiveUrl);
  const [settingsVisible, setSettingsVisible] = useState<boolean>(false);

  // Audio Assistant Live Session State
  const [assistantStatus, setAssistantStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'error'>('disconnected');
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [micPermissionGranted, setMicPermissionGranted] = useState<boolean | null>(null);

  // References
  const portalWebViewRef = useRef<WebView>(null);
  const audioWebViewRef = useRef<WebView>(null);

  // Animated Values for AI Orb
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Run initial checks
  useEffect(() => {
    checkPermissions();
  }, []);

  // Control AI Orb animations based on assistant status
  useEffect(() => {
    scaleAnim.setValue(1);
    pulseAnim.setValue(0);
    rotateAnim.setValue(0);

    let animation: Animated.CompositeAnimation | null = null;

    if (assistantStatus === 'connecting') {
      // Rotate animation for loading
      animation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      animation.start();
    } else if (assistantStatus === 'listening') {
      // Slow pulse animation for waiting/listening
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          })
        ])
      );
      animation.start();
    } else if (assistantStatus === 'speaking') {
      // Rapid pulse & scale for talking
      animation = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: 1.15,
              duration: 400,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 0.95,
              duration: 400,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            })
          ]),
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 0.8,
              duration: 350,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 0.2,
              duration: 350,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            })
          ])
        ])
      );
      animation.start();
    }

    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [assistantStatus]);

  // Request Microphone Permissions using Expo Audio
  const checkPermissions = async () => {
    try {
      const { status } = await Audio.getPermissionsAsync();
      if (status === 'granted') {
        setMicPermissionGranted(true);
      } else {
        setMicPermissionGranted(false);
      }
    } catch (e) {
      console.warn("Permission check error:", e);
      setMicPermissionGranted(false);
    }
  };

  const requestPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status === 'granted') {
        setMicPermissionGranted(true);
      } else {
        setMicPermissionGranted(false);
        Alert.alert(
          "Permission Denied",
          "Microphone access is required to use the voice assistant. Please enable it in your phone's settings."
        );
      }
    } catch (e) {
      Alert.alert("Permission Error", "Could not request microphone permissions.");
    }
  };

  // WebView navigation controls
  const handleBackPress = () => {
    if (canGoBack && portalWebViewRef.current) {
      portalWebViewRef.current.goBack();
    }
  };

  const handleForwardPress = () => {
    if (canGoForward && portalWebViewRef.current) {
      portalWebViewRef.current.goForward();
    }
  };

  const handleReloadPress = () => {
    if (portalWebViewRef.current) {
      portalWebViewRef.current.reload();
    }
  };

  // Toggle Gemini Live Voice Session
  const toggleVoiceSession = async () => {
    if (micPermissionGranted !== true) {
      await requestPermissions();
      return;
    }

    if (assistantStatus === 'disconnected' || assistantStatus === 'error') {
      if (!apiKey) {
        Alert.alert("API Key Required", "Please enter a Gemini API Key in the Settings to start the session.");
        setSettingsVisible(true);
        return;
      }
      
      // Clear previous transcript logs
      setTranscriptText('');

      // Custom multi-tenant instructions based on the user's logged-in school in Liberia
      let systemInstruction = "You are SmartSchool AI, a helpful voice assistant for the Liberian School System. Speak in a warm, polite, and encouraging tone.";
      
      if (userProfile) {
        systemInstruction = `You are the official voice assistant for ${userProfile.schoolName} in Liberia (School Motto: "${userProfile.schoolMotto}"). You are conversing with ${userProfile.name}, who is a registered ${userProfile.role} at this school. Answer questions about this specific school, their courses, grades, or help them navigate the portal in a friendly, encouraging tone. Keep your responses concise since they will be read aloud.`;
      }
      
      // Send message to WebView to start websocket session
      const startAction = {
        action: 'start',
        apiKey: apiKey,
        model: model,
        hostUrl: hostUrl,
        systemInstruction: systemInstruction
      };
      
      if (audioWebViewRef.current) {
        audioWebViewRef.current.postMessage(JSON.stringify(startAction));
      }
    } else {
      // Send message to WebView to stop websocket session
      const stopAction = { action: 'stop' };
      if (audioWebViewRef.current) {
        audioWebViewRef.current.postMessage(JSON.stringify(stopAction));
      }
    }
  };

  // Handle messages sent from the hidden Voice WebView
  const handleAudioWebViewMessage = (e: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(e.nativeEvent.data);
      const { type, data } = message;

      switch (type) {
        case 'status':
          setAssistantStatus(data);
          break;
        case 'text':
          // Append text chunk to the current transcript
          setTranscriptText(prev => prev + data);
          break;
        case 'interrupted':
          // Clear current model turn transcript
          setTranscriptText('[Interrupted]');
          break;
        case 'error':
          Alert.alert("Assistant Error", data);
          setAssistantStatus('error');
          break;
        case 'log':
          console.log("[WebView Log]:", data);
          break;
        case 'ready':
          console.log("Audio process WebView is ready.");
          break;
        default:
          break;
      }
    } catch (err) {
      console.warn("Failed to parse WebView message:", err);
    }
  };

  // Handle messages sent from the main School Portal WebView (User Login details)
  const handlePortalWebViewMessage = (e: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(e.nativeEvent.data);
      if (message.type === 'USER_PROFILE') {
        console.log("Received User Profile from School Portal WebView:", message.payload);
        setUserProfile(message.payload);
      }
    } catch (err) {
      // Ignore messages that are not formatted as JSON user profiles
    }
  };

  // Interpolated variables for animations
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const glowScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.4]
  });

  const glowOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0.2]
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={activeTab === 'assistant' ? 'light-content' : 'dark-content'} backgroundColor={activeTab === 'assistant' ? '#0f172a' : '#ffffff'} />
      
      {/* Hidden Audio Processing WebView */}
      <View style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}>
        <WebView
          ref={audioWebViewRef}
          source={{ html: htmlContent }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          originWhitelist={['*']}
          onMessage={handleAudioWebViewMessage}
          // @ts-ignore
          onPermissionRequest={(event: any) => {
            // CRITICAL: Grant microphone permission inside the WebView (Android)
            event.grant(event.resources);
          }}
        />
      </View>

      {/* Main Content Area */}
      <View style={styles.content}>
        {activeTab === 'portal' ? (
          <View style={styles.portalContainer}>
            {/* Header controls for WebView */}
            <View style={styles.portalHeader}>
              <Text style={styles.portalTitle} numberOfLines={1}>
                {userProfile ? userProfile.schoolName : 'School Portal'}
              </Text>
              <View style={styles.portalControls}>
                <TouchableOpacity onPress={handleBackPress} disabled={!canGoBack} style={[styles.controlBtn, !canGoBack && styles.disabledBtn]}>
                  <Feather name="chevron-left" size={20} color={canGoBack ? '#0284c7' : '#94a3b8'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleForwardPress} disabled={!canGoForward} style={[styles.controlBtn, !canGoForward && styles.disabledBtn]}>
                  <Feather name="chevron-right" size={20} color={canGoForward ? '#0284c7' : '#94a3b8'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleReloadPress} style={styles.controlBtn}>
                  <Feather name="rotate-cw" size={16} color="#0284c7" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.controlBtn}>
                  <Feather name="settings" size={16} color="#0284c7" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Portal WebView */}
            <WebView
              ref={portalWebViewRef}
              source={{ uri: portalUrl }}
              onLoadStart={() => setPortalLoading(true)}
              onLoadEnd={() => setPortalLoading(false)}
              onNavigationStateChange={(navState) => {
                setCanGoBack(navState.canGoBack);
                setCanGoForward(navState.canGoForward);
              }}
              onMessage={handlePortalWebViewMessage}
              style={styles.webView}
            />
            {portalLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#0284c7" />
                <Text style={styles.loadingText}>Connecting to School Portal...</Text>
              </View>
            )}
          </View>
        ) : (
          /* Gemini Live Voice Assistant Screen */
          <View style={styles.assistantContainer}>
            <View style={styles.assistantHeader}>
              <Text style={styles.assistantTitle}>Gemini Live Voice</Text>
              <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.assistantSettingsBtn}>
                <Feather name="settings" size={20} color="#cbd5e1" />
              </TouchableOpacity>
            </View>

            <View style={styles.assistantBody}>
              {/* Animated glowing AI Orb */}
              <View style={styles.orbOuterContainer}>
                {/* Glowing Outer Pulses */}
                <Animated.View
                  style={[
                    styles.orbGlow,
                    {
                      transform: [{ scale: glowScale }],
                      opacity: glowOpacity,
                      backgroundColor:
                        assistantStatus === 'error'
                          ? '#ef4444'
                          : assistantStatus === 'speaking'
                          ? '#10b981'
                          : assistantStatus === 'listening'
                          ? '#0284c7'
                          : '#6366f1',
                    },
                  ]}
                />

                {/* Main Interactive AI Orb */}
                <TouchableOpacity onPress={toggleVoiceSession} activeOpacity={0.85}>
                  <Animated.View
                    style={[
                      styles.orbMain,
                      {
                        transform: [
                          { scale: scaleAnim },
                          { rotate: spin }
                        ],
                        backgroundColor:
                          assistantStatus === 'error'
                            ? '#ef4444'
                            : assistantStatus === 'speaking'
                            ? '#059669'
                            : assistantStatus === 'listening'
                            ? '#0284c7'
                            : assistantStatus === 'connecting'
                            ? '#4f46e5'
                            : '#312e81',
                        borderColor:
                          assistantStatus === 'connected' || assistantStatus === 'listening' || assistantStatus === 'speaking'
                            ? '#38bdf8'
                            : '#475569',
                      },
                    ]}
                  >
                    {assistantStatus === 'connecting' ? (
                      <ActivityIndicator size="large" color="#ffffff" />
                    ) : (
                      <Feather
                        name={
                          assistantStatus === 'disconnected' || assistantStatus === 'error'
                            ? 'mic'
                            : assistantStatus === 'speaking'
                            ? 'volume-2'
                            : 'mic-off'
                        }
                        size={32}
                        color="#ffffff"
                      />
                    )}
                  </Animated.View>
                </TouchableOpacity>
              </View>

              {/* Status Indicator */}
              <Text style={[
                styles.statusText,
                assistantStatus === 'listening' && styles.statusListening,
                assistantStatus === 'speaking' && styles.statusSpeaking,
                assistantStatus === 'error' && styles.statusError
              ]}>
                {assistantStatus === 'disconnected' && (
                  userProfile 
                    ? `Hello ${userProfile.name}!\nTap the mic to talk with the AI for ${userProfile.schoolName}`
                    : 'Tap the mic to talk'
                )}
                {assistantStatus === 'connecting' && 'Connecting to Gemini Live...'}
                {assistantStatus === 'connected' && 'Connected! Speak now'}
                {assistantStatus === 'listening' && 'Listening... Speak now'}
                {assistantStatus === 'speaking' && 'Gemini is speaking...'}
                {assistantStatus === 'error' && 'Connection Error'}
              </Text>

              {/* Speech Transcript Display */}
              <View style={styles.transcriptContainer}>
                <ScrollView contentContainerStyle={styles.transcriptContent}>
                  {transcriptText ? (
                    <Text style={styles.transcript}>{transcriptText}</Text>
                  ) : (
                    <Text style={styles.transcriptPlaceholder}>
                      {assistantStatus === 'listening' || assistantStatus === 'speaking' 
                        ? 'Speech will appear here in real-time...'
                        : userProfile
                          ? `Start a voice call to chat with the voice assistant of ${userProfile.schoolName}. You can ask about your assignments, grades, or navigate the portal using your voice.`
                          : 'Start a voice call to chat with the smart assistant. Gemini will answer you back out loud in real-time.'}
                    </Text>
                  )}
                </ScrollView>
              </View>
            </View>

            {/* Quick action info */}
            <View style={styles.voiceFooter}>
              <Text style={styles.voiceFooterText}>
                Powered by Gemini 2.0 Flash Multimodal Live API
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Settings Modal */}
      <Modal
        visible={settingsVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSettingsVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalBg}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>App Settings</Text>
              <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                <Feather name="x" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Tenant context display */}
              {userProfile && (
                <View style={styles.settingGroup}>
                  <Text style={styles.settingLabel}>Logged-In School Context</Text>
                  <View style={{ backgroundColor: '#f1f5f9', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0f172a' }}>{userProfile.schoolName}</Text>
                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontStyle: 'italic' }}>"{userProfile.schoolMotto}"</Text>
                    <View style={{ height: 1, backgroundColor: '#e2e8f0', marginVertical: 8 }} />
                    <Text style={{ fontSize: 12, color: '#475569' }}>User: <Text style={{ fontWeight: 'bold' }}>{userProfile.name}</Text></Text>
                    <Text style={{ fontSize: 12, color: '#475569' }}>Role: <Text style={{ fontWeight: 'bold' }}>{userProfile.role ? userProfile.role.toUpperCase() : ''}</Text></Text>
                  </View>
                </View>
              )}

              {/* Portal URL Settings */}
              <View style={styles.settingGroup}>
                <Text style={styles.settingLabel}>School Portal URL</Text>
                <TextInput
                  value={portalUrl}
                  onChangeText={setPortalUrl}
                  placeholder="https://..."
                  style={styles.settingInput}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <View style={styles.settingActions}>
                  <TouchableOpacity
                    onPress={() => setPortalUrl(config.defaultPortalUrl)}
                    style={styles.resetBtn}
                  >
                    <Text style={styles.resetBtnText}>Reset to Default</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setPortalUrl('http://10.0.2.2:5173')}
                    style={styles.resetBtn}
                  >
                    <Text style={styles.resetBtnText}>Android Emulator Localhost</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Gemini API Key */}
              <View style={styles.settingGroup}>
                <Text style={styles.settingLabel}>Gemini API Key</Text>
                <TextInput
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder="Enter Gemini API Key"
                  secureTextEntry={true}
                  style={styles.settingInput}
                  autoCapitalize="none"
                />
                <Text style={styles.settingDesc}>
                  Provide your Gemini API Key from Google AI Studio. Note: Live API requires v1alpha preview models.
                </Text>
              </View>

              {/* Gemini Model */}
              <View style={styles.settingGroup}>
                <Text style={styles.settingLabel}>Gemini Model</Text>
                <TextInput
                  value={model}
                  onChangeText={setModel}
                  placeholder="models/gemini-2.0-flash-exp"
                  style={styles.settingInput}
                  autoCapitalize="none"
                />
              </View>

              {/* Gemini Live Endpoint */}
              <View style={styles.settingGroup}>
                <Text style={styles.settingLabel}>Live API Endpoint (WSS)</Text>
                <TextInput
                  value={hostUrl}
                  onChangeText={setHostUrl}
                  placeholder="wss://..."
                  style={styles.settingInput}
                  autoCapitalize="none"
                />
              </View>

              {/* Mic Permission status */}
              <View style={styles.settingGroup}>
                <Text style={styles.settingLabel}>Microphone Permission</Text>
                <View style={styles.permissionStatusContainer}>
                  <Text style={styles.permissionStatusText}>
                    Status: {micPermissionGranted === true ? 'Granted' : micPermissionGranted === false ? 'Denied' : 'Checking...'}
                  </Text>
                  {micPermissionGranted !== true && (
                    <TouchableOpacity onPress={requestPermissions} style={styles.grantBtn}>
                      <Text style={styles.grantBtnText}>Grant Access</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity 
              onPress={() => setSettingsVisible(false)} 
              style={styles.saveBtn}
            >
              <Text style={styles.saveBtnText}>Save & Close</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bottom Tab Navigator */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => {
            // Stop voice session if switching away
            if (activeTab === 'assistant' && assistantStatus !== 'disconnected') {
              toggleVoiceSession();
            }
            setActiveTab('portal');
          }}
          style={[styles.tabItem, activeTab === 'portal' && styles.activeTabItem]}
        >
          <Feather name="grid" size={20} color={activeTab === 'portal' ? '#0284c7' : '#64748b'} />
          <Text style={[styles.tabLabel, activeTab === 'portal' && styles.activeTabLabel]}>School Portal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('assistant')}
          style={[styles.tabItem, activeTab === 'assistant' && styles.activeTabItem]}
        >
          <Feather name="mic" size={20} color={activeTab === 'assistant' ? '#38bdf8' : '#64748b'} />
          <Text style={[styles.tabLabel, activeTab === 'assistant' && styles.activeTabLabel]}>Voice AI</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
  },
  
  // School Portal Styles
  portalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  portalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  portalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    flex: 1,
  },
  portalControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },

  // Voice Assistant Styles
  assistantContainer: {
    flex: 1,
    backgroundColor: '#0f172a', // Dark theme for voice screen
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  assistantTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  assistantSettingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  orbOuterContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 40,
  },
  orbGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  orbMain: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 30,
    textAlign: 'center',
  },
  statusListening: {
    color: '#38bdf8',
  },
  statusSpeaking: {
    color: '#34d399',
  },
  statusError: {
    color: '#f87171',
  },
  transcriptContainer: {
    width: '100%',
    flex: 1,
    maxHeight: 180,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    marginBottom: 20,
  },
  transcriptContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  transcriptPlaceholder: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  transcript: {
    color: '#cbd5e1',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  voiceFooter: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  voiceFooterText: {
    color: '#475569',
    fontSize: 11,
  },

  // Tab Bar Styles
  tabBar: {
    flexDirection: 'row',
    height: 64,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  activeTabItem: {
    backgroundColor: '#f8fafc',
  },
  tabLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  activeTabLabel: {
    color: '#0f172a',
    fontWeight: 'bold',
  },

  // Modal Settings Styles
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: height * 0.85,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalBody: {
    marginBottom: 20,
  },
  settingGroup: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 8,
  },
  settingInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  settingActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  resetBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
  },
  resetBtnText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  settingDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 6,
    lineHeight: 16,
  },
  permissionStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 10,
  },
  permissionStatusText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  grantBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#0284c7',
    borderRadius: 6,
  },
  grantBtnText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  saveBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
