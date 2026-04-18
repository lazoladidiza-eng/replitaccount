import { useState, useRef, useCallback, useEffect } from "react";
import { UploadCloud, FileVideo, FileAudio, AlertCircle, CheckCircle2, Music, Shield, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SUPPORTED_EXTS, MAX_SIZE_MB, isVideo, convertToWav, extractSnippet } from "@/lib/audio";
import { useGetAcrStatus, useIdentifyAudioWindow, useListReplacementTracks } from "@workspace/api-client-react";

const STEP = { 
  IDLE: "idle", 
  CONVERTING: "converting", 
  LOADING: "loading", 
  READY: "ready", 
  SCANNING: "scanning", 
  DONE: "done", 
  ERROR: "error" 
};

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<"video" | "audio" | "">("");
  const [audioBuf, setAudioBuf] = useState<AudioBuffer | null>(null);
  const [duration, setDuration] = useState(0);
  const [step, setStep] = useState(STEP.IDLE);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const [curWin, setCurWin] = useState(0);
  const [totalWin, setTotalWin] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [dragOver, setDragOver] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: acrStatus } = useGetAcrStatus();
  const identifyMutation = useIdentifyAudioWindow();
  const { data: replacementTracks } = useListReplacementTracks();

  const reset = () => {
    setFile(null);
    setFileType("");
    setAudioBuf(null);
    setDuration(0);
    setStep(STEP.IDLE);
    setStatusMsg("");
    setErrorMsg("");
    setProgress(0);
    setCurWin(0);
    setTotalWin(0);
    setResults([]);
  };

  const processFile = useCallback(async (f: File) => {
    reset();
    setFile(f);

    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!SUPPORTED_EXTS.includes(ext)) {
      setErrorMsg(`Unsupported format. Supported: ${SUPPORTED_EXTS.join(", ")}`);
      setStep(STEP.ERROR);
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setErrorMsg(`File too large (${(f.size / 1024 / 1024).toFixed(0)}MB). Maximum is ${MAX_SIZE_MB}MB.`);
      setStep(STEP.ERROR);
      return;
    }

    const isVid = isVideo(f);
    setFileType(isVid ? "video" : "audio");

    let wavBlob: Blob;

    if (isVid) {
      setStep(STEP.CONVERTING);
      try {
        wavBlob = await convertToWav(f, (msg) => setStatusMsg(msg));
      } catch (e: any) {
        setErrorMsg(`Could not extract audio. Error: ${e.message}`);
        setStep(STEP.ERROR);
        return;
      }
    } else {
      setStep(STEP.LOADING);
      try {
        const ab = await f.arrayBuffer();
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const decoded = await ctx.decodeAudioData(ab);
        setAudioBuf(decoded);
        setDuration(decoded.duration);
        setStep(STEP.READY);
        return;
      } catch {
        // Fallback to ffmpeg
        setStep(STEP.CONVERTING);
        setStatusMsg("Converting audio format...");
        try {
          wavBlob = await convertToWav(f, (msg) => setStatusMsg(msg));
        } catch (e: any) {
          setErrorMsg(`Could not decode audio. Error: ${e.message}`);
          setStep(STEP.ERROR);
          return;
        }
      }
    }

    setStep(STEP.LOADING);
    setStatusMsg("Decoding audio...");
    try {
      const ab = await wavBlob.arrayBuffer();
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const decoded = await ctx.decodeAudioData(ab);
      setAudioBuf(decoded);
      setDuration(decoded.duration);
      setStep(STEP.READY);
    } catch (e) {
      setErrorMsg("Failed to decode the converted audio.");
      setStep(STEP.ERROR);
    }
  }, []);

  const startScan = async () => {
    if (!audioBuf) return;
    setStep(STEP.SCANNING);
    setResults([]);
    setProgress(0);

    const steps = Math.max(1, Math.ceil(duration / 30));
    setTotalWin(steps);
    const found: any[] = [];

    for (let i = 0; i < steps; i++) {
      setCurWin(i + 1);
      setProgress(Math.round((i / steps) * 100));
      
      const b64 = extractSnippet(audioBuf, i * 30, 10);
      if (!b64) continue;
      
      try {
        const data = await identifyMutation.mutateAsync({
          data: {
            sampleBase64: b64,
            windowIndex: i + 1,
            offsetSeconds: i * 30,
            durationSeconds: 10
          }
        });
        
        if (data.matched) {
          found.push(data);
        }
      } catch (e: any) {
        setErrorMsg(`Scan error on window ${i + 1}: ${e.message}`);
        setStep(STEP.ERROR);
        return;
      }
    }

    setProgress(100);
    setResults(found);
    setStep(STEP.DONE);
  };

  const risk = results.length === 0 ? "safe" : results.length <= 2 ? "medium" : "high";

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col items-center py-12 px-4 font-sans text-foreground">
      <div className="w-full max-w-2xl space-y-8">
        
        {/* Header */}
        <header className="flex items-center gap-4 pb-6 border-b border-border">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">ClipCleaner</h1>
            <p className="text-sm text-muted-foreground font-mono">Pre-flight Copyright Scanner</p>
          </div>
          {acrStatus && !acrStatus.configured && (
            <Badge variant="destructive" className="ml-auto bg-destructive/10 text-destructive border-destructive/20">
              API Not Configured
            </Badge>
          )}
        </header>

        {/* Status Alert */}
        {acrStatus && !acrStatus.configured && step === STEP.IDLE && (
          <Card className="p-4 border-destructive/30 bg-destructive/5 text-destructive-foreground text-sm flex gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">ACRCloud Not Configured</p>
              <p className="opacity-90">{acrStatus.message}</p>
              <p className="opacity-90 mt-1">You can still test the file extraction flow.</p>
            </div>
          </Card>
        )}

        {/* IDLE: Upload */}
        {step === STEP.IDLE && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { 
              e.preventDefault(); 
              setDragOver(false); 
              const f = e.dataTransfer.files[0]; 
              if (f) processFile(f); 
            }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-colors duration-200 ease-in-out flex flex-col items-center gap-4 ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-card/50"
            }`}
            data-testid="upload-zone"
          >
            <div className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center">
              <UploadCloud className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">Drop media file to scan</h3>
              <p className="text-sm text-muted-foreground mt-1">Video or Audio, up to {MAX_SIZE_MB}MB</p>
            </div>
            <input 
              ref={inputRef} 
              type="file" 
              accept="video/*,audio/*" 
              onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); }} 
              className="hidden" 
              data-testid="input-file"
            />
          </div>
        )}

        {/* PROCESSING STATES */}
        {(step === STEP.CONVERTING || step === STEP.LOADING) && (
          <Card className="p-12 text-center flex flex-col items-center gap-6 border-border bg-card">
            <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <div>
              <h3 className="text-lg font-medium text-white mb-2">
                {step === STEP.CONVERTING ? "Extracting Audio..." : "Decoding Audio..."}
              </h3>
              <p className="text-sm text-muted-foreground">{statusMsg}</p>
            </div>
          </Card>
        )}

        {/* ERROR */}
        {step === STEP.ERROR && (
          <Card className="p-8 border-destructive/30 bg-destructive/5 text-center flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-destructive mb-2">Processing Failed</h3>
              <p className="text-sm text-destructive-foreground/80 whitespace-pre-line">{errorMsg}</p>
            </div>
            <Button variant="outline" onClick={reset} data-testid="button-reset">
              Try Another File
            </Button>
          </Card>
        )}

        {/* READY TO SCAN */}
        {step === STEP.READY && (
          <Card className="p-6 border-border bg-card">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center">
                {fileType === "video" ? <FileVideo className="w-6 h-6 text-primary" /> : <FileAudio className="w-6 h-6 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white truncate">{file?.name}</h3>
                <div className="text-sm text-muted-foreground font-mono mt-1">
                  {formatTime(duration)} • {Math.ceil(duration / 30)} windows
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={reset} className="shrink-0" data-testid="button-cancel-ready">
                ✕
              </Button>
            </div>
            <Button onClick={startScan} className="w-full text-primary-foreground font-semibold h-12 text-base" data-testid="button-start-scan">
              <Play className="w-5 h-5 mr-2" /> Start Copyright Scan
            </Button>
          </Card>
        )}

        {/* SCANNING */}
        {step === STEP.SCANNING && (
          <Card className="p-8 border-border bg-card">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h3 className="font-medium text-white mb-1">Scanning for matches...</h3>
                <p className="text-sm text-muted-foreground font-mono">
                  Window {curWin} of {totalWin}
                </p>
              </div>
              <span className="text-2xl font-light font-mono text-primary">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-secondary" />
          </Card>
        )}

        {/* DONE / RESULTS */}
        {step === STEP.DONE && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Risk Card */}
            <Card className={`p-8 text-center border-2 ${
              risk === "safe" ? "bg-green-500/5 border-green-500/20" :
              risk === "medium" ? "bg-yellow-500/5 border-yellow-500/20" :
              "bg-red-500/5 border-red-500/20"
            }`}>
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                risk === "safe" ? "bg-green-500/20 text-green-500" :
                risk === "medium" ? "bg-yellow-500/20 text-yellow-500" :
                "bg-red-500/20 text-red-500"
              }`}>
                {risk === "safe" ? <CheckCircle2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${
                risk === "safe" ? "text-green-500" :
                risk === "medium" ? "text-yellow-500" :
                "text-red-500"
              }`}>
                {risk === "safe" ? "Clear for Upload" : risk === "medium" ? "Copyright Risks Found" : "High Copyright Risk"}
              </h2>
              <p className="text-muted-foreground">
                {results.length === 0 ? "No matches detected in ACRCloud database." : `Detected ${results.length} flagged section${results.length === 1 ? '' : 's'} in your audio.`}
              </p>
            </Card>

            {/* Matched Sections */}
            {results.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold tracking-wider text-muted-foreground uppercase">Flagged Matches</h3>
                {results.map((r, i) => (
                  <Card key={i} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-red-500 bg-card border-border">
                    <div>
                      <h4 className="font-medium text-white">{r.title || "Unknown Title"}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {r.artist || "Unknown Artist"} {r.album ? `• ${r.album}` : ""}
                      </p>
                      {r.label && <p className="text-xs text-muted-foreground mt-1 opacity-70">{r.label}</p>}
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 sm:gap-1">
                      <Badge variant="outline" className="font-mono bg-red-500/10 text-red-500 border-red-500/20">
                        {formatTime(r.offsetSeconds)} - {formatTime(r.offsetSeconds + r.durationSeconds)}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        Score: {r.score}%
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Replacements */}
            {results.length > 0 && replacementTracks && replacementTracks.length > 0 && (
              <div className="space-y-3 pt-4">
                <h3 className="text-sm font-bold tracking-wider text-muted-foreground uppercase">Safe Replacements</h3>
                {replacementTracks.map((t) => (
                  <Card key={t.id} className="p-4 flex items-center justify-between gap-4 border-l-4 border-l-green-500 bg-card border-border hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                        <Music className="w-4 h-4 text-green-500" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">{t.title}</h4>
                        <p className="text-sm text-muted-foreground">{t.artist} • {t.mood}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="font-mono">{t.duration}</Badge>
                  </Card>
                ))}
              </div>
            )}

            <Button onClick={reset} variant="outline" className="w-full mt-8 h-12" data-testid="button-scan-again">
              Scan Another File
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
