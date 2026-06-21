import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, RefreshCw, AlertCircle, ShoppingBag, Eye, Zap, Check, Sparkles } from 'lucide-react';
import { Product } from '../types';

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
  productsToScan?: Product[]; // Optional, for simulated backup list
  placeholderText?: string;
  autoClose?: boolean;
}

export function BarcodeScanner({
  onDetected,
  onClose,
  productsToScan = [],
  placeholderText = "Arahkan barcode produk ke kamera...",
  autoClose = false
}: BarcodeScannerProps) {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [showSimulator, setShowSimulator] = useState<boolean>(true);
  
  const scannerContainerId = 'barcode-reader-container';
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Play standard satisfying retail POS scanner beep via Web Audio API
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime); // clean high pitch beep
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime); // subtle volume

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1); // 100ms duration
    } catch (e) {
      console.warn('Audio play beep failed:', e);
    }
  };

  // Handle successful decode
  const handleSuccess = (decodedText: string) => {
    playBeep();
    setLastScannedCode(decodedText);
    
    // Check if matched in inventory
    const matched = productsToScan.find(p => p.barcode === decodedText);
    if (matched) {
      setScannedProduct(matched);
    } else {
      setScannedProduct(null);
    }

    onDetected(decodedText);

    // Clear overlay notice after timeout
    setTimeout(() => {
      setLastScannedCode(null);
      setScannedProduct(null);
    }, 2200);

    if (autoClose) {
      onClose();
    }
  };

  // Start scanning
  const startScanning = async (deviceId: string) => {
    try {
      setErrorMessage(null);
      
      // Stop existing if any
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }

      const html5QrCode = new Html5Qrcode(scannerContainerId);
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        deviceId ? deviceId : { facingMode: "environment" },
        {
          fps: 15,
          qrbox: (width, height) => {
            // Rectangular box suitable for standard 1D barcodes
            const boxWidth = Math.min(width * 0.8, 280);
            const boxHeight = Math.min(height * 0.4, 140);
            return {
              width: boxWidth,
              height: boxHeight
            };
          },
          aspectRatio: 1.777778 // 16:9
        },
        (decodedText) => {
          handleSuccess(decodedText);
        },
        (errorMessage) => {
          // Verbose, ignore frame failures
        }
      );

      setCameraActive(true);
    } catch (err: any) {
      console.error("Gagal menjalankan kamera scanner:", err);
      setErrorMessage(
        err.message || 
        "Gagal mengakses kamera. Silakan pastikan izin kamera diaktifkan & tidak digunakan aplikasi lain."
      );
      setCameraActive(false);
    }
  };

  // Stop scanning
  const stopScanning = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
    } catch (err) {
      console.error("Gagal menghentikan scanner kamera:", err);
    } finally {
      setCameraActive(false);
    }
  };

  // Switch camera source
  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedCameraId(id);
    if (cameraActive) {
      startScanning(id);
    }
  };

  // Initialize and list camera hardware sources
  useEffect(() => {
    let mounted = true;

    async function initCameras() {
      try {
        // Enumerate devices. Need active check permission first
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        
        if (mounted) {
          setCameras(videoDevices);
          if (videoDevices.length > 0) {
            // Find rear camera ideally
            const rearCamera = videoDevices.find(d => 
              d.label.toLowerCase().includes('back') || 
              d.label.toLowerCase().includes('rear') || 
              d.label.toLowerCase().includes('environment')
            );
            const chosenId = rearCamera ? rearCamera.deviceId : videoDevices[0].deviceId;
            setSelectedCameraId(chosenId);
            startScanning(chosenId);
          } else {
            // No physical camera found, default to simulator list
            setErrorMessage("Kamera fisik tidak ditemukan. Membuka mode simulator otomatis.");
            setShowSimulator(true);
          }
        }
      } catch (err: any) {
        console.warn("Kamera error on list. Requesting standard permission popup:", err);
        // Fallback standard start without explicit device listing first
        if (mounted) {
          startScanning('');
        }
      }
    }

    // Delay slightly to let target DOM render completely
    const startTimeout = setTimeout(() => {
      initCameras();
    }, 150);

    return () => {
      mounted = false;
      clearTimeout(startTimeout);
      // Clean up scanning interface synchronously or asynchronously
      if (html5QrCodeRef.current) {
        const qrCodeInstance = html5QrCodeRef.current;
        if (qrCodeInstance.isScanning) {
          qrCodeInstance.stop().catch(e => console.warn('Clean up error ignored:', e));
        }
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md z-60 flex items-center justify-center p-4" id="barcode-scanner-overlay">
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-lg w-full border border-slate-200 flex flex-col max-h-[90vh] animate-fade-in">
        
        {/* Header bar */}
        <div className="bg-slate-800 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
              <Camera className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm uppercase tracking-wider">Pemindai Barcode Kamera</h3>
              <p className="text-[10px] text-slate-350">Arahkan barcode 1D / QR Code produk ke kamera</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => {
              stopScanning();
              onClose();
            }}
            className="p-1 px-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 hover:text-rose-400 cursor-pointer text-slate-300 transition-colors"
            title="Tutup"
            id="close-camera-scanner-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content area */}
        <div className="p-4 flex-grow overflow-y-auto space-y-4">
          
          {/* Active success beep overlay */}
          {lastScannedCode && (
            <div className="bg-emerald-500 border border-emerald-400 text-white rounded-lg p-3 text-center flex items-center justify-center gap-2 animate-bounce shadow-md">
              <div className="bg-white/20 p-1 rounded-full text-white">
                <Check className="w-4 h-4 text-white" />
              </div>
              <div className="text-left">
                <span className="text-[10px] uppercase font-bold block opacity-90">Pemindaian Berhasil (BEEP!)</span>
                <span className="text-xs font-mono font-extrabold tracking-wide">
                  {scannedProduct ? `${scannedProduct.name} (${lastScannedCode})` : lastScannedCode}
                </span>
              </div>
            </div>
          )}

          {/* Camera Dropdown selector if multiple exists */}
          {cameras.length > 1 && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs">
              <RefreshCw className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 animate-spin-slow" />
              <span className="font-bold text-slate-550 shrink-0 font-mono text-[10px] uppercase tracking-wider">Sumber Kamera:</span>
              <select
                value={selectedCameraId}
                onChange={handleCameraChange}
                className="flex-grow p-1 border border-slate-250 bg-white rounded font-sans text-xs focus:outline-none"
              >
                {cameras.map((cam, index) => (
                  <option key={cam.deviceId || index} value={cam.deviceId}>
                    {cam.label || `Kamera ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Real device camera feed container */}
          <div className="relative bg-slate-950 border-2 border-slate-800 rounded-xl overflow-hidden aspect-video shadow-inner max-w-full">
            <div id={scannerContainerId} className="w-full h-full [&>video]:object-cover" />
            
            {/* Holographic Aim Overlay */}
            {cameraActive && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                {/* Rectangular scanning frame */}
                <div className="w-[75%] h-[50%] border-2 border-dashed border-indigo-400 rounded-lg relative shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]">
                  {/* Glowing corners */}
                  <span className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-3 border-l-3 border-indigo-500 rounded-tl"></span>
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-3 border-r-3 border-indigo-500 rounded-tr"></span>
                  <span className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-3 border-l-3 border-indigo-500 rounded-bl"></span>
                  <span className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-3 border-r-3 border-indigo-500 rounded-br"></span>
                  
                  {/* Moving red optical laser indicator */}
                  <span className="absolute left-0 right-0 h-0.5 bg-rose-500/85 shadow-[0_0_8px_2px_rgba(239,68,68,0.7)] animate-scan-line"></span>
                </div>
                <div className="text-[10px] font-bold text-white uppercase tracking-widest mt-3 bg-slate-900/80 p-1.5 px-3 rounded-full flex items-center gap-1.5 backdrop-blur-xs font-mono">
                  <Zap className="w-3 h-3 text-amber-400 animate-pulse" />
                  Mencari Barcode...
                </div>
              </div>
            )}

            {/* Error alerts overlay */}
            {errorMessage && (
              <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-center p-6 space-y-3 z-10 animate-fade-in">
                <AlertCircle className="w-12 h-12 text-rose-550 animate-bounce" />
                <h4 className="text-slate-100 font-bold text-sm uppercase">Kamera Terhambat</h4>
                <p className="text-xs text-slate-400 max-w-sm line-clamp-3">{errorMessage}</p>
                <div className="flex gap-2.5">
                  <button 
                    type="button"
                    onClick={() => startScanning(selectedCameraId)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all cursor-pointer"
                  >
                    Coba Hubungkan Lagi
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowSimulator(true)}
                    className="bg-slate-800 text-slate-300 font-bold text-xs px-3.5 py-1.5 rounded-lg hover:bg-slate-705 border border-slate-700 cursor-pointer"
                  >
                    Buka Simulator Saja
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className="text-slate-400 text-center text-[10.5px] italic">
            {placeholderText}
          </p>

          {/* Quick Mock/Simulator Scan Fallback (Essential for Iframe testing or devices without webcams) */}
          <div className="border border-indigo-100 bg-indigo-50/50 rounded-xl p-3.5 space-y-20">
            <div className="flex items-center justify-between" id="simulator-header-bar">
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin-slow" />
                Dermaga Simulator Scan Cepat
              </span>
              <button 
                type="button"
                onClick={() => setShowSimulator(!showSimulator)}
                className="text-[10px] text-indigo-700 bg-white border border-indigo-200 font-bold px-2.5 py-1 rounded-lg hover:bg-indigo-100 cursor-pointer transition-all uppercase tracking-wide"
              >
                {showSimulator ? 'Sembunyikan' : 'Buka Panel'}
              </button>
            </div>

            {showSimulator && (
              <div className="grid grid-cols-2 gap-2 mt-2 animate-fade-in" id="simulation-pills-list">
                {productsToScan.length === 0 ? (
                  <p className="text-[10px] text-slate-400 col-span-2 text-center py-2">Tidak tersedia daftar produk untuk simulasi.</p>
                ) : (
                  productsToScan.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleSuccess(product.barcode)}
                      className="flex items-center justify-between p-2 rounded-lg bg-white hover:bg-indigo-100/40 border border-slate-200 transition-all text-left hover:border-indigo-300 cursor-pointer shadow-2xs group"
                    >
                      <div className="space-y-0.5 max-w-[80%]">
                        <span className="text-slate-800 text-xs font-bold block line-clamp-1 group-hover:text-indigo-900">
                          {product.name}
                        </span>
                        <span className="text-[9.5px] font-mono font-bold text-slate-400 uppercase tracking-widest block bg-slate-100 p-0.5 px-1.5 rounded w-max">
                          {product.barcode}
                        </span>
                      </div>
                      <div className="p-1 rounded bg-indigo-50 text-indigo-650 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                        <Eye className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer controls */}
        <div className="bg-slate-50 border-t border-slate-200 p-3.5 flex justify-between items-center text-[10px] text-slate-400 font-mono">
          <span>STATUS: REALTIME & INTERAKTIF</span>
          <button
            type="button"
            onClick={() => {
              stopScanning();
              onClose();
            }}
            className="p-1.5 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
          >
            Selesai Scanner
          </button>
        </div>
      </div>
    </div>
  );
}
