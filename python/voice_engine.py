import sys
import os
import time
import threading
import queue
import argparse
import tempfile
import numpy as np
import sounddevice as sd
from scipy.io.wavfile import write
import whisper

# --- ARGUMENT PARSING ---
parser = argparse.ArgumentParser()
parser.add_argument("--threshold", type=float, default=0.01, help="Silence threshold volume")
parser.add_argument("--duration", type=float, default=3.0, help="Silence duration in seconds")
args = parser.parse_args()

# --- CONFIGURATION ---
FS = 44100            
SILENCE_THRESHOLD = args.threshold
SILENCE_DURATION = args.duration
TEMP_FILENAME = os.path.join(tempfile.gettempdir(), "kiro_voice_input.wav")

# Global Control Flags
audio_queue = queue.Queue()
is_recording = True
stop_reason = "manual"

# Force FFmpeg Path (Keep your fix here if needed)
# os.environ["PATH"] += os.pathsep + "/opt/homebrew/bin" 

def audio_callback(indata, frames, time, status):
    if status:
        sys.stderr.write(f"Audio Status: {status}\n")
    audio_queue.put(indata.copy())

def listen_for_stop_command():
    """Watch stdin for 'STOP' command from Kiro"""
    global is_recording
    while is_recording:
        try:
            line = sys.stdin.readline()
            if "STOP" in line:
                is_recording = False
                break
        except:
            break

def main():
    global is_recording, stop_reason

    # 1. Start Input Watcher
    threading.Thread(target=listen_for_stop_command, daemon=True).start()

    sys.stderr.write(f"Config: Threshold={SILENCE_THRESHOLD}, Duration={SILENCE_DURATION}s\n")
    sys.stderr.write("READY_TO_RECORD\n")
    sys.stderr.flush()

    all_audio = []
    last_sound_time = time.time()
    
    # 2. Start Recording Loop
    with sd.InputStream(samplerate=FS, channels=1, callback=audio_callback):
        while is_recording:
            while not audio_queue.empty():
                data = audio_queue.get()
                all_audio.append(data)
                
                # Check volume level
                volume = np.sqrt(np.mean(data**2))
                if volume > SILENCE_THRESHOLD:
                    last_sound_time = time.time()

            # Silence Check
            if time.time() - last_sound_time > SILENCE_DURATION and len(all_audio) > 50:
                sys.stderr.write("Silence detected. Stopping...\n")
                stop_reason = "silence"
                is_recording = False
            
            time.sleep(0.05)

    # 3. Process Audio
    sys.stderr.write("Processing...\n")
    if not all_audio:
        return

    full_recording = np.concatenate(all_audio, axis=0)
    write(TEMP_FILENAME, FS, full_recording)

    # 4. Transcribe
    try:
        model = whisper.load_model("base")
        result = model.transcribe(TEMP_FILENAME)
        text = result["text"].strip()
        
        # Output ONLY the text to STDOUT
        print(text)
        sys.stdout.flush()

    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}\n")
    finally:
        if os.path.exists(TEMP_FILENAME):
            os.remove(TEMP_FILENAME)

if __name__ == "__main__":
    main()
