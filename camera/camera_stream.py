from datetime import datetime
import json
import cv2
import threading
import os
import time
from PIL import Image

def generate_thumbnail(video_path, output_dir='media/thumbnails', thumbnail_count=1, quality=85):
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Open video file
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video file: {video_path}")
    
    # Get video properties
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    duration = total_frames / fps
    
    print(f"Video: {os.path.basename(video_path)}")
    print(f"Duration: {duration:.2f} seconds")
    print(f"Total frames: {total_frames}")
    
    # Calculate frame positions for thumbnails
    frame_positions = [int(total_frames * (i+1)/(thumbnail_count+1)) 
                      for i in range(thumbnail_count)]
    
    thumbnails = []
    for i, pos in enumerate(frame_positions):
        cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
        ret, frame = cap.read()
        
        if ret:
            # Convert BGR (OpenCV) to RGB (PIL)
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            img = Image.fromarray(frame_rgb)
            
            # Generate filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"thumbnail_{video_path.split('/')[-1].split('.')[0]}.jpg"
            output_path = os.path.join(output_dir, filename)
            
            # Save with specified quality
            img.save(output_path, quality=quality)
            thumbnails.append(output_path)
            print(f"Generated thumbnail: {output_path}")
    
    cap.release()
    return thumbnails

class CameraStream:
    def __init__(self, url, camera_id):
        self.url = url
        self.camera_id = int(camera_id)
        self.cap = None
        self.frame = None
        self.lock = threading.Lock()
        self.running = False
        self.recording = False
        self.out = None
        self.thread = None
        self.fps = 20
        self.frame_size = (640, 480)
        self.current_filename = None
        self.file_name = None
        self.codecs_to_try = ['MJPG', 'XVID', 'mp4v']  # Codecs à essayer dans cet ordre
        
        self._initialize_camera()
    
    def _initialize_camera(self):
        try:
            self.cap = cv2.VideoCapture(self.url)
            if not self.cap.isOpened():
                raise ConnectionError(f"Could not open camera stream at {self.url}")
            
            # Get actual frame size
            width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            if width > 0 and height > 0:
                self.frame_size = (width, height)
                
            self.start_stream()
        except Exception as e:
            print(f"Camera initialization error: {e}")
            self.stop()

    def start_stream(self):
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self._update, daemon=True)
            self.thread.start()
            print(f"Camera stream started for {self.url}")

    def _update(self):
        while self.running:
            try:
                ret, frame = self.cap.read()
                if not ret:
                    print("Error reading frame - stream may have ended")
                    time.sleep(1)
                    continue
                
                with self.lock:
                    self.frame = frame
                    
                    if self.recording and self.out:
                        try:
                            self.out.write(frame)
                        except Exception as e:
                            print(f"Error writing frame: {e}")
                            self._safe_stop_recording()
                if not self.recording:
                    self.start_recording()
            except Exception as e:
                print(f"Update error: {e}")
                time.sleep(1)

    def get_frame(self):
        with self.lock:
            if self.frame is not None:
                try:
                    ret, jpeg = cv2.imencode('.jpg', self.frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
                    if ret:
                        return jpeg.tobytes()
                except Exception as e:
                    print(f"Frame encoding error: {e}")
        return None

    def start_recording(self, output_dir=f"media/recordings"):
        if self.recording:
            return False
            
        os.makedirs(output_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.current_filename = os.path.join(output_dir, f"CAM_{self.camera_id}_{timestamp}.mp4")
        self.file_name = self.current_filename
        
        # Essayer différents codecs
        for codec in self.codecs_to_try:
            fourcc = cv2.VideoWriter_fourcc(*codec)
            self.out = cv2.VideoWriter(self.current_filename, fourcc, self.fps, self.frame_size)
            
            if self.out.isOpened():
                print(f"Recording started with codec {codec}: {self.current_filename}")
                self.recording = True
                return True
            else:
                print(f"Failed to initialize with codec {codec}")
                self.out = None
        
        print("All codecs failed")
        return False

    def _safe_stop_recording(self):
        """Stop recording and ensure file is properly closed"""
        if not self.recording:
            return
            
        self.recording = False
        try:
            if self.out:
                self.out.release()
                
            # Vérifier que le fichier est valide
            if self.current_filename and os.path.exists(self.current_filename):
                file_size = os.path.getsize(self.current_filename)
                if file_size < 1024:  # Fichier trop petit = corrompu
                    os.remove(self.current_filename)
                    print(f"Removed corrupted file: {self.current_filename}")
                else:
                    print(f"Recording saved: {self.current_filename} (Size: {file_size/1024:.2f} KB)")
                    
        except Exception as e:
            print(f"Error during recording stop: {e}")
        finally:
            self.out = None
            self.current_filename = None

    def stop(self):
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2)
        
        self._safe_stop_recording()
            
        if self.cap and self.cap.isOpened():
            self.cap.release()
            
        print("Camera stream stopped completely")

    def __del__(self):
        self.stop()

def reinitialize_camera_streams():
    """Reinitialize camera streams from the JSON configuration."""
    global camera_stream_
    try:
        with open('camera/cameras.json', 'r') as file:
            cameras = json.load(file)
            for k, v in cameras.items():
                camera_stream_.append(CameraStream(f"http://{v['ip']}:81/stream", camera_id=k))
    except Exception as e:
        print(f"Error reinitializing camera streams: {e}")

# Initialisation sécurisée
try:
    camera_stream_ = []
    with open('camera/cameras.json', 'r') as file:
        cameras = json.load(file)
        for k, v in cameras.items():
            #camera_stream_.append(CameraStream(f"http://{v['ip']}:81/stream", camera_id=k))
            camera_stream_.append(CameraStream(0, camera_id=k))
except Exception as e:
    print(f"Critical error initializing camera: {e}")
    camera_stream_ = []
