import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { ReactComponent as UploadIcon } from '../assets/upload.svg';
import { ReactComponent as CheckBox } from '../assets/checkbox.svg';
import { ReactComponent as UploadFile } from '../assets/uploadfile.svg';
import { ReactComponent as DropVideo } from '../assets/videodrop.svg';
import { io } from 'socket.io-client';

export default function UploadPage() {
  const navigate = useNavigate();

  const [toast, setToast] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);

  const socketRef = useRef(null);

  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMsg, setProcessingMsg] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileType, setUploadedFileType] = useState(null);

  const navigateToReport = useCallback((data) => {
    if (data?.type === 'audio' || uploadedFileType === 'audio') {
      navigate('/audio-report', { state: { reportData: data } });
    } else {
      navigate('/report', { state: { reportData: data } });
    }
  }, [navigate, uploadedFileType]);

  useEffect(() => {
    socketRef.current = io('http://localhost:4000');

    socketRef.current.on('processing-update', data => {
      setProcessingProgress(data.progress);
      setProcessingMsg(data.message);
    });

    socketRef.current.on('processing-complete', data => {
      setProcessingProgress(100);
      console.log(data);
      setProcessingMsg(data.message);
      setProcessing(false);
      navigateToReport(data.data);
    });

    socketRef.current.on('processing-error', data => {
      console.error('Processing error:', data);
      setProcessing(false);
      setUploading(false);
      showToast(data.error || 'Processing failed');
    });

    return () => socketRef.current.disconnect();
  }, [navigate, navigateToReport]);

  const showToast = message => {
    setToast(message);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
      setTimeout(() => setToast(null), 400);
    }, 3000);
  };

  const onDrop = useCallback(async (acceptedFiles, fileRejections) => {
    if (fileRejections.length) {
      showToast('Please upload a valid video (.mp4) or audio (.mp3, .wav) file.');
      return;
    }
    if (!acceptedFiles.length) return;

    const file = acceptedFiles[0];
    const formData = new FormData();
    const fileType = file.type;

    setUploading(true);
    setProcessing(false);
    setUploadProgress(0);
    setProcessingProgress(0);
    setProcessingMsg('');

    try {
      if (fileType.startsWith('video/')) {
        setUploadedFileType('video');
        formData.append('video', file);

        await axios.post('http://localhost:4000/api/analyze', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: evt => {
            const pct = Math.round((evt.loaded / evt.total) * 100);
            setUploadProgress(pct);
          }
        });
      } else if (fileType.startsWith('audio/')) {
        setUploadedFileType('audio');
        formData.append('audio', file);

        await axios.post('http://localhost:4000/api/analyze-audio', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: evt => {
            const pct = Math.round((evt.loaded / evt.total) * 100);
            setUploadProgress(pct);
          }
        });
      } else {
        throw new Error('Unsupported file type. Please upload .mp4, .mp3, or .wav files.');
      }

      setUploading(false);
      setProcessing(true);
      setProcessingProgress(0);
      setProcessingMsg('Starting analysis…');
    } catch (err) {
      console.error(err);
      let errorMessage = 'Upload failed';
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      showToast(errorMessage);
      setUploading(false);
      setUploadedFileType(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': ['.mp4'],
      'audio/mpeg': ['.mp3'],
      'audio/wav': ['.wav']
    },
    multiple: false,
    noClick: true,
    noKeyboard: true
  });

  const styles = {
    page: {
      padding: '1rem',
      backgroundColor: '#f9f9ff',
      position: 'relative',
      zIndex: 1
    },
    heading: {
      textAlign: 'center',
      fontSize: '2.5rem',
      marginBottom: '.5rem'
    },
    uploadBox: {
      boxSizing: 'border-box',
      width: '90%',
      minHeight: '300px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#5D2E8C',
      borderRadius: '1.5rem',
      margin: '0 auto 1rem',
      position: 'relative',
      boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
      outline: '2px dashed rgba(255,255,255,0.0)',
      outlineOffset: '-2px',
      zIndex: 2,
      transition: 'outline-color 0.2s ease'
    },
    innerBorder: {
      position: 'absolute',
      top: '12px',
      bottom: '12px',
      left: '12px',
      right: '12px',
      border: '2px dashed rgba(255,255,255,0.6)',
      borderRadius: '1.25rem',
      pointerEvents: 'none',
      transition: 'border-color 0.2s ease, border-style 0.2s ease'
    },
    dragOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '1.5rem',
      zIndex: 3,
      pointerEvents: 'none',
      color: 'white',
      textAlign: 'center'
    },
    progressOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '1.5rem',
      zIndex: 4,
      pointerEvents: 'none',
      color: 'white',
      textAlign: 'center'
    },
    progressMessage: {
      fontSize: '1.2rem',
      marginBottom: '1rem'
    },
    progressWrapper: {
      width: '80%',
      height: '1.2rem',
      backgroundColor: 'rgba(255,255,255,0.3)',
      borderRadius: '0.6rem',
      overflow: 'hidden'
    },
    progressBar: {
      height: '100%',
      borderRadius: '999px',
      backgroundImage: 'repeating-linear-gradient(135deg, #B288C0 0 20px, #ffffff 10px 30px)',
      backgroundSize: '40px 40px',
      backgroundPosition: '0 0',
      animation: 'candy 1s linear infinite',
      transition: 'width 1s ease-out',
    },
    progressPercent: {
      marginTop: '0.5rem',
      fontVariantNumeric: 'tabular-nums'
    },
    uploadContent: {
      position: 'relative',
      zIndex: 2,
      textAlign: 'center',
      justifyItems: 'center',
      color: 'white'
    },
    icon: { fill: '#f9f9ff' },
    uploadButton: {
      marginTop: '1rem',
      color: 'black',
      fontSize: '1.1rem',
      padding: '0.8rem 2rem',
      borderRadius: '1rem',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      transition: 'all 0.5s ease-in-out'
    },
    section: {
      display: 'flex',
      gap: '2rem',
      margin: '0 auto 3rem',
      marginLeft: '5%',
      position: 'relative',
      zIndex: 2
    },
    instructions: { flex: 1, fontSize: '1rem', lineHeight: '1.6' },
    checklist: { flex: 1, fontSize: '1rem' },
    checkItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      marginBottom: '1rem'
    },
    checkIcon: { color: '#5e2b97', fontSize: '1.2rem' },
    triangleBg: {
      position: 'fixed',
      top: '40%',
      right: 0,
      width: '100%',
      height: '60%',
      opacity: '10%',
      backgroundColor: '#B288C0',
      zIndex: 0,
      clipPath: 'polygon(70% 15%, 0% 100%, 85% 100%)',
      pointerEvents: 'none'
    },
    toast: {
      position: 'fixed',
      bottom: '2rem',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#5D2E8C',
      color: 'white',
      padding: '1rem 2rem',
      borderRadius: '1rem',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      zIndex: 999,
      fontSize: '1rem',
      animation: `${toastVisible ? 'fadeSlideIn' : 'fadeSlideOut'} 0.4s forwards`,
      pointerEvents: 'none'
    },
  };

  const activeProgress = uploading ? uploadProgress : processingProgress;
  const activeMessage = uploading
    ? `Uploading ${uploadedFileType === 'audio' ? 'audio file' : 'video'}…`
    : processingMsg;

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Analyse Yourself</h1>

      <div {...getRootProps()} style={styles.uploadBox}>
        <input {...getInputProps()} />
        <div style={styles.innerBorder} />

        {isDragActive && (
          <div style={styles.dragOverlay}>
            <DropVideo style={{ width: '5rem', height: '5rem', stroke: '#fff' }} />
            <p style={{ marginTop: '1rem', fontSize: '1.2rem' }}>
              Drop it like it's HOT
            </p>
          </div>
        )}

        {(uploading || processing) && (
          <div style={styles.progressOverlay}>
            <p style={styles.progressMessage}>{activeMessage}</p>
            <div style={styles.progressWrapper}>
              <div style={{ ...styles.progressBar, width: `${activeProgress}%` }} />
            </div>
            <p style={styles.progressPercent}>{activeProgress}%</p>
          </div>
        )}

        {!isDragActive && !uploading && !processing && (
          <div style={styles.uploadContent}>
            <div style={styles.icon}>
              <UploadIcon style={{ width: '8rem', height: '8rem', stroke: '#f9f9ff' }} />
            </div>
            <div>Drag and drop your video or audio file to upload</div>
            <button type="button" onClick={open} style={styles.uploadButton}>
              <UploadFile style={{ width: '1.5rem', height: '1.5rem', stroke: '#000' }} />
              Choose File
            </button>
          </div>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.instructions}>
          <h2>Instructions</h2>
          <p>
            Nervous about speaking in front of a crowd? Don't worry — we've got your
            back. Simply upload a short video or audio recording of yourself speaking.
            Our AI will analyze your delivery to provide insightful feedback.
            <br />
            <br />
            <strong>For Videos (.mp4):</strong>
            <br />
            &nbsp; &nbsp; &nbsp;Make sure your entire upper body is clearly visible
            <br />
            &nbsp; &nbsp; &nbsp;Record in a well-lit environment with minimal background clutter
            <br />
            <br />
            <strong>For Audio (.mp3, .wav):</strong>
            <br />
            &nbsp; &nbsp; &nbsp;Ensure clear recording quality for best speech analysis
            <br />
            &nbsp; &nbsp; &nbsp;Speak naturally as you would in a real presentation
            <br />
            <br />
            Once submitted, your results will appear with suggestions to help
            improve your delivery.
          </p>
        </div>

        <div style={styles.checklist}>
          <h2>Why use PresentPerfect?</h2>
          {[
            'Real-time posture analysis to correct body language issues like slouching',
            'Confidence feedback by detecting emotion, movement and stance',
            'AI-enhanced speech generation for audio uploads',
            'Practice smarter — get actionable insights instantly for real presentations'
          ].map((text, i) => (
            <div key={i} style={styles.checkItem}>
              <span style={styles.checkIcon}>
                <CheckBox style={{ width: '1.5rem', height: '1.5rem', fill: '#5D2E8C' }} />
              </span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.triangleBg} />

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}
