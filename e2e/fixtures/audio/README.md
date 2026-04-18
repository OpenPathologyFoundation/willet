# Audio Test Fixtures for Dictation E2E Tests

## Recording Instructions

Record audio clips using Audacity or any recording tool. Each clip should be a short
pathology dictation phrase (2-10 seconds).

### Settings
- **Format**: WebM/Opus (preferred) or WAV
- **Sample rate**: 16 kHz mono (matches Whisper expectations)
- **Duration**: 2-10 seconds per clip

### Suggested Recordings

| File name | Dictation text | Purpose |
|---|---|---|
| `diagnosis-adenocarcinoma.webm` | "Adenocarcinoma, moderately differentiated" | Test DIAGNOSIS clause dictation |
| `margin-uninvolved.webm` | "Surgical margins uninvolved, closest margin four millimeters" | Test MARGIN clause dictation |
| `ancillary-lvi.webm` | "Lymphovascular invasion identified" | Test ANCILLARY clause dictation |
| `comment-discussed.webm` | "Discussed with oncology team regarding immunohistochemistry" | Test case comment dictation |
| `instruction-set-diagnosis.webm` | "Set diagnosis to invasive ductal carcinoma grade two" | Test conversational instruction |
| `quick-entry-findings.webm` | "Tubular adenoma with low grade dysplasia" | Test quick entry dictation |

### How to Record with Audacity

1. Open Audacity
2. Set Project Rate to 16000 Hz (bottom-left)
3. Tracks > Stereo to Mono (if needed)
4. Record your clip
5. File > Export Audio > WebM (Opus) or WAV
6. Save to this directory

### Using Without Real Audio

The E2E tests can run WITHOUT real audio files by using `mockTranscriptionResult(page, text)`
which intercepts the Whisper API and returns the specified text directly. This is the default
mode and doesn't require microphone access or audio files.

For full pipeline testing WITH real audio, place the recorded files here and use
`injectMicMock(page, 'filename.webm')` in your tests.
