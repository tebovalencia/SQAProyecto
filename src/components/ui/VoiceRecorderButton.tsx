import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import {
  blobToAudioFile,
  formatRecordingTime,
  isBrowserRecordingSupported,
  pickRecorderMimeType,
} from '@/lib/audioRecorder'
import { Button } from '@/components/ui/Button'

/** Intervalo de chunks: en móvil, sin timeslice el blob suele quedar vacío al detener. */
const TIMESLICE_MS = 1000

export function VoiceRecorderButton({
  disabled,
  onRecorded,
}: {
  disabled?: boolean
  onRecorded: (file: File) => void
}) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const mimeRef = useRef<string>('audio/webm')
  const startingRef = useRef(false)

  function clearTimer() {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => {
    return () => {
      clearTimer()
      if (mediaRecorderRef.current?.state === 'recording') {
        try {
          mediaRecorderRef.current.stop()
        } catch {
          /* ignore */
        }
      }
      stopStream()
    }
  }, [])

  async function startRecording() {
    setError('')
    if (startingRef.current || recording) return
    if (!isBrowserRecordingSupported()) {
      setError('Este navegador no permite grabar audio.')
      return
    }
    startingRef.current = true
    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      streamRef.current = stream

      const preferred = pickRecorderMimeType()
      let recorder: MediaRecorder
      try {
        recorder = preferred
          ? new MediaRecorder(stream, { mimeType: preferred })
          : new MediaRecorder(stream)
      } catch {
        recorder = new MediaRecorder(stream)
      }

      mimeRef.current = recorder.mimeType || preferred || 'audio/webm'
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const parts = chunksRef.current
        chunksRef.current = []
        stopStream()
        clearTimer()
        setRecording(false)
        setSeconds(0)
        mediaRecorderRef.current = null

        const blob = new Blob(parts, { type: mimeRef.current })
        if (blob.size < 256) {
          setError('La grabación quedó vacía. Mantén pulsado unos segundos y vuelve a detener.')
          return
        }
        try {
          onRecorded(blobToAudioFile(blob, mimeRef.current))
        } catch {
          setError('No se pudo preparar el archivo de audio.')
        }
      }

      recorder.onerror = () => {
        setError('Error al grabar. Intenta de nuevo.')
        clearTimer()
        stopStream()
        setRecording(false)
        setSeconds(0)
        mediaRecorderRef.current = null
      }

      mediaRecorderRef.current = recorder
      // timeslice evita blobs vacíos en Safari iOS / Chrome Android
      try {
        recorder.start(TIMESLICE_MS)
      } catch {
        recorder.start()
      }
      setRecording(true)
      setSeconds(0)
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => s + 1)
      }, 1000)
    } catch {
      stopStream()
      setError('No se pudo acceder al micrófono. Revisa los permisos del navegador.')
    } finally {
      startingRef.current = false
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state === 'recording') {
      try {
        // Fuerza un último chunk antes de stop (importante en algunos móviles).
        if (typeof recorder.requestData === 'function') recorder.requestData()
      } catch {
        /* ignore */
      }
      try {
        recorder.stop()
      } catch {
        clearTimer()
        stopStream()
        setRecording(false)
        setSeconds(0)
      }
      return
    }
    if (recorder && recorder.state === 'paused') {
      try {
        recorder.stop()
      } catch {
        /* ignore */
      }
      return
    }
    clearTimer()
    stopStream()
    setRecording(false)
    setSeconds(0)
  }

  if (!isBrowserRecordingSupported()) {
    return (
      <p className="text-xs text-amber-700">
        La grabación en vivo no está disponible en este navegador. Puedes subir un archivo de audio.
      </p>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {!recording ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Mic size={14} />}
            disabled={disabled}
            onClick={() => void startRecording()}
          >
            Grabar nota de voz
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="danger"
              size="sm"
              icon={<Square size={14} />}
              onClick={stopRecording}
            >
              Detener
            </Button>
            <span
              className="inline-flex items-center gap-2 text-xs font-semibold tabular-nums"
              style={{ color: 'var(--brand-danger)' }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full animate-pulse"
                style={{ background: 'var(--brand-danger)' }}
              />
              Grabando {formatRecordingTime(seconds)}
            </span>
          </>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
