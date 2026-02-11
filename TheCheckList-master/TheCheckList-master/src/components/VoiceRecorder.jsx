import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, AlertCircle, Clock, Calendar, ListTodo, FileText } from 'lucide-react';
import { extractInformation } from '../lib/gemini';

export default function VoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [microphoneAvailable, setMicrophoneAvailable] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);

  // Test microphone access immediately on component load
  useEffect(() => {
    async function testMicrophoneAccess() {
      try {
        console.log('Testing microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone access granted', stream);
        setMicrophoneAvailable(true);
        
        // Stop the test stream immediately
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error('Microphone access test failed:', err);
        setMicrophoneAvailable(false);
        setError('Microphone access denied. Please make sure your microphone is connected and you have granted permission to use it.');
      }
    }
    
    testMicrophoneAccess();
    
    return () => {
      // Clean up on component unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (err) {
          console.error('Error closing audio context:', err);
        }
      }
    };
  }, []);

  // Add a utility function to handle repetition
  const removeRepeatedPhrases = (text) => {
    if (!text) return '';
    
    // Split text into words
    const words = text.split(/\s+/).filter(word => word.trim());
    if (words.length < 5) return text;
    
    // Look for repeated sequences
    const result = [];
    const seenPhrases = new Set();
    
    // Process words one by one
    for (let i = 0; i < words.length; i++) {
      // Check if this word starts a known repeating pattern
      let isRepeatedPattern = false;
      
      // Check for various pattern lengths (3-7 words)
      for (let len = 3; len <= 7 && i + len <= words.length; len++) {
        const phrase = words.slice(i, i + len).join(' ').toLowerCase();
        
        if (seenPhrases.has(phrase)) {
          isRepeatedPattern = true;
          break;
        }
        
        seenPhrases.add(phrase);
      }
      
      // Only add words that aren't part of a repeated pattern
      if (!isRepeatedPattern) {
        result.push(words[i]);
      }
    }
    
    return result.join(' ');
  };

  const initializeSpeechRecognition = () => {
    // Check for browser compatibility
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition is not supported in this browser. Please use Chrome.');
      return null;
    }

    // Use the standard SpeechRecognition interface if available, otherwise use the webkit prefix
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    // Configure recognition - balance between repetition prevention and continuous listening
    recognition.continuous = true; // Set back to true to enable continuous listening
    recognition.interimResults = true; // Enable interim results for more responsive UX
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 3; // Keep higher alternatives for better accuracy

    // New approach: use an array to store all recognized content
    recognition._allTranscripts = [];

    recognition.onstart = () => {
      console.log('Speech recognition started');
      setError(null);
    };

    recognition.onresult = (event) => {
      console.log('Speech recognition result received', event.results);
      
      // Completely new approach: build the full transcript each time
      let fullTranscript = '';
      
      // Get all final results
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          if (text) {
            // Store each result as we get it
            recognition._allTranscripts.push(text);
          }
        }
      }
      
      // Join all results we've collected
      fullTranscript = recognition._allTranscripts.join(' ');
      
      // Apply repetition removal to the full transcript
      const cleanedTranscript = removeRepeatedPhrases(fullTranscript);
      console.log('Setting cleaned transcript:', cleanedTranscript);
      
      // Update the transcript
      setTranscript(cleanedTranscript);
    };

    recognition.onerror = (event) => {
      console.log('Speech recognition error:', event.error, event);
      
      // Handle different error types
      if (event.error === 'no-speech') {
        console.log('No speech detected, continuing...');
        // Don't set an error for no-speech
        return;
      }
      
      if (event.error === 'network') {
        // For network errors, provide troubleshooting steps
        console.log('Network error in speech recognition');
        setError('Speech recognition network issue detected. This can happen even with a working internet connection. Try the following: 1) Refresh your browser 2) Try a different browser (Chrome works best) 3) Check if any browser extensions are blocking access.');
      } else if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access in your browser settings and try again.');
      } else if (event.error === 'aborted') {
        // This is normal when stopping, don't show an error
        console.log('Recognition aborted');
      } else if (event.error === 'audio-capture') {
        setError('Unable to capture audio from your microphone. Please check that your microphone is connected and working properly.');
      } else {
        setError(`Speech recognition error: ${event.error}. Try refreshing the page.`);
      }
      
      // Only stop recording for serious errors
      if (['not-allowed', 'audio-capture', 'service-not-allowed'].includes(event.error)) {
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      // Only try to restart if we're still in recording mode
      if (isRecording) {
        try {
          // Add a delay before restarting to help prevent repetition
          setTimeout(() => {
            if (isRecording) {
              recognition.start();
              console.log('Restarted speech recognition');
            }
          }, 300); // 300ms delay helps reduce repetition issues
        } catch (e) {
          console.log('Failed to restart recognition:', e);
          if (isRecording) {
            setError('Speech recognition stopped unexpectedly. Please try again.');
            setIsRecording(false);
          }
        }
      }
    };

    return recognition;
  };

  // Setup direct audio monitoring using Web Audio API
  const setupAudioMonitoring = (stream) => {
    try {
      console.log('Setting up audio monitoring with direct volume detection...');
      
      // Force cleanup of any existing audio context
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
          audioContextRef.current = null;
          analyserRef.current = null;
        } catch (err) {
          console.error('Error closing existing audio context:', err);
        }
      }
      
      // Create new audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Create script processor for direct volume detection
      const scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);
      const microphone = audioContext.createMediaStreamSource(stream);
      
      // Connect microphone to script processor and to destination
      microphone.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);
      
      // Process audio data directly
      scriptProcessor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        let sum = 0;
        
        // Calculate RMS (root mean square) volume
        for (let i = 0; i < input.length; i++) {
          sum += input[i] * input[i];
        }
        
        const rms = Math.sqrt(sum / input.length);
        // Scale to a reasonable range (0-100) and amplify for better visibility
        const volume = Math.min(100, Math.round(rms * 2000));
        
        console.log('Direct audio level:', volume);
        setAudioLevel(volume);
      };
      
      // Store reference for cleanup
      analyserRef.current = scriptProcessor;
      
      console.log('Direct audio monitoring setup complete');
    } catch (err) {
      console.error('Error setting up audio monitoring:', err);
    }
  };

  const startRecording = async () => {
    try {
      console.log('Starting recording...');
      setError(null);
      setResults(null);
      setTranscript('');
      setAudioLevel(0);
      chunksRef.current = [];

      // First check if microphone is available
      if (!microphoneAvailable) {
        try {
          // Try again to get microphone access
          await navigator.mediaDevices.getUserMedia({ audio: true });
          setMicrophoneAvailable(true);
        } catch (err) {
          console.error('Microphone access denied:', err);
          setError('Cannot access microphone. Please check your microphone connection and permissions.');
          return;
        }
      }

      // Clean up any existing streams
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Clean up any existing recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          // Reset the transcript array for the new recording
          if (recognitionRef.current._allTranscripts) {
            recognitionRef.current._allTranscripts = [];
          }
        } catch (e) {
          console.log('Error stopping existing recognition:', e);
        }
      }

      // Create a new recognition instance with clean state
      const recognition = initializeSpeechRecognition();
      if (!recognition) {
        throw new Error('Failed to initialize speech recognition');
      }
      recognitionRef.current = recognition;

      // Request microphone with specific constraints for maximum sensitivity
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false, // Try disabling echo cancellation
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000, // Higher sample rate for better quality
          sampleSize: 16
        } 
      });
      
      console.log('Microphone access granted', stream);
      streamRef.current = stream;
      
      // Setup audio level visualization
      setupAudioMonitoring(stream);
      
      // Create media recorder with high quality settings
      console.log('Creating media recorder...');
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 256000 // Higher bitrate for better quality
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      
      // Start speech recognition
      console.log('Starting speech recognition...');
      try {
        recognition.start();
        setIsRecording(true);
        console.log('Recording started successfully');
      } catch (e) {
        console.error('Error starting recognition:', e);
        setError('Failed to start speech recognition. Please try again or refresh the page.');
        setIsRecording(false);
        
        // Clean up on error
        mediaRecorder.stop();
        stream.getTracks().forEach(track => track.stop());
      }

    } catch (err) {
      console.error('Recording error:', err);
      setError(`Failed to start recording: ${err.message}. Please ensure your microphone is connected and working.`);
      setIsRecording(false);
    }
  };

  // Improved transcript cleaning function with better calendar event detection
  const cleanTranscript = (text) => {
    if (!text) return '';
    
    // First, clean up repetitions
    const phrases = text.split(/[.,!?;]\s+/);
    const uniquePhrases = [];
    
    phrases.forEach(phrase => {
      const trimmedPhrase = phrase.trim();
      if (trimmedPhrase) {
        const isDuplicate = uniquePhrases.some(existingPhrase => {
          const existingWords = new Set(existingPhrase.toLowerCase().split(/\s+/));
          const newWords = trimmedPhrase.toLowerCase().split(/\s+/);
          const matchingWords = newWords.filter(word => existingWords.has(word)).length;
          return matchingWords > 0 && (matchingWords / newWords.length > 0.8);
        });
        
        if (!isDuplicate) {
          uniquePhrases.push(trimmedPhrase);
        }
      }
    });
    
    // Join phrases and normalize spacing
    let cleanedText = uniquePhrases.join('. ').replace(/\s+/g, ' ').trim();
    
    // Make sure we end with a period if not already present
    if (cleanedText && !cleanedText.endsWith('.')) {
      cleanedText += '.';
    }
    
    return cleanedText;
  };

  const handleStopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('Stopping recording...');
      
      // Stop recording
      mediaRecorderRef.current.stop();
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      
      // Stop recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log('Error stopping recognition:', e);
        }
      }
      
      setIsRecording(false);
      
      // IMPORTANT FIX: Check for transcript first, regardless of audio level
      // If we have transcript text, we know speech was detected
      if (transcript.trim()) {
        console.log('Transcript detected, processing...');
        // Clean up the transcript to remove repetitions
        const cleanedTranscript = cleanTranscript(transcript);
        setTranscript(cleanedTranscript);
        
        // Process the transcript
        processTranscript(cleanedTranscript);
      }
      // Only check audio level if there's no transcript
      else if (audioLevel < 1) {
        console.log('No transcript and no audio detected');
        setError('No speech was detected. Please check that your microphone is working and not muted. Try speaking louder or getting closer to the microphone.');
      }
      else {
        console.log('Audio detected but no transcript');
        setError('Speech was detected but could not be transcribed. Please try again, speaking clearly and slowly.');
      }
    }
  };

  // Enhanced function to better detect calendar events and action items
  const enhanceCalendarEvents = (text) => {
    if (!text) return '';
    
    console.log('Enhancing text for calendar events detection:', text);
    
    // First format the text into clear sentences
    let enhanced = text.replace(/\s+/g, ' ').trim();
    if (!enhanced.endsWith('.')) {
      enhanced += '.';
    }
    
    // Add explicit calendar event markup to make it easier for Gemini to detect
    enhanced = 'CALENDAR ANALYSIS REQUEST. ' + enhanced;
    
    // Look for keywords that indicate calendar events
    const eventPhrases = [
      'meeting', 'appointment', 'call', 'conference', 'session', 'interview',  
      'tomorrow', 'today', 'next week', 'schedule', 'calendar', 'reminder'
    ];
    
    // Look for keywords that indicate action items
    const actionPhrases = [
      'need to', 'have to', 'must', 'should', 'will', 'going to', 
      'task', 'todo', 'to do', 'action item', 'follow up', 'deadline'
    ];
    
    // Check if any event phrases are in the text
    const hasEventKeywords = eventPhrases.some(phrase => 
      enhanced.toLowerCase().includes(phrase.toLowerCase())
    );
    
    // Check if any action phrases are in the text
    const hasActionKeywords = actionPhrases.some(phrase => 
      enhanced.toLowerCase().includes(phrase.toLowerCase())
    );
    
    // Add explicit hints for Gemini to understand the content
    if (hasEventKeywords) {
      enhanced += ' IMPORTANT: This text contains CALENDAR EVENT information that should be extracted.';
    }
    
    if (hasActionKeywords) {
      enhanced += ' IMPORTANT: This text contains ACTION ITEMS that should be extracted.';
    }
    
    // Add specific formatting for dates, times and people
    // Match dates like "tomorrow", "next Monday", "January 5th", etc.
    enhanced = enhanced.replace(/\b(tomorrow|today|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/gi, 'EVENT_DATE: $1');
    
    // Match months and dates
    enhanced = enhanced.replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?\b/gi, 'EVENT_DATE: $&');
    
    // Match common time formats
    enhanced = enhanced.replace(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/gi, 'EVENT_TIME: $1');
    
    // Match people names that might be participants (common names with capital letters)
    enhanced = enhanced.replace(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g, function(match) {
      // Check if it's likely a name (not at the start of a sentence)
      if (match.length > 2 && !/^(The|A|An|This|That|These|Those|It|We|I|You|He|She|They)$/.test(match)) {
        return 'PERSON: ' + match;
      }
      return match;
    });
    
    console.log('Enhanced text for detection:', enhanced);
    return enhanced;
  };

  const processTranscript = async (text = transcript) => {
    const textToProcess = text || transcript;
    if (!textToProcess.trim()) {
      setError('No speech detected. Please try recording again.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Add more structure to the text to help with extraction
      const formattedText = textToProcess
        .replace(/\bi\b/g, 'I')  // Fix capitalization
        .replace(/\s+/g, ' ')    // Normalize spaces
        .trim();
      
      // Create a more structured version that's easier for Gemini to parse
      const structuredText = `
Date: ${new Date().toLocaleDateString()}
Transcript: ${formattedText}

The transcript may contain:
1. Calendar events or meetings with dates, times, and participants
2. Action items or tasks with deadlines
3. Important meeting details and key points

IMPORTANT: Please extract meeting details (date, time, participants) from the transcript.

Please extract this information carefully.
`;
      
      // Pre-process text to highlight potential calendar events for better detection
      const enhancedText = enhanceCalendarEvents(structuredText);
      console.log('Processing transcript with enhanced calendar events:', enhancedText);
      
      const analysisResults = await extractInformation(enhancedText);
      
      // Check if we got results
      if (analysisResults) {
        console.log('Received analysis results:', analysisResults);
        
        // Process calendar events first, as we'll use them to ensure Meeting Details are consistent
        if (!analysisResults.calendarEvents || analysisResults.calendarEvents.length === 0) {
          console.log('No calendar events detected, checking for manual extraction');
          
          // Try manual extraction for common patterns
          const manualEvents = extractCalendarEventsManually(formattedText);
          if (manualEvents.length > 0) {
            analysisResults.calendarEvents = manualEvents;
            console.log('Manually extracted calendar events:', manualEvents);
          }
        }
        
        // Process meeting details - always extract manually first to ensure better results
        const meetingDetails = extractMeetingDetailsManually(formattedText);
        console.log('Manually extracted meeting details:', meetingDetails);
        
        // FIRST - use calendar events to ensure consistency
        if (analysisResults.calendarEvents && analysisResults.calendarEvents.length > 0) {
          const event = analysisResults.calendarEvents[0];
          
          // If calendar event has a date and our extracted meeting date is not specified, use the calendar event date
          if (event.date && meetingDetails.date === 'Not specified') {
            meetingDetails.date = event.date;
          }
          
          // If calendar event has a time and our extracted meeting time is not specified, use the calendar event time
          if (event.time && meetingDetails.time === 'Not specified') {
            meetingDetails.time = event.time;
          }
          
          console.log('Updated meeting details from calendar event:', meetingDetails);
        }
        
        // SECOND - prioritize our manual extraction but keep any existing data from Gemini
        analysisResults.meetingDetails = {
          date: meetingDetails.date !== 'Not specified' ? meetingDetails.date : analysisResults.meetingDetails?.date || 'Not specified',
          time: meetingDetails.time !== 'Not specified' ? meetingDetails.time : analysisResults.meetingDetails?.time || 'Not specified',
          participants: meetingDetails.participants[0] !== 'Unspecified participants' ? 
            meetingDetails.participants : 
            analysisResults.meetingDetails?.participants || ['Unspecified participants']
        };
        
        // Make sure we've tried everything to get the date and time
        // Final consistency check - if calendar events exist, ensure meeting details match
        if (analysisResults.calendarEvents && analysisResults.calendarEvents.length > 0) {
          const event = analysisResults.calendarEvents[0];
          
          // Final override - if we have a date in calendar events but not in meeting details, use the calendar event date
          if (event.date && (analysisResults.meetingDetails.date === 'Not specified' || 
                            !analysisResults.meetingDetails.date)) {
            analysisResults.meetingDetails.date = event.date;
          }
          
          // Final override - if we have a time in calendar events but not in meeting details, use the calendar event time
          if (event.time && (analysisResults.meetingDetails.time === 'Not specified' || 
                            !analysisResults.meetingDetails.time)) {
            analysisResults.meetingDetails.time = event.time;
          }
        }
        
        // Process action items
        if (!analysisResults.actionItems || analysisResults.actionItems.length === 0) {
          console.log('No action items detected, checking for manual extraction');
          
          // Try manual extraction for common action item patterns
          const manualActions = extractActionItemsManually(formattedText);
          if (manualActions.length > 0) {
            analysisResults.actionItems = manualActions;
            console.log('Manually extracted action items:', manualActions);
          }
        }
        
        setResults(analysisResults);
      } else {
        setError('Failed to analyze the transcript. Please try again.');
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Failed to analyze the transcript. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // New function to extract meeting details manually
  const extractMeetingDetailsManually = (text) => {
    // Default values
    const meetingDetails = {
      date: 'Not specified',
      time: 'Not specified',
      participants: ['Unspecified participants']
    };
    
    // Extract date with improved handling for "tomorrow"
    const tomorrowMatch = text.match(/\btomorrow\b/i);
    const todayMatch = text.match(/\btoday\b/i);
    const dayMatch = text.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    const dateMatch = text.match(/\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december))\b/i);
    
    if (tomorrowMatch) {
      // Calculate tomorrow's date in the same format as calendar events
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      // Format as M/D/YYYY to match calendar events section
      meetingDetails.date = `${tomorrow.getMonth() + 1}/${tomorrow.getDate()}/${tomorrow.getFullYear()}`;
    } else if (todayMatch) {
      // Format as M/D/YYYY to match calendar events section
      const today = new Date();
      meetingDetails.date = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
    } else if (dayMatch) {
      meetingDetails.date = dayMatch[1].charAt(0).toUpperCase() + dayMatch[1].slice(1);
    } else if (dateMatch) {
      meetingDetails.date = dateMatch[1];
    }
    
    // Extract time with improved pattern matching
    const timeMatch = text.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
    if (timeMatch) {
      meetingDetails.time = timeMatch[1];
    }
    
    // Extract participants
    const withMatch = text.match(/\bwith\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    const andMatch = text.match(/\band\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    
    const participants = [];
    
    if (withMatch) {
      participants.push(withMatch[1]);
    }
    
    if (andMatch) {
      participants.push(andMatch[1]);
    }
    
    // Look for any capitalized names (likely people)
    const nameMatches = text.match(/\b[A-Z][a-z]+\b/g);
    if (nameMatches) {
      // Filter out common words that start with capitals but aren't names
      const commonWords = ['I', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 
                         'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 
                         'September', 'October', 'November', 'December', 'The', 'A', 'An'];
      
      nameMatches.forEach(name => {
        if (!commonWords.includes(name) && !participants.includes(name)) {
          participants.push(name);
        }
      });
    }
    
    if (participants.length > 0) {
      meetingDetails.participants = participants;
    }
    
    return meetingDetails;
  };

  // Fallback function to extract calendar events manually if Gemini fails
  const extractCalendarEventsManually = (text) => {
    const events = [];
    
    // Check for meeting + tomorrow pattern
    const tomorrowMatch = text.match(/\b(meeting|appointment|call)\b.+?\btomorrow\b/i);
    if (tomorrowMatch) {
      // Look for time
      const timeMatch = text.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
      const time = timeMatch ? timeMatch[1] : 'Not specified';
      
      events.push({
        title: 'Meeting',
        date: 'Tomorrow',
        time: time
      });
    }
    
    // Check for specific days
    const dayMatch = text.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (dayMatch) {
      const timeMatch = text.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
      const time = timeMatch ? timeMatch[1] : 'Not specified';
      
      events.push({
        title: 'Meeting',
        date: dayMatch[1].charAt(0).toUpperCase() + dayMatch[1].slice(1),
        time: time
      });
    }
    
    return events;
  };

  // Fallback function to extract action items manually if Gemini fails
  const extractActionItemsManually = (text) => {
    const actions = [];
    
    // Look for "need to", "have to", etc. followed by a verb
    const needToMatches = text.match(/\b(need to|have to|must|should) ([a-z]+\s.+?)(?:\.|,|\band\b|$)/gi);
    if (needToMatches) {
      needToMatches.forEach(match => {
        actions.push({
          task: match.trim(),
          deadline: 'Not specified'
        });
      });
    }
    
    // Look for "bring" instructions
    const bringMatches = text.match(/\bbring\s.+?(?:\.|,|\band\b|$)/gi);
    if (bringMatches) {
      bringMatches.forEach(match => {
        actions.push({
          task: match.trim(),
          deadline: 'Not specified'
        });
      });
    }
    
    return actions;
  };

  // Updated audio level color function for more sensitivity
  const getAudioLevelColor = (level) => {
    if (level < 1) return 'bg-gray-400'; // No audio
    if (level < 3) return 'bg-yellow-400'; // Low audio
    if (level < 10) return 'bg-green-400'; // Good audio
    return 'bg-green-600'; // Strong audio
  };

  // Updated audio level message for more helpful feedback
  const getAudioLevelMessage = (level) => {
    if (level < 1) return 'No audio detected - please check your microphone';
    if (level < 3) return 'Low audio - please speak louder';
    if (level < 10) return 'Audio detected';
    return 'Good audio level';
  };

  if (!('webkitSpeechRecognition' in window)) {
    return (
      <div className="flex items-center justify-center p-6 bg-red-50 text-red-700 rounded-xl border border-red-200">
        <AlertCircle className="w-5 h-5 mr-2" />
        <p>Your browser doesn't support speech recognition. Please try a modern browser like Chrome.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {microphoneAvailable === false && (
        <div className="mb-8 p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200 flex items-center">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <div>
            <p className="font-medium">Microphone not available</p>
            <p className="text-sm">Please check that your microphone is connected and you have granted permission in your browser.</p>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center mb-12">
        <div className="relative">
          <button
            onClick={isRecording ? handleStopRecording : startRecording}
            className={`p-6 rounded-full shadow-lg ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                : 'bg-indigo-600 hover:bg-indigo-700'
            } text-white transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed`}
            disabled={isProcessing}
          >
            {isRecording ? <MicOff size={32} /> : <Mic size={32} />}
          </button>
          {isRecording && (
            <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-ping" />
          )}
        </div>
        <p className="mt-4 text-sm font-medium text-gray-600">
          {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
        </p>
        
        {isRecording && (
          <div className="mt-4 w-full max-w-xs">
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner">
              <div 
                className={`h-full transition-all duration-200 ${getAudioLevelColor(audioLevel)}`} 
                style={{ width: `${Math.min(100, audioLevel * 2)}%` }}
              ></div>
            </div>
            <div className="flex justify-between mt-1">
              <p className={`text-xs ${audioLevel < 1 ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                {getAudioLevelMessage(audioLevel)}
              </p>
              <p className="text-xs text-gray-500">
                Level: {Math.round(audioLevel)}
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center animate-fadeIn">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-xl p-6 mb-8 transform transition-all duration-300 hover:shadow-2xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <FileText className="w-5 h-5 mr-2 text-indigo-600" />
          Live Transcript
        </h2>
        <div className={`min-h-[100px] bg-gray-50 rounded-lg p-4 transition-all duration-300 ${
          isRecording ? 'border-2 border-indigo-500' : 'border border-gray-200'
        }`}>
          <p className="text-gray-700 whitespace-pre-wrap">
            {transcript || 'Start speaking to see the transcript...'}
          </p>
        </div>
      </div>

      {isProcessing && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin mr-2 text-indigo-600" size={24} />
          <span className="text-gray-700 font-medium">Processing your conversation...</span>
        </div>
      )}

      {results && (
        <div className="space-y-8 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl p-6 transform transition-all duration-300 hover:shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <ListTodo className="w-5 h-5 mr-2 text-indigo-600" />
              Action Items
            </h2>
            {results.actionItems.length > 0 ? (
              <ul className="space-y-3">
                {results.actionItems.map((item, index) => (
                  <li key={index} className="flex items-start p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.task}</p>
                      <p className="text-sm text-gray-600">Due: {item.deadline}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 italic">No action items detected</p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-xl p-6 transform transition-all duration-300 hover:shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-indigo-600" />
              Meeting Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Date</p>
                <p className="font-medium text-gray-900">{results.meetingDetails.date}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Time</p>
                <p className="font-medium text-gray-900">{results.meetingDetails.time}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Participants</p>
                <p className="font-medium text-gray-900">
                  {results.meetingDetails.participants.join(', ')}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-xl p-6 transform transition-all duration-300 hover:shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-indigo-600" />
              Key Points
            </h2>
            {results.keyPoints.length > 0 ? (
              <ul className="space-y-2">
                {results.keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-indigo-100 text-indigo-600 rounded-full mr-2">
                      {index + 1}
                    </span>
                    <p className="text-gray-700">{point}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 italic">No key points detected</p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-xl p-6 transform transition-all duration-300 hover:shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-indigo-600" />
              Calendar Events
            </h2>
            {results.calendarEvents.length > 0 ? (
              <ul className="space-y-3">
                {results.calendarEvents.map((event, index) => (
                  <li key={index} className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-900">{event.title}</p>
                    <p className="text-sm text-gray-600">
                      {event.date} at {event.time}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 italic">No calendar events detected</p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-xl p-6 transform transition-all duration-300 hover:shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-indigo-600" />
              Meeting Summary
            </h2>
            <p className="text-gray-700 whitespace-pre-wrap">{results.summary}</p>
          </div>
        </div>
      )}
    </div>
  );
}
