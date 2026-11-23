import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { useWorkspaceAuth } from '../hooks/useWorkspaceAuth';
import { supabase } from '../utils/supabase';
import { readRhythmPreset, rhythmConfigKey, type RhythmConfig, type RhythmPreset } from '../utils/musicTools';

type Props = { config: RhythmConfig; drums: boolean; onLoad: (preset: RhythmPreset) => void };

async function loadRhythms(bandId: string) {
  const names = new Set<string>();
  if (!supabase) throw new Error('Serviço indisponível.');
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('songs').select('rhythm').eq('band_id', bandId).order('id').range(offset, offset + 999);
    if (error) throw new Error('Não foi possível carregar os ritmos do repertório.');
    for (const song of data ?? []) if (song.rhythm?.trim()) names.add(song.rhythm.trim());
    if (!data || data.length < 1000) break;
  }
  return [...names].sort((first, second) => first.localeCompare(second, 'pt'));
}

export default function RhythmPresets({ config, drums, onLoad }: Props) {
  const { memberships } = useWorkspaceAuth();
  const bands = memberships.filter((member) => member.roles.some((role) => ['owner', 'admin', 'musician', 'viewer'].includes(role)));
  const [bandId, setBandId] = useState(bands[0]?.band_id ?? '');
  const [rhythms, setRhythms] = useState<string[]>([]);
  const [presets, setPresets] = useState<Record<string, RhythmPreset>>({});
  const [selected, setSelected] = useState('');
  const [baseline, setBaseline] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const canEdit = bands.find((band) => band.band_id === bandId)?.roles.some((role) => ['owner', 'admin', 'musician'].includes(role)) ?? false;
  const currentKey = rhythmConfigKey(config, drums);
  const dirty = Boolean(selected && baseline !== currentKey);
  const hasSaved = Object.hasOwn(presets, selected);

  useEffect(() => {
    let active = true;
    const operation = ++generation.current;
    setLoading(true);
    setLoadError('');
    async function load() {
      try {
        if (!supabase || !bandId) throw new Error('Serviço indisponível.');
        const [names, result] = await Promise.all([
          loadRhythms(bandId),
          supabase.from('rhythm_presets').select('*').eq('band_id', bandId),
        ]);
        if (!active) return;
        setRhythms(names);
        if (result.error) throw new Error('Não foi possível carregar as configurações guardadas.');
        const saved: Record<string, RhythmPreset> = Object.create(null);
        for (const row of result.data ?? []) {
          const preset = readRhythmPreset(row);
          if (!preset || typeof row.rhythm !== 'string') throw new Error('Uma configuração guardada é inválida.');
          saved[row.rhythm] = preset;
        }
        setPresets(saved);
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar os ritmos.');
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; generation.current = operation + 1; };
  }, [bandId, revision]);

  function canDiscard() {
    return !canEdit || !dirty || window.confirm('Existem alterações por guardar. Descartar alterações?');
  }

  function chooseRhythm(name: string) {
    if (!canDiscard()) return;
    setSelected(name);
    setSaveError('');
    const preset = Object.hasOwn(presets, name) ? presets[name] : null;
    if (preset) {
      onLoad(preset);
      setBaseline(rhythmConfigKey(preset.config, preset.drums));
    } else setBaseline(currentKey);
  }

  async function save() {
    if (!supabase || !selected || !canEdit || loading || loadError || saving) return;
    const operation = generation.current;
    const savedKey = currentKey;
    setSaving(true);
    setSaveError('');
    try {
      const { data, error } = await supabase.from('rhythm_presets')
        .upsert({ band_id: bandId, rhythm: selected, drums, ...config }, { onConflict: 'band_id,rhythm' }).select('*').single();
      if (error) throw new Error('Não foi possível guardar a configuração. Tente novamente.');
      const preset = readRhythmPreset(data);
      if (!preset) throw new Error('Não foi possível confirmar a configuração guardada.');
      if (operation !== generation.current) return;
      setPresets((previous) => ({ ...previous, [selected]: preset }));
      setBaseline(savedKey);
    } catch (error) {
      if (operation === generation.current) setSaveError(error instanceof Error ? error.message : 'Não foi possível guardar.');
    } finally { if (operation === generation.current) setSaving(false); }
  }

  return (
    <div className="rhythm-presets">
      {bands.length > 1 && <label>Banda<select value={bandId} disabled={saving} onChange={(event) => {
        if (!canDiscard()) return;
        setSelected(''); setBaseline(''); setSaveError(''); setBandId(event.target.value);
      }}>{bands.map((band) => <option key={band.band_id} value={band.band_id}>{band.bands?.name ?? band.band_id}</option>)}</select></label>}
      <div className="rhythm-preset-controls">
        <label>Ritmo do repertório<select aria-label="Ritmo do repertório" value={selected} disabled={loading || saving} onChange={(event) => chooseRhythm(event.target.value)}>
          <option value="">{loading ? 'A carregar ritmos...' : rhythms.length ? 'Selecionar ritmo' : 'Sem ritmos no repertório'}</option>
          {rhythms.map((name) => <option key={name} value={name}>{name}</option>)}
        </select></label>
        {canEdit && <button type="button" className="tools-secondary" disabled={!selected || loading || saving || Boolean(loadError) || (hasSaved && !dirty)} onClick={() => void save()}><Save size={17} />{saving ? 'A guardar...' : 'Guardar'}</button>}
        <button type="button" className="tools-icon" aria-label="Atualizar ritmos" title="Atualizar ritmos" disabled={loading || saving} onClick={() => {
          if (!canDiscard()) return;
          setSelected(''); setBaseline(''); setSaveError(''); setRevision((value) => value + 1);
        }}><RefreshCw size={17} /></button>
      </div>
      {selected && !loadError && <p className="rhythm-save-status" role="status">{dirty ? canEdit ? 'Alterações por guardar' : 'Alterações locais' : hasSaved ? 'Configuração guardada' : 'Sem configuração guardada'}</p>}
      {(loadError || saveError) && <p className="tools-error" role="alert">{loadError || saveError}</p>}
    </div>
  );
}