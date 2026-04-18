#!/usr/bin/env python3
"""
Convert CAP protocol PKL files to JSON for WILLET synoptic panel.

Usage:
  python3 scripts/convert-protocols.py                    # convert all
  python3 scripts/convert-protocols.py breastca_jun2024   # convert specific
  python3 scripts/convert-protocols.py --list             # list available

Source: cap_protocols_ph/data/*.pkl
Output: src/lib/data/protocols/*.json + auto-generated registry
"""

import json
import os
import pickle
import sys
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
PKL_SOURCE_DIR = Path(os.environ.get(
    'CAP_PKL_DIR',
    str(Path.home() / 'CascadeProjects' / 'cap_protocols_ph' / 'data'),
))
OUTPUT_DIR = PROJECT_ROOT / 'src' / 'lib' / 'data' / 'protocols'

# Human-readable labels and specimen-type keywords for auto-registry
# Add entries here when onboarding a new protocol
PROTOCOL_METADATA = {
    'adrenal_mar2023':                {'label': 'Adrenal Gland (Mar 2023)',             'keywords': ['adrenal']},
    'ampulla_nov2021':                {'label': 'Ampulla of Vater (Nov 2021)',          'keywords': ['ampulla', 'vater']},
    'anus_sep2023':                   {'label': 'Anus (Sep 2023)',                      'keywords': ['anus', 'anal']},
    'appendix_dec2022':               {'label': 'Appendix (Dec 2022)',                  'keywords': ['appendix', 'appendectomy']},
    'bladder_jun2023':                {'label': 'Urinary Bladder (Jun 2023)',           'keywords': ['bladder', 'cystectomy']},
    'breastca_jun2024':               {'label': 'Breast Carcinoma (Jun 2024)',          'keywords': ['breast', 'mastectomy', 'lumpectomy']},
    'cervix_april2023':               {'label': 'Cervix (Apr 2023)',                    'keywords': ['cervix', 'cervical']},
    'colon_rectum_resection_062024':  {'label': 'Colon and Rectum Resection (Jun 2024)','keywords': ['colon', 'rectum', 'hemicolectomy', 'colectomy', 'sigmoid', 'cecum']},
    'cxbx_mar2023':                   {'label': 'Cervix Biopsy (Mar 2023)',             'keywords': ['cervix biopsy', 'cervical biopsy']},
    'dehb_jun2021':                   {'label': 'Extrahepatic Bile Duct (Jun 2021)',    'keywords': ['bile duct', 'extrahepatic']},
    'endom_dec2023':                  {'label': 'Endometrium (Dec 2023)',               'keywords': ['endometrium', 'endometrial', 'uterus']},
    'esophagus_jun2022':              {'label': 'Esophagus (Jun 2022)',                 'keywords': ['esophagus', 'esophageal', 'esophagectomy']},
    'exgct_sep2023':                  {'label': 'Extragonadal Germ Cell Tumor (Sep 2023)', 'keywords': ['germ cell', 'extragonadal']},
    'expan_nov2021':                  {'label': 'Exocrine Pancreas (Nov 2021)',         'keywords': ['pancreas', 'pancreatic', 'whipple']},
    'gb_jun2021':                     {'label': 'Gallbladder (Jun 2021)',               'keywords': ['gallbladder', 'cholecystectomy']},
    'gist_sep2023':                   {'label': 'GIST (Sep 2023)',                      'keywords': ['gist', 'gastrointestinal stromal']},
    'gtn_nov2021':                    {'label': 'Gestational Trophoblastic (Nov 2021)', 'keywords': ['gestational', 'trophoblastic', 'molar']},
    'hcc_jun2022':                    {'label': 'Hepatocellular Carcinoma (Jun 2022)',  'keywords': ['hepatocellular', 'liver', 'hepatectomy']},
    'ihb_jun2021':                    {'label': 'Intrahepatic Bile Duct (Jun 2021)',    'keywords': ['intrahepatic', 'cholangiocarcinoma']},
    'kidneyres_jun2024':              {'label': 'Kidney Resection (Jun 2024)',          'keywords': ['kidney', 'renal', 'nephrectomy']},
    'larynx_jun2023':                 {'label': 'Larynx (Jun 2023)',                    'keywords': ['larynx', 'laryngeal', 'laryngectomy', 'glottis']},
    'lung_sep2022':                   {'label': 'Lung (Sep 2022)',                      'keywords': ['lung', 'pulmonary', 'lobectomy', 'pneumonectomy']},
    'mesothelioma_june2021':          {'label': 'Mesothelioma (Jun 2021)',              'keywords': ['mesothelioma', 'pleural']},
    'oral_jun2023':                   {'label': 'Oral Cavity / Oropharynx (Jun 2023)', 'keywords': ['oral', 'oropharynx', 'tongue', 'floor of mouth']},
    'ovary_jun2024':                  {'label': 'Ovary / Fallopian Tube (Jun 2024)',    'keywords': ['ovary', 'ovarian', 'fallopian']},
    'phb_jun2021':                    {'label': 'Perihilar Bile Duct (Jun 2021)',       'keywords': ['perihilar']},
    'phyllodes_sep2022':              {'label': 'Phyllodes Tumor (Sep 2022)',           'keywords': ['phyllodes']},
    'proscore_sep2023':               {'label': 'Prostate Scoring (Sep 2023)',          'keywords': ['prostate score', 'gleason']},
    'prostaters_sep2023':             {'label': 'Prostate Resection (Sep 2023)',        'keywords': ['prostatectomy', 'prostate, radical']},
    'proturp_sep2023':                {'label': 'Prostate TURP (Sep 2023)',             'keywords': ['turp', 'prostate, transurethral']},
    'salivary_jun2023':               {'label': 'Salivary Gland (Jun 2023)',            'keywords': ['salivary', 'parotid', 'submandibular']},
    'stomach_mar2023':                {'label': 'Stomach (Mar 2023)',                   'keywords': ['stomach', 'gastric', 'gastrectomy']},
    'testis_sep2023':                 {'label': 'Testis (Sep 2023)',                    'keywords': ['testis', 'testicular', 'orchiectomy']},
    'thymus_june2021':                {'label': 'Thymus (Jun 2021)',                    'keywords': ['thymus', 'thymoma', 'thymectomy']},
    'thyroid_2023':                   {'label': 'Thyroid (2023)',                       'keywords': ['thyroid', 'thyroidectomy', 'lobectomy']},
    'uterus_sarc_mar2023':            {'label': 'Uterine Sarcoma (Mar 2023)',           'keywords': ['uterine sarcoma', 'leiomyosarcoma']},
    'vulva_jun2024':                  {'label': 'Vulva (Jun 2024)',                     'keywords': ['vulva', 'vulvar', 'vulvectomy']},
}


