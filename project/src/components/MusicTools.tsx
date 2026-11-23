import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CircleCheck, Drum, Hand, Mic, MicOff, Minus, Play, Plus, Square, Volume2, VolumeX } from 'lucide-react';
import { PitchDetector } from 'pitchy';
import { createPattern, DrumTransport, drumTracks, tuningFromFrequency, type DrumKit, type DrumTrack, type RhythmConfig } from '../utils/musicTools';
import RhythmPresets from './RhythmPresets';
import './MusicTools.css';

type Tuning = NonNullable<ReturnType<typeof tuningFromFrequency>>;
type Microphone = { context: AudioContext; stream?: MediaStream; source?: MediaStreamAudioSourceNode; frame: number };
const trackNames: Record<DrumTrack, string> = { pulse: 'Clique', kick: 'Bombo', snare: 'Caixa', hat: 'Pratos' };

export default function MusicTools() {
  const [listening, setListening] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [tuning, setTuning] = useState<Tuning | null>(null);
  const [level, setLevel] = useState(0);
  const [reference, setReference] = useState(440);
  const [micError, setMicError] = useState('');
  const [audioError, setAudioError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [drums, setDrums] = useState(false);
  const [config, setConfig] = useState<RhythmConfig>({ bpm: 100, beats: 4, subdivision: 2, volume: 0.5, kit: 'wood', pattern: createPattern(4, 2, false), muted: [] });
  const microphone = useRef<Microphone | null>(null);
  const transport = useRef<DrumTransport | null>(null);
  const requestId = useRef(0);
  const referenceRef = useRef(reference);
  const taps = useRef<number[]>([]);

  function stopMic() {
    requestId.current++;
    const active = microphone.current;
    microphone.current = null;
    if (active) {
      cancelAnimationFrame(active.frame);
      active.stream?.getTracks().forEach((track) => track.stop());
      active.source?.disconnect();
      if (active.context.state !== 'closed') void active.context.close().catch(() => {});
    }
    setListening(false);
    setRequesting(false);
    setTuning(null);
    setLevel(0);
  }

  function stopDrums() {
    transport.current?.stop();
    transport.current = null;
    setPlaying(false);
    setStarting(false);
    setCurrentStep(-1);
  }

  useEffect(() => {
    const pause = () => { if (document.hidden) { stopMic(); stopDrums(); } };
    document.addEventListener('visibilitychange', pause);
    return () => { document.removeEventListener('visibilitychange', pause); stopMic(); stopDrums(); };
  }, []);

  useEffect(() => { referenceRef.current = reference; }, [reference]);
  useEffect(() => { transport.current?.configure(config); }, [config]);

  async function startMic() {
    stopDrums();
    stopMic();
    setMicError('');
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      setMicError('Microfone indisponível. Abra esta página em HTTPS num navegador compatível.');
      return;
    }
    setRequesting(true);
    const identity = ++requestId.current;
    try {
      const context = new AudioContext();
      const active: Microphone = { context, frame: 0 };
      microphone.current = active;
      await context.resume();
      if (requestId.current !== identity) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (requestId.current !== identity) { stream.getTracks().forEach((track) => track.stop()); return; }
      active.stream = stream;
      const analyser = context.createAnalyser();
      analyser.fftSize = 4096;
      active.source = context.createMediaStreamSource(stream);
      active.source.connect(analyser);
      stream.getAudioTracks().forEach((track) => track.addEventListener('ended', () => {
        if (microphone.current === active) { stopMic(); setMicError('O microfone foi desligado. Volte a ativá-lo.'); }
      }));
      const samples = new Float32Array(analyser.fftSize);
      const detector = PitchDetector.forFloat32Array(samples.length);
      let lastPaint = 0;
      let lastSignal = 0;
      const detect = (time: number) => {
        if (microphone.current !== active) return;
        if (time - lastPaint > 75) {
          analyser.getFloatTimeDomainData(samples);
          const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
          setLevel(Math.min(1, rms * 6));
          const [frequency, clarity] = detector.findPitch(samples, context.sampleRate);
          if (rms > 0.008 && clarity > 0.9 && frequency >= 35 && frequency <= 2000) {
            setTuning(tuningFromFrequency(frequency, referenceRef.current));
            lastSignal = time;
          } else if (time - lastSignal > 400) setTuning(null);
          lastPaint = time;
        }
        active.frame = requestAnimationFrame(detect);
      };
      setRequesting(false);
      setListening(true);
      active.frame = requestAnimationFrame(detect);
    } catch (error) {
      if (requestId.current !== identity) return;
      stopMic();
      setMicError(error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Acesso ao microfone recusado. Verifique a permissão do microfone no navegador.'
        : 'Não foi possível abrir o microfone. Verifique se está ligado e disponível.');
    }
  }

  async function startDrums() {
    stopMic();
    setAudioError('');
    setStarting(true);
    let engine: DrumTransport | null = null;
    try {
      engine = new DrumTransport(new AudioContext(), config, setCurrentStep);
      transport.current = engine;
      await engine.start();
      if (transport.current === engine) { setStarting(false); setPlaying(true); }
    } catch {
      if (transport.current === engine) {
        stopDrums();
        setAudioError('Não foi possível iniciar o áudio. Tente novamente num navegador compatível.');
      }
    }
  }

  function changeRhythm(beats: number, subdivision: number, nextDrums = drums) {
    stopDrums();
    setDrums(nextDrums);
    setConfig((previous) => ({ ...previous, beats, subdivision, pattern: createPattern(beats, subdivision, nextDrums) }));
  }

  function changeBpm(value: number) {
    if (Number.isFinite(value)) setConfig((previous) => ({ ...previous, bpm: Math.max(30, Math.min(240, Math.round(value))) }));
  }

  function tapTempo() {
    const now = performance.now();
    taps.current = [...taps.current.filter((time) => now - time < 3000), now].slice(-6);
    if (taps.current.length > 1) changeBpm(60000 * (taps.current.length - 1) / (now - taps.current[0]));
  }

  const inTune = tuning !== null && Math.abs(tuning.cents) <= 5;
  const cents = tuning?.cents ?? 0;
  const steps = config.beats * config.subdivision;
  const tunerStatus = !listening ? 'Microfone desligado' : !tuning ? 'A escutar...' : inTune ? 'Afinado' : cents < 0 ? 'Baixo · subir afinação' : 'Alto · baixar afinação';

  return (
    <div className="music-tools">
      <div className="tools-instruments">
        <section className="tools-tuner" aria-labelledby="tuner-title">
          <div className="instrument-heading"><h2 id="tuner-title"><Mic size={20} /> Afinador</h2><span className={`instrument-light ${listening ? 'is-on' : ''}`} aria-hidden="true" /></div>
          <div className={`tuning-display ${tuning ? inTune ? 'is-tuned' : 'is-detuned' : ''}`}>
            <div className="tuner-gauge" role="meter" aria-label="Desvio de afinação" aria-valuemin={-50} aria-valuemax={50} aria-valuenow={Math.round(cents)} aria-valuetext={tuning ? `${Math.round(cents)} cents` : 'Sem nota'}>
              <div className="gauge-arc" /><span className="gauge-label gauge-flat">-50</span><span className="gauge-label gauge-zero">0</span><span className="gauge-label gauge-sharp">+50</span>
              <div className={`gauge-needle ${tuning ? 'has-note' : ''}`} style={{ transform: `rotate(${cents * 1.4}deg)` }} /><div className="gauge-pivot" />
            </div>
            <div className="tuner-note" aria-label="Nota detetada">{tuning?.note ?? '--'}<span>{tuning?.octave ?? ''}</span></div>
            <div className="tuner-frequency">{tuning ? `${tuning.frequency.toFixed(1)} Hz` : '— Hz'}<span>{tuning ? `${cents > 0 ? '+' : ''}${Math.round(cents)} cents` : '— cents'}</span></div>
            <div className="tuner-bars" aria-hidden="true">{Array.from({ length: 31 }, (_, index) => {
              const distance = (index - 15) / 15 * 50;
              return <i key={index} className={`${Math.abs(distance) <= 5 ? 'bar-green' : 'bar-red'} ${tuning && Math.abs(distance - cents) < 5 ? 'bar-active' : ''}`} style={{ height: `${18 + (15 - Math.abs(index - 15)) * 1.6}px` }} />;
            })}</div>
            <p className="tuner-status" role="status">{inTune && <CircleCheck size={17} />}{tunerStatus}</p>
          </div>
          <div className="tuner-settings"><label>Referência A4<select value={reference} onChange={(event) => setReference(Number(event.target.value))}>{[432, 438, 439, 440, 441, 442, 443, 444].map((value) => <option key={value} value={value}>{value} Hz</option>)}</select></label><div className="mic-level"><span>Sinal</span><meter aria-label="Nível do microfone" min={0} max={1} value={level} /></div></div>
          <button type="button" className={`tools-primary ${listening || requesting ? 'is-running' : ''}`} onClick={() => listening || requesting ? stopMic() : void startMic()}>{listening || requesting ? <MicOff size={18} /> : <Mic size={18} />}{requesting ? 'Cancelar microfone' : listening ? 'Desligar microfone' : 'Ativar microfone'}</button>
          {micError && <p className="tools-error" role="alert">{micError}</p>}
        </section>

        <section className="tools-rhythm" aria-labelledby="rhythm-title">
          <div className="instrument-heading"><h2 id="rhythm-title"><Drum size={21} /> Ritmo</h2><span className="tools-tempo-name">{drums ? 'Bateria' : 'Metrónomo'}</span></div>
          <RhythmPresets config={config} drums={drums} onLoad={(preset) => {
            stopDrums();
            setDrums(preset.drums);
            setConfig(preset.config);
          }} />
          <div className="tempo-controls"><button type="button" className="tools-icon" aria-label="Diminuir BPM" title="Diminuir BPM" disabled={config.bpm <= 30} onClick={() => changeBpm(config.bpm - 1)}><Minus size={20} /></button><label className="tempo-value"><input aria-label="BPM" type="number" min={30} max={240} value={config.bpm} onChange={(event) => changeBpm(event.target.valueAsNumber)} /><span>BPM</span></label><button type="button" className="tools-icon" aria-label="Aumentar BPM" title="Aumentar BPM" disabled={config.bpm >= 240} onClick={() => changeBpm(config.bpm + 1)}><Plus size={20} /></button></div>
          <input className="tempo-slider" aria-label="Tempo" type="range" min={30} max={240} value={config.bpm} onChange={(event) => changeBpm(Number(event.target.value))} />
          <div className="beat-lights" aria-label="Pulsação">{Array.from({ length: config.beats }, (_, index) => <span key={index} className={`${index === 0 ? 'beat-accent' : ''} ${playing && Math.floor(currentStep / config.subdivision) === index ? 'beat-current' : ''}`}>{index + 1}</span>)}</div>
          <div className="rhythm-actions"><button type="button" className={`tools-primary ${playing ? 'is-running' : ''}`} onClick={() => playing || starting ? stopDrums() : void startDrums()}>{playing || starting ? <Square size={18} /> : <Play size={18} />}{starting ? 'Cancelar' : playing ? 'Parar' : 'Iniciar'}</button><button type="button" className="tools-secondary" onClick={tapTempo}><Hand size={18} /> Tap tempo</button></div>
          <div className="rhythm-settings"><label>Padrão<select aria-label="Padrão" value={drums ? 'drums' : 'click'} onChange={(event) => changeRhythm(config.beats, config.subdivision, event.target.value === 'drums')}><option value="click">Metrónomo</option><option value="drums">Bateria</option></select></label><label>Compasso<select aria-label="Compasso" value={config.beats} onChange={(event) => changeRhythm(Number(event.target.value), config.subdivision)}>{[2, 3, 4, 6, 7].map((value) => <option key={value} value={value}>{value}/4</option>)}</select></label><label>Subdivisão<select aria-label="Subdivisão" value={config.subdivision} onChange={(event) => changeRhythm(config.beats, Number(event.target.value))}><option value={1}>Semínimas</option><option value={2}>Colcheias</option><option value={4}>Semicolcheias</option></select></label><label>Som<select aria-label="Som" value={config.kit} onChange={(event) => setConfig((previous) => ({ ...previous, kit: event.target.value as DrumKit }))}><option value="wood">Madeira</option><option value="electronic">Eletrónico</option><option value="studio">Estúdio</option></select></label></div>
          <div className="sequencer-scroll"><div className="drum-sequencer" style={{ '--steps': steps } as CSSProperties} role="group" aria-label="Sequenciador de bateria"><div className="step-labels"><span />{Array.from({ length: steps }, (_, step) => <span key={step}>{step % config.subdivision === 0 ? Math.floor(step / config.subdivision) + 1 : '·'}</span>)}</div>{drumTracks.map((track) => <div key={track} className={`drum-row track-${track}`}><button type="button" className="track-mute" title={`${config.muted.includes(track) ? 'Ativar' : 'Silenciar'} ${trackNames[track]}`} aria-label={`Silenciar ${trackNames[track]}`} aria-pressed={config.muted.includes(track)} onClick={() => setConfig((previous) => ({ ...previous, muted: previous.muted.includes(track) ? previous.muted.filter((item) => item !== track) : [...previous.muted, track] }))}>{config.muted.includes(track) ? <VolumeX size={14} /> : <Volume2 size={14} />}<span>{trackNames[track]}</span></button>{config.pattern[track].map((enabled, step) => <button key={step} type="button" className={`drum-step ${enabled ? 'step-enabled' : ''} ${playing && step === currentStep ? 'step-current' : ''} ${step % config.subdivision === 0 ? 'step-downbeat' : ''}`} aria-label={`${trackNames[track]} passo ${step + 1}`} aria-pressed={enabled} onClick={() => setConfig((previous) => ({ ...previous, pattern: { ...previous.pattern, [track]: previous.pattern[track].map((value, index) => index === step ? !value : value) } }))} />)}</div>)}</div></div>
          <label className="tools-volume"><Volume2 size={18} /><span>Volume</span><input aria-label="Volume" type="range" min={0} max={100} value={Math.round(config.volume * 100)} onChange={(event) => setConfig((previous) => ({ ...previous, volume: Number(event.target.value) / 100 }))} /><output>{Math.round(config.volume * 100)}%</output></label>
          {audioError && <p className="tools-error" role="alert">{audioError}</p>}
        </section>
      </div>
    </div>
  );
}