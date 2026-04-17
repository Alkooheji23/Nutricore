import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, X, AlertCircle, Flashlight, FlashlightOff, ScanLine } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [isStarting, setIsStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef(false);
  const isMountedRef = useRef(true);

  const toggleTorch = useCallback(async () => {
    if (!scannerRef.current || !isRunningRef.current || !torchSupported) return;
    
    try {
      const newState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: newState } as MediaTrackConstraintSet]
      });
      setTorchOn(newState);
    } catch (err) {
      console.error("Failed to toggle torch:", err);
      setTorchSupported(false);
    }
  }, [torchOn, torchSupported]);

  useEffect(() => {
    isMountedRef.current = true;
    
    const startScanner = async () => {
      try {
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
        ];
        
        const html5QrCode = new Html5Qrcode("barcode-reader", { 
          formatsToSupport,
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 100 },
            aspectRatio: 1.0,
            disableFlip: false,
          },
          (decodedText) => {
            isRunningRef.current = false;
            html5QrCode.stop().catch(() => {});
            onScan(decodedText);
          },
          () => {}
        );

        if (!isMountedRef.current) {
          html5QrCode.stop().catch(() => {});
          return;
        }
        
        isRunningRef.current = true;
        setIsStarting(false);

        try {
          const capabilities = html5QrCode.getRunningTrackCapabilities() as MediaTrackCapabilities & { torch?: boolean };
          if (capabilities && capabilities.torch === true) {
            setTorchSupported(true);
          } else {
            setTorchSupported(false);
          }
        } catch {
          setTorchSupported(false);
        }
      } catch (err: unknown) {
        console.error("Scanner error:", err);
        if (!isMountedRef.current) return;
        
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes("Permission")) {
          setError("Camera permission denied. Please allow camera access.");
        } else if (errorMessage.includes("NotFound") || errorMessage.includes("not found")) {
          setError("No camera found on this device");
        } else if (errorMessage.includes("NotAllowed")) {
          setError("Camera access denied. Please enable camera permissions.");
        } else {
          setError("Failed to start camera. Please try again.");
        }
        setIsStarting(false);
      }
    };

    startScanner();

    return () => {
      isMountedRef.current = false;
      if (scannerRef.current && isRunningRef.current) {
        isRunningRef.current = false;
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan]);

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium">Scan Barcode</span>
        </div>
        <div className="flex items-center gap-1">
          {torchSupported && !isStarting && !error && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTorch}
              className="h-8 w-8"
              data-testid="button-toggle-torch"
            >
              {torchOn ? (
                <Flashlight className="w-4 h-4 text-yellow-400" />
              ) : (
                <FlashlightOff className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
            data-testid="button-close-scanner"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="relative">
        <div
          id="barcode-reader"
          className="w-full rounded-lg overflow-hidden bg-black"
          style={{ minHeight: "280px" }}
        />
        
        {!isStarting && !error && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-4/5 h-24 border-2 border-primary/60 rounded-lg">
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
              <div className="absolute inset-0 flex items-center justify-center">
                <ScanLine className="w-6 h-6 text-primary animate-pulse" />
              </div>
            </div>
          </div>
        )}
      </div>

      {isStarting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
          <div className="text-center text-white">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p className="text-sm">Starting camera...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg">
          <div className="text-center text-white p-4">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm mb-3">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-white border-white/30"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Scanning...
        </div>
        <div className="text-center space-y-0.5">
          <p className="text-xs text-muted-foreground">
            Hold barcode flat and steady inside the frame
          </p>
          <p className="text-[10px] text-muted-foreground/70">
            Ensure good lighting • Avoid glare • Keep barcode straight
          </p>
        </div>
      </div>
    </div>
  );
}