def convert_pkl(name: str) -> dict:
    """Convert a single PKL file to JSON, return the parsed data."""
    pkl_path = PKL_SOURCE_DIR / f'{name}.pkl'
    json_path = OUTPUT_DIR / f'{name}.json'

    if not pkl_path.exists():
        print(f'  SKIP {name}: {pkl_path} not found')
        return None

    with open(pkl_path, 'rb') as f:
        data = pickle.load(f)

    with open(json_path, 'w') as f:
        json.dump(data, f, indent=2)

    section_count = len(data)
    print(f'  OK   {name}: {section_count} sections -> {json_path.name}')
    return data


def join_entries(entries: list[str]) -> str:
    """Join registry entries with comma + newline (avoids f-string escaping issues)."""
    return ',\n'.join(entries)


def generate_registry():
    """Generate the TypeScript registry file from available JSON protocols."""
    json_files = sorted(OUTPUT_DIR.glob('*.json'))
    registry_path = OUTPUT_DIR / 'index.ts'

    entries = []
    for json_file in json_files:
        name = json_file.stem
        meta = PROTOCOL_METADATA.get(name)
        if not meta:
            print(f'  WARN {name}.json has no metadata entry — skipping registry')
            continue

        keywords_str = ', '.join(f"'{k}'" for k in meta['keywords'])
        entries.append(f"""  {{
    file: '{name}',
    label: '{meta["label"]}',
    keywords: [{keywords_str}],
  }}""")

    registry_content = f"""// Protocol Registry — AUTO-GENERATED by scripts/convert-protocols.py
// Do not edit manually. Run: python3 scripts/convert-protocols.py
//
// {len(entries)} protocols registered from {len(json_files)} JSON files.

import type {{ ProtocolRegistryEntry, SynopticProtocol }} from '$lib/types/synoptic';

export const PROTOCOL_REGISTRY: ProtocolRegistryEntry[] = [
{join_entries(entries)},
];

/**
 * Find the best-matching CAP protocol for a given specimen type.
 * Returns the registry entry if a keyword matches, null otherwise.
 */
export function findProtocolForSpecimen(specimenType: string | null): ProtocolRegistryEntry | null {{
  if (!specimenType) return null;

  const normalized = specimenType.toLowerCase();

  for (const entry of PROTOCOL_REGISTRY) {{
    for (const keyword of entry.keywords) {{
      if (normalized.includes(keyword)) {{
        return entry;
      }}
    }}
  }}

  return null;
}}

// Dynamic protocol loader — imports JSON at runtime
const protocolCache = new Map<string, SynopticProtocol>();

export async function loadProtocol(fileName: string): Promise<SynopticProtocol> {{
  const cached = protocolCache.get(fileName);
  if (cached) return cached;

  // Vite dynamic import for JSON files in the data directory
  const modules = import.meta.glob('./*.json');
  const importFn = modules[`./${{fileName}}.json`];

  if (!importFn) {{
    throw new Error(`Protocol file not found: ${{fileName}}.json`);
  }}

  const module = await importFn() as {{ default: SynopticProtocol }};
  const protocol = module.default;
  protocolCache.set(fileName, protocol);
  return protocol;
}}
"""

    with open(registry_path, 'w') as f:
        f.write(registry_content)

    print(f'\n  Registry: {len(entries)} protocols written to {registry_path.name}')


