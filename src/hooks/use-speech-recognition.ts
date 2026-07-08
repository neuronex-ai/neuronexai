import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence?: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

interface SpeechRecognitionConstructorLike {
  new (): SpeechRecognitionLike;
}

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructorLike;
  webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
};

interface UseSpeechRecognitionProps {
  onResult?: (text: string) => void;
  onInterimResult?: (text: string) => void;
  onError?: (error: string) => void;
  lang?: string;
  continuous?: boolean;
}

const browserSpeechServiceErrors = new Set([
  'network',
  'service-not-allowed',
  'language-not-supported',
]);

const detectBrowserSupport = () => {
  if (typeof window === 'undefined') return false;
  const speechWindow = window as SpeechWindow;
  return Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition);
};

export const useSpeechRecognition = ({
  onResult,
  onInterimResult,
  onError,
  lang = 'pt-BR',
  continuous = true,
}: UseSpeechRecognitionProps = {}) => {
  const [isSupported, setIsSupported] = useState(detectBrowserSupport);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastError, setLastError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const intentionalStopRef = useRef(false);
  const shouldRestartRef = useRef(false);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  const stopListening = useCallback(() => {
    intentionalStopRef.current = true;
    shouldRestartRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!Recognition || !isSupported) {
      setIsSupported(false);
      setLastError('unsupported');
      onError?.('unsupported');
      return;
    }

    if (recognitionRef.current && isListening) return;

    try {
      intentionalStopRef.current = false;
      shouldRestartRef.current = continuous;
      setLastError(null);

      const recognition = new Recognition();
      recognitionRef.current = recognition;
      recognition.continuous = continuous;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onstart = () => setIsListening(true);

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let interim = '';
        let finalText = '';

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const text = result[0]?.transcript?.trim();
          if (!text) continue;
          if (result.isFinal) finalText = `${finalText} ${text}`.trim();
          else interim = `${interim} ${text}`.trim();
        }

        setInterimTranscript(interim);
        if (interim) onInterimResult?.(interim);

        if (finalText) {
          setTranscript((previous) => `${previous} ${finalText}`.trim());
          setInterimTranscript('');
          onResult?.(finalText);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        if (browserSpeechServiceErrors.has(event.error)) {
          shouldRestartRef.current = false;
          recognitionRef.current = null;
          setIsListening(false);
          setInterimTranscript('');
          setIsSupported(false);
          setLastError('unsupported');
          onError?.('unsupported');
          return;
        }

        setLastError(event.error);
        onError?.(event.error);

        if (event.error === 'not-allowed') {
          shouldRestartRef.current = false;
          setIsListening(false);
          toast.error('Permissão de microfone negada.');
        }

        if (event.error === 'audio-capture') {
          shouldRestartRef.current = false;
          setIsListening(false);
          toast.error('Nenhum microfone disponível para a transcrição.');
        }
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        if (!intentionalStopRef.current && shouldRestartRef.current && isSupported) {
          window.setTimeout(() => {
            try {
              startListening();
            } catch {
              setIsListening(false);
            }
          }, 250);
        } else {
          setIsListening(false);
        }
      };

      recognition.start();
    } catch (error) {
      console.error('[SpeechRecognition] Falha ao iniciar.', error);
      recognitionRef.current = null;
      setIsListening(false);

      if (error instanceof DOMException && error.name === 'InvalidStateError') {
        setLastError('aborted');
        onError?.('aborted');
        return;
      }

      setIsSupported(false);
      setLastError('unsupported');
      onError?.('unsupported');
    }
  }, [continuous, isListening, isSupported, lang, onError, onInterimResult, onResult]);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  useEffect(() => () => {
    intentionalStopRef.current = true;
    shouldRestartRef.current = false;
    recognitionRef.current?.abort?.();
    recognitionRef.current?.stop();
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    lastError,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
  };
};