def validate_protocol(name: str, data: dict) -> list[str]:
    """Validate a protocol JSON structure. Returns list of warnings."""
    warnings = []
    valid_types = {'blank', 'dropdown', 'dropdown-count', 'dropdown-size',
                   'dropdown-distance', 'dropdown-depth', 'multiselect', 'text', 'list'}

    for section_title, section in data.items():
        if not isinstance(section, dict):
            warnings.append(f'{name}: section "{section_title}" is not a dict')
            continue

        field_type = section.get('type')
        if field_type not in valid_types:
            warnings.append(f'{name}: section "{section_title}" has unknown type "{field_type}"')

        if field_type in ('dropdown', 'multiselect') and not section.get('options'):
            warnings.append(f'{name}: section "{section_title}" is {field_type} but has no options')

    return warnings


def main():
    args = sys.argv[1:]

    if '--list' in args:
        print(f'\nAvailable protocols in {PKL_SOURCE_DIR}:')
        for pkl in sorted(PKL_SOURCE_DIR.glob('*.pkl')):
            name = pkl.stem
            meta = PROTOCOL_METADATA.get(name, {})
            label = meta.get('label', '(no metadata)')
            print(f'  {name:40s} {label}')
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Determine which protocols to convert
    if args and args[0] != '--list':
        names = args
    else:
        names = [p.stem for p in sorted(PKL_SOURCE_DIR.glob('*.pkl'))]

    print(f'Converting {len(names)} protocol(s) from {PKL_SOURCE_DIR}...\n')

    all_warnings = []
    converted = 0

    for name in names:
        data = convert_pkl(name)
        if data:
            warnings = validate_protocol(name, data)
            all_warnings.extend(warnings)
            converted += 1

    # Regenerate the registry from all available JSON files
    generate_registry()

    # Print validation summary
    if all_warnings:
        print(f'\n  Warnings ({len(all_warnings)}):')
        for w in all_warnings:
            print(f'    - {w}')

    print(f'\n  Done: {converted} protocols converted.')


if __name__ == '__main__':
    main()
