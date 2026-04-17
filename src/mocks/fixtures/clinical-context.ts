// Clinical Context Mock Fixtures
// Synthetic data for the Context Dock (SDS 04-01 §12, SRS-200–204)
//
// Five case scenarios covering different interaction patterns:
//   S26-0004  Colon adenocarcinoma resection — dense history
//   S26-0005  Breast mastectomy with SLN — clean two-step
//   S26-0006  EGD with gastric biopsies — sparse/minimal
//   S26-0007  Prostate needle biopsy (surveillance) — longitudinal
//   S26-0008  Thyroid lobectomy — critical prior FNA

import type { ClinicalContextBundle } from '$lib/types';

// ==========================================================================
// CASE 1: S26-0004 — Right hemicolectomy for colon adenocarcinoma
// Dense history: colonoscopy biopsy, CT staging, operative note
// ==========================================================================

export const clinicalS26_0004: ClinicalContextBundle = {
  caseId: 'S26-0004',
  patientMrn: 'XN-000018',

  surgicalNotes: [
    {
      id: 'sn-0004-001',
      reportType: 'OPERATIVE_NOTE',
      reportDate: '2026-01-14',
      sourceSystem: 'Epic',
      title: 'Right Hemicolectomy',
      relevance: 'PRIMARY',
      summary: null,
      body: `OPERATIVE REPORT

DATE OF PROCEDURE: 01/14/2026
SURGEON: Dr. Michael Torrance, MD, FACS
ASSISTANT: Dr. Emily Chou, MD

PREOPERATIVE DIAGNOSIS: Adenocarcinoma of the ascending colon

POSTOPERATIVE DIAGNOSIS: Same

OPERATION: Laparoscopic-assisted right hemicolectomy with primary anastomosis

ANESTHESIA: General endotracheal

INDICATIONS: This is a 46-year-old male with a recent colonoscopy showing a large sessile mass in the ascending colon. Biopsies demonstrated moderately differentiated adenocarcinoma. Preoperative CT showed no evidence of distant metastatic disease. Risks, benefits, and alternatives of surgical resection were discussed with the patient, and informed consent was obtained.

FINDINGS: A 4.2 cm firm mass was palpated in the ascending colon approximately 6 cm from the ileocecal valve. No serosal involvement was grossly apparent. Multiple enlarged mesenteric lymph nodes were noted in the ileocolic pedicle region. The liver was palpated and appeared normal. No peritoneal deposits were identified.

PROCEDURE: The patient was placed in the supine position with arms tucked. After induction of general anesthesia, the abdomen was prepped and draped in the usual sterile fashion. Pneumoperitoneum was established via Veress needle technique to 15 mmHg.

A 12-mm camera port was placed at the umbilicus. Under direct visualization, additional ports were placed: a 12-mm port in the suprapubic region, a 5-mm port in the left lower quadrant, and a 5-mm port in the left upper quadrant.

The right colon was mobilized using a medial-to-lateral approach. The ileocolic pedicle was identified and divided between Hem-o-lok clips after ensuring adequate mesenteric clearance. The right branch of the middle colic artery was similarly identified and divided. The hepatic flexure was mobilized, and the lateral attachments were taken down.

An approximately 5-cm midline incision was made incorporating the umbilical port site, and the specimen was exteriorized through a wound protector. The ileum was divided approximately 8 cm proximal to the ileocecal valve, and the transverse colon was divided with adequate proximal margin. A side-to-side functional end-to-end stapled ileocolic anastomosis was created using a GIA 80 stapler and the common enterotomy was closed with a TA 60 stapler. The anastomosis was inspected and found to be intact and patent.

The specimen was oriented and submitted for pathologic examination. Hemostasis was confirmed. The fascia was closed with #1 PDS suture, and the skin incisions were closed with subcuticular 4-0 Monocryl and Dermabond. Estimated blood loss was 75 mL. The patient tolerated the procedure well and was transferred to the PACU in stable condition.

SPECIMENS: Right colon with attached mesentery and ileocecal valve, labeled "right hemicolectomy."

DISPOSITION: PACU in stable condition.`,
    },
    {
      id: 'sn-0004-002',
      reportType: 'ENDOSCOPY',
      reportDate: '2025-12-20',
      sourceSystem: 'Epic',
      title: 'Colonoscopy with Biopsy',
      relevance: 'SUPPORTING',
      summary: null,
      body: `ENDOSCOPY REPORT

DATE OF PROCEDURE: 12/20/2025
ENDOSCOPIST: Dr. James Hargrove, MD
FELLOW: Dr. Sarah Kim, MD

INDICATION: Screening colonoscopy; patient is 46 years old, average risk. No prior colonoscopy. Positive family history (father diagnosed with colon cancer age 62).

SEDATION: Propofol, administered by anesthesia team.

INSTRUMENT: Olympus CF-HQ190L

EXTENT OF EXAM: Cecum reached and confirmed by identification of the appendiceal orifice and ileocecal valve. Retroflexion performed in the rectum.

PREPARATION: Boston Bowel Preparation Scale score 8/9 (excellent).

FINDINGS:
- Ascending colon: A large sessile polypoid mass, approximately 3.5 cm, was identified in the ascending colon at approximately 70 cm from the anal verge. The lesion was firm and appeared partially ulcerated. Multiple cold forceps biopsies were obtained (4 fragments submitted in jar labeled "ascending colon mass"). The lesion was tattooed with SPOT ink at three points distal to the mass for surgical identification.
- Transverse colon: Normal mucosa.
- Descending colon: Normal mucosa.
- Sigmoid colon: Two diminutive polyps (2 mm each) were identified and removed by cold snare polypectomy. Submitted separately.
- Rectum: Normal mucosa on retroflexion.

IMPRESSION:
1. Large sessile mass in the ascending colon, suspicious for malignancy. Biopsied and tattooed.
2. Two diminutive sigmoid polyps, removed.

RECOMMENDATIONS: Await pathology results. If malignancy confirmed, surgical consultation for resection. Follow-up with patient in 1 week for biopsy results.

COMPLICATIONS: None.`,
    },
  ],

  radiologyReports: [
    {
      id: 'rad-0004-001',
      reportType: 'RADIOLOGY',
      reportDate: '2026-01-03',
      sourceSystem: 'Epic',
      title: 'CT Abdomen/Pelvis with Contrast',
      relevance: 'PRIMARY',
      summary: null,
      body: `RADIOLOGY REPORT

EXAM: CT Abdomen and Pelvis with IV contrast
DATE: 01/03/2026
ORDERING PHYSICIAN: Dr. James Hargrove, MD
RADIOLOGIST: Dr. Patricia Nambi, MD

CLINICAL INDICATION: Colon adenocarcinoma, staging.

TECHNIQUE: Helical CT of the abdomen and pelvis was performed following administration of 100 mL Omnipaque 350 IV contrast. Oral contrast was also administered. Coronal and sagittal reformats were reviewed.

COMPARISON: No prior imaging available.

FINDINGS:

LIVER: No focal hepatic lesions. Normal size and contour.
GALLBLADDER/BILIARY: Unremarkable. No cholelithiasis.
PANCREAS: Normal size and enhancement. No focal lesion.
SPLEEN: Normal size.
ADRENALS: Unremarkable bilaterally.
KIDNEYS: Normal enhancement bilaterally. No hydronephrosis or stones.

GASTROINTESTINAL: There is asymmetric wall thickening involving the ascending colon measuring up to 1.8 cm in maximal thickness over a segment of approximately 4 cm. There is mild pericolonic fat stranding. No definite extramural extension of tumor is identified. Several mesenteric lymph nodes are noted in the ileocolic distribution, the largest measuring 1.2 x 0.9 cm, indeterminate. The remainder of the colon and small bowel are unremarkable.

VASCULATURE: Aorta and IVC are normal in caliber. No significant atherosclerotic disease.
PERITONEUM: No ascites. No peritoneal nodularity.
PELVIC ORGANS: Prostate is normal in size. Urinary bladder is unremarkable.
OSSEOUS STRUCTURES: No suspicious osseous lesions.

IMPRESSION:
1. Circumferential wall thickening in the ascending colon consistent with known primary malignancy. No definite evidence of serosal extension.
2. Small indeterminate ileocolic mesenteric lymph nodes.
3. No evidence of distant metastatic disease.

STAGING IMPRESSION: Likely T3N1, no evidence of M1 disease. Final pathologic staging recommended.`,
    },
    {
      id: 'rad-0004-002',
      reportType: 'RADIOLOGY',
      reportDate: '2025-12-28',
      sourceSystem: 'Epic',
      title: 'Chest X-Ray PA/Lateral',
      relevance: 'HISTORICAL',
      summary: null,
      body: `RADIOLOGY REPORT

EXAM: Chest PA and Lateral
DATE: 12/28/2025
ORDERING PHYSICIAN: Dr. James Hargrove, MD
RADIOLOGIST: Dr. Steven Lee, MD

CLINICAL INDICATION: Preoperative evaluation. History of colon adenocarcinoma.

TECHNIQUE: PA and lateral views of the chest were obtained.

COMPARISON: None available.

FINDINGS:
The heart is normal in size. The mediastinal contour is unremarkable. Lungs are clear bilaterally without focal consolidation, mass, or nodule. No pleural effusion or pneumothorax. The visualized osseous structures are unremarkable.

IMPRESSION:
Unremarkable chest radiograph. No evidence of pulmonary metastatic disease.`,
    },
  ],

  priorPathology: [
    {
      id: 'pp-0004-001',
      caseId: 'S25-8821',
      reportDate: '2025-12-23',
      specimenType: 'Colon, ascending, biopsy',
      anatomicSite: 'Colon, ascending',
      diagnosisSummary: 'Adenocarcinoma, moderately differentiated',
      relevance: 'PRIMARY',
      body: `SURGICAL PATHOLOGY REPORT

CASE: S25-8821
DATE REPORTED: 12/23/2025
PATHOLOGIST: Dr. Hlemsesor

CLINICAL INFORMATION: Ascending colon mass, colonoscopy biopsy.

SPECIMENS SUBMITTED:
A: "Ascending colon mass" — 4 fragments

FINAL DIAGNOSIS:
Part A (Ascending colon mass, biopsy):
Colonic mucosa with invasive adenocarcinoma, moderately differentiated.
The tumor forms irregular glands infiltrating through the lamina propria and into the muscularis mucosae.
No definitive submucosal invasion can be assessed on biopsy fragments.

COMMENT: The findings are consistent with invasive colorectal adenocarcinoma. Correlation with clinical and imaging findings and surgical consultation are recommended for definitive management.`,
    },
    {
      id: 'pp-0004-002',
      caseId: 'S25-8822',
      reportDate: '2025-12-23',
      specimenType: 'Colon, sigmoid, polypectomy',
      anatomicSite: 'Colon, sigmoid',
      diagnosisSummary: 'Tubular adenoma, low grade dysplasia',
      relevance: 'SUPPORTING',
      body: `SURGICAL PATHOLOGY REPORT

CASE: S25-8822
DATE REPORTED: 12/23/2025
PATHOLOGIST: Dr. Hlemsesor

CLINICAL INFORMATION: Diminutive sigmoid polyps, cold snare polypectomy.

SPECIMENS SUBMITTED:
A: "Sigmoid polyps" — 2 fragments

FINAL DIAGNOSIS:
Part A (Sigmoid polyps, polypectomy):
Tubular adenoma with low grade dysplasia (x2).
Fragments are completely excised.`,
    },
    {
      id: 'pp-0004-003',
      caseId: 'S25-8821-MSI',
      reportDate: '2026-01-02',
      specimenType: 'Molecular pathology, MSI',
      anatomicSite: 'Colon, ascending',
      diagnosisSummary: 'Microsatellite stable (MSS), all MMR proteins intact',
      relevance: 'PRIMARY',
      body: `MOLECULAR PATHOLOGY REPORT

CASE: S25-8821-MSI
TEST: Mismatch Repair Protein Immunohistochemistry
DATE REPORTED: 01/02/2026
PATHOLOGIST: Dr. Hlemsesor

SPECIMEN: Colon, ascending, biopsy (S25-8821, Part A)

RESULTS:
MLH1:  Intact nuclear expression
MSH2:  Intact nuclear expression
MSH6:  Intact nuclear expression
PMS2:  Intact nuclear expression

INTERPRETATION:
All four mismatch repair proteins show intact nuclear expression.
This result is consistent with a microsatellite stable (MSS) tumor.
No further molecular testing for Lynch syndrome is indicated based on these findings.`,
    },
    {
      id: 'pp-0004-004',
      caseId: 'S25-8821-KRAS',
      reportDate: '2026-01-05',
      specimenType: 'Molecular pathology, KRAS/NRAS/BRAF',
      anatomicSite: 'Colon, ascending',
      diagnosisSummary: 'KRAS G12D mutation detected, BRAF wild type',
      relevance: 'PRIMARY',
      body: `MOLECULAR PATHOLOGY REPORT

CASE: S25-8821-KRAS
TEST: Extended RAS/RAF Panel (NGS)
DATE REPORTED: 01/05/2026
PATHOLOGIST: Dr. Bmodeswuv

SPECIMEN: Colon, ascending, biopsy (S25-8821, Part A)

RESULTS:
KRAS:  Mutation detected — c.35G>A (p.G12D), exon 2
       Variant allele frequency: 42%
NRAS:  No mutation detected (wild type)
BRAF:  No mutation detected (wild type, V600E negative)

INTERPRETATION:
A KRAS G12D mutation was detected. This mutation is associated with
resistance to anti-EGFR therapy (cetuximab, panitumumab).
BRAF V600E is wild type. NRAS is wild type.

CLINICAL SIGNIFICANCE:
Patient is NOT eligible for anti-EGFR monoclonal antibody therapy
based on KRAS mutation status.`,
    },
  ],
};


// ==========================================================================
// CASE 2: S26-0005 — Breast mastectomy with sentinel lymph node
// Clean two-step: mammogram/MRI → core biopsy → current mastectomy
// ==========================================================================

export const clinicalS26_0005: ClinicalContextBundle = {
  caseId: 'S26-0005',
  patientMrn: 'XN-000001',

  surgicalNotes: [
    {
      id: 'sn-0005-001',
      reportType: 'OPERATIVE_NOTE',
      reportDate: '2026-01-16',
      sourceSystem: 'Epic',
      title: 'Right Mastectomy with Sentinel Lymph Node Biopsy',
      relevance: 'PRIMARY',
      summary: null,
      body: `OPERATIVE REPORT

DATE OF PROCEDURE: 01/16/2026
SURGEON: Dr. Angela Moreau, MD, FACS
ASSISTANT: Dr. David Pham, MD

PREOPERATIVE DIAGNOSIS: Invasive ductal carcinoma of the right breast

POSTOPERATIVE DIAGNOSIS: Same

PROCEDURES:
1. Right simple mastectomy
2. Right axillary sentinel lymph node biopsy

ANESTHESIA: General

INDICATIONS: This is a 71-year-old female who presented with a palpable right breast mass. Imaging demonstrated a 3.5 cm spiculated mass at the 2 o'clock position, 5 cm from the nipple, BI-RADS 5. Core needle biopsy confirmed invasive ductal carcinoma, grade 2, ER+/PR+/HER2-. After multidisciplinary discussion, the patient elected mastectomy without reconstruction. Sentinel lymph node biopsy was planned for axillary staging.

OPERATIVE FINDINGS:
The tumor was palpable at the 2 o'clock position in the upper outer quadrant, approximately 3.5 cm, firm and adherent to surrounding breast tissue but not fixed to the chest wall or skin. Three sentinel lymph nodes were identified by lymphatic mapping (technetium-99m sulfur colloid injected preoperatively, isosulfan blue dye injected intraoperatively). Sentinel nodes appeared grossly unremarkable.

PROCEDURE: After induction of general anesthesia, the patient was positioned supine with the right arm extended on an arm board. The right breast and axilla were prepped and draped in standard fashion.

The sentinel lymph node biopsy was performed first. A 3-cm curvilinear incision was made in the right axilla. Using the gamma probe and visual identification of blue-stained lymphatics, three sentinel lymph nodes were identified and excised separately (labeled SLN #1, SLN #2, SLN #3). All three were radioactive on ex vivo counts. Background counts were minimal after removal.

The mastectomy was then performed using a standard elliptical incision encompassing the nipple-areolar complex and the prior biopsy site. Skin flaps were raised in the plane between the subcutaneous fat and the breast parenchyma. The breast was dissected off the pectoralis major fascia from medial to lateral. The specimen was oriented with a short suture on the superior aspect and a long suture on the lateral aspect. Hemostasis was achieved with electrocautery. A closed-suction drain was placed and secured. The wound was closed in layers.

SPECIMENS:
1. Right breast, mastectomy — oriented with short suture superior, long suture lateral
2. Right axillary sentinel lymph node #1
3. Right axillary sentinel lymph node #2
4. Right axillary sentinel lymph node #3

EBL: 50 mL
COMPLICATIONS: None
DISPOSITION: PACU in stable condition`,
    },
  ],

  radiologyReports: [
    {
      id: 'rad-0005-001',
      reportType: 'RADIOLOGY',
      reportDate: '2025-12-05',
      sourceSystem: 'Epic',
      title: 'Diagnostic Mammogram, Bilateral',
      relevance: 'PRIMARY',
      summary: null,
      body: `RADIOLOGY REPORT

EXAM: Diagnostic Mammogram, Bilateral
DATE: 12/05/2025
ORDERING PHYSICIAN: Dr. Susan Alder, MD
RADIOLOGIST: Dr. Wendy Chen, MD

CLINICAL INDICATION: 71-year-old female with palpable right breast mass.

TECHNIQUE: Standard CC and MLO views bilateral. Spot compression and magnification views of the right breast mass.

COMPARISON: Screening mammogram dated 11/15/2023 (no significant findings at that time).

FINDINGS:

RIGHT BREAST: There is a 3.5 x 2.8 cm irregular, spiculated, high-density mass at the 2 o'clock position, approximately 5 cm from the nipple in the upper outer quadrant. Associated architectural distortion is present. Coarse calcifications are seen within and adjacent to the mass. No skin thickening or retraction. Axillary lymph nodes appear morphologically normal.

LEFT BREAST: Scattered fibroglandular tissue. No suspicious mass, calcification, or architectural distortion.

BREAST DENSITY: Heterogeneously dense (ACR C), which may obscure small masses.

ASSESSMENT:
Right breast: BI-RADS 5 — Highly suggestive of malignancy
Left breast: BI-RADS 1 — Negative

RECOMMENDATION: Tissue sampling of the right breast mass is recommended. Ultrasound-guided core needle biopsy suggested given the palpable nature and size of the lesion.`,
    },
    {
      id: 'rad-0005-002',
      reportType: 'RADIOLOGY',
      reportDate: '2025-12-10',
      sourceSystem: 'Epic',
      title: 'Breast MRI with Contrast',
      relevance: 'SUPPORTING',
      summary: null,
      body: `RADIOLOGY REPORT

EXAM: MRI Breast Bilateral with and without IV contrast
DATE: 12/10/2025
ORDERING PHYSICIAN: Dr. Angela Moreau, MD
RADIOLOGIST: Dr. Wendy Chen, MD

CLINICAL INDICATION: Newly diagnosed right breast carcinoma on core biopsy. MRI for extent of disease evaluation and contralateral screening.

TECHNIQUE: MRI performed on 3T magnet with dedicated breast coil. Pre- and post-gadolinium T1-weighted, T2-weighted, and subtraction sequences obtained. CAD analysis performed.

COMPARISON: Diagnostic mammogram 12/05/2025.

FINDINGS:

RIGHT BREAST: The known mass at the 2 o'clock position demonstrates irregular morphology with heterogeneous enhancement and rapid initial enhancement with washout kinetics, measuring 3.6 x 3.0 x 2.8 cm. No additional satellite lesions or separate foci of suspicious enhancement are identified in the right breast. The pectoralis muscle is not involved. No chest wall invasion.

LEFT BREAST: No suspicious enhancement. No mass or non-mass enhancement.

AXILLA: Right axillary lymph nodes appear morphologically normal. No suspicious cortical thickening.

IMPRESSION:
1. Solitary right breast mass measuring 3.6 cm with malignant enhancement kinetics, corresponding to the known biopsy-proven invasive ductal carcinoma. No evidence of multifocality or multicentricity.
2. No suspicious contralateral disease.
3. No chest wall involvement.`,
    },
  ],

  priorPathology: [
    {
      id: 'pp-0005-001',
      caseId: 'S25-9103',
      reportDate: '2025-12-12',
      specimenType: 'Breast, right, core needle biopsy',
      anatomicSite: 'Breast, right, 2 o\'clock',
      diagnosisSummary: 'Invasive ductal carcinoma, grade 2, ER+/PR+/HER2-',
      relevance: 'PRIMARY',
      body: `SURGICAL PATHOLOGY REPORT

CASE: S25-9103
DATE REPORTED: 12/12/2025
PATHOLOGIST: Dr. Hlemsesor

CLINICAL INFORMATION: Right breast mass, 3.5 cm, BI-RADS 5. Ultrasound-guided core needle biopsy.

SPECIMENS SUBMITTED:
A: "Right breast, 2 o'clock, core biopsy" — 5 cores

FINAL DIAGNOSIS:
Part A (Right breast, 2 o'clock, core needle biopsy):
Invasive ductal carcinoma, Nottingham grade 2 (tubule score 3, nuclear score 2, mitotic score 1; total score 6/9).
Associated high-grade ductal carcinoma in situ (DCIS), solid and cribriform patterns, with central necrosis.

ANCILLARY STUDIES:
ER: Positive (95%, strong)
PR: Positive (80%, moderate to strong)
HER2: Negative (score 1+ by IHC)
Ki-67: 15%

COMMENT: Biomarker profile is consistent with Luminal A subtype. Recommend surgical excision for definitive treatment and staging.`,
    },
    {
      id: 'pp-0005-002',
      caseId: 'S22-3401',
      reportDate: '2022-05-18',
      specimenType: 'Breast, left, core needle biopsy',
      anatomicSite: 'Breast, left, 8 o\'clock',
      diagnosisSummary: 'Fibroadenoma',
      relevance: 'HISTORICAL',
      body: `SURGICAL PATHOLOGY REPORT

CASE: S22-3401
DATE REPORTED: 05/18/2022
PATHOLOGIST: Dr. Bmodeswuv

CLINICAL INFORMATION: Left breast palpable nodule, 1.2 cm, BI-RADS 4A. US-guided core needle biopsy.

SPECIMENS SUBMITTED:
A: "Left breast, 8 o'clock, core biopsy" — 4 cores

FINAL DIAGNOSIS:
Part A (Left breast, 8 o'clock, core needle biopsy):
Fibroadenoma.
The cores show well-circumscribed proliferation of bland stromal and epithelial elements in an intracanalicular pattern. No atypia or malignancy identified.`,
    },
    {
      id: 'pp-0005-003',
      caseId: 'C25-0412',
      reportDate: '2025-06-15',
      specimenType: 'Cervix, Pap smear',
      anatomicSite: 'Cervix',
      diagnosisSummary: 'NILM',
      relevance: 'IRRELEVANT',
      body: `CYTOPATHOLOGY REPORT

CASE: C25-0412
DATE REPORTED: 06/15/2025
PATHOLOGIST: Dr. Gmuklus

SPECIMEN: Cervical, ThinPrep Pap

ADEQUACY: Satisfactory for evaluation. Endocervical/transformation zone component present.

INTERPRETATION: Negative for intraepithelial lesion or malignancy (NILM).
Organisms: None identified.
Other: Atrophic changes consistent with menopausal status.`,
    },
  ],
};


// ==========================================================================
// CASE 3: S26-0006 — EGD with gastric biopsies
// Sparse history: endoscopy note, old unremarkable CT, prior polyps, irrelevant GYN
// ==========================================================================

export const clinicalS26_0006: ClinicalContextBundle = {
  caseId: 'S26-0006',
  patientMrn: 'XN-000042',

  surgicalNotes: [
    {
      id: 'sn-0006-001',
      reportType: 'ENDOSCOPY',
      reportDate: '2026-01-22',
      sourceSystem: 'Epic',
      title: 'EGD with Biopsy',
      relevance: 'PRIMARY',
      summary: null,
      body: `ENDOSCOPY REPORT

DATE OF PROCEDURE: 01/22/2026
ENDOSCOPIST: Dr. James Hargrove, MD

INDICATION: 62-year-old female with 3-month history of epigastric pain, dyspepsia, and early satiety unresponsive to 8 weeks of PPI therapy. No alarm symptoms. No weight loss. H. pylori serology positive.

SEDATION: Moderate sedation with midazolam 3 mg and fentanyl 75 mcg IV.

INSTRUMENT: Olympus GIF-HQ190

EXTENT OF EXAM: Esophagus to second portion of the duodenum.

FINDINGS:
ESOPHAGUS: Normal mucosa. No Barrett's. GE junction at 38 cm from the incisors. Z-line is regular.
STOMACH:
  - Fundus: Normal.
  - Body: Diffuse mild erythema of the gastric body mucosa. No ulceration.
  - Antrum: Moderate erythema and mild nodularity of the antral mucosa. Two small superficial erosions noted (each <5 mm). Biopsies taken from the antrum (4 fragments, jar A: "gastric antrum") and from the body (2 fragments, jar B: "gastric body") for H. pylori evaluation and histologic assessment.
  - Pylorus: Normal. Pyloric channel patent.
DUODENUM:
  - Bulb: Normal.
  - Second portion: Normal mucosa. No villous blunting.

IMPRESSION:
1. Moderate erythematous gastropathy with superficial antral erosions, consistent with H. pylori gastritis.
2. Biopsies obtained from antrum and body for histology and H. pylori confirmation.
3. Otherwise normal EGD to the second portion of the duodenum.

RECOMMENDATIONS: Await biopsy results. If H. pylori confirmed on histology, initiate triple therapy. Follow-up in 6 weeks. Repeat EGD only if symptoms persist after eradication therapy.

COMPLICATIONS: None.`,
    },
  ],

  radiologyReports: [
    {
      id: 'rad-0006-001',
      reportType: 'RADIOLOGY',
      reportDate: '2025-09-14',
      sourceSystem: 'Epic',
      title: 'CT Abdomen/Pelvis with Contrast',
      relevance: 'HISTORICAL',
      summary: null,
      body: `RADIOLOGY REPORT

EXAM: CT Abdomen and Pelvis with IV contrast
DATE: 09/14/2025
ORDERING PHYSICIAN: Dr. Linda Vasquez, MD
RADIOLOGIST: Dr. Patricia Nambi, MD

CLINICAL INDICATION: Abdominal pain, evaluate for acute pathology.

TECHNIQUE: Helical CT with 80 mL Omnipaque 350 IV. Oral contrast administered.

COMPARISON: None.

FINDINGS:
LIVER, GALLBLADDER, BILIARY: Unremarkable. No gallstones.
PANCREAS: Normal.
SPLEEN: Normal size.
KIDNEYS/ADRENALS: Unremarkable. Small simple cortical cyst left kidney, 8 mm.
GI TRACT: No bowel obstruction. No wall thickening. Appendix is normal. No free fluid.
PELVIC ORGANS: Post-hysterectomy changes. Bilateral ovaries not visualized (likely post-menopausal involution).
VASCULAR: No aneurysm.
BONES: Degenerative changes of the lumbar spine, mild.

IMPRESSION:
1. No acute abdominal or pelvic pathology.
2. Incidental 8 mm simple left renal cortical cyst, likely benign. No follow-up needed.`,
    },
  ],

  priorPathology: [
    {
      id: 'pp-0006-001',
      caseId: 'S24-5567',
      reportDate: '2024-03-10',
      specimenType: 'Colon, polypectomy',
      anatomicSite: 'Colon, sigmoid',
      diagnosisSummary: 'Hyperplastic polyp',
      relevance: 'HISTORICAL',
      body: `SURGICAL PATHOLOGY REPORT

CASE: S24-5567
DATE REPORTED: 03/10/2024
PATHOLOGIST: Dr. Bmodeswuv

CLINICAL INFORMATION: Sigmoid polyp found on screening colonoscopy.

SPECIMENS SUBMITTED:
A: "Sigmoid polyp" — 1 fragment

FINAL DIAGNOSIS:
Part A (Sigmoid polyp, polypectomy):
Hyperplastic polyp. Completely excised.`,
    },
    {
      id: 'pp-0006-002',
      caseId: 'C25-1890',
      reportDate: '2025-01-20',
      specimenType: 'Cervix, Pap smear',
      anatomicSite: 'Cervix',
      diagnosisSummary: 'NILM (post-hysterectomy vault smear)',
      relevance: 'IRRELEVANT',
      body: `CYTOPATHOLOGY REPORT

CASE: C25-1890
DATE REPORTED: 01/20/2025
PATHOLOGIST: Dr. Gmuklus

SPECIMEN: Vaginal vault, ThinPrep

ADEQUACY: Satisfactory for evaluation.

INTERPRETATION: Negative for intraepithelial lesion or malignancy (NILM).
No malignant cells. Benign reactive changes.`,
    },
  ],
};


// ==========================================================================
// CASE 4: S26-0007 — Prostate needle biopsy, active surveillance
// Longitudinal: MRI, three prior biopsies over 4 years with Gleason grades
// ==========================================================================

export const clinicalS26_0007: ClinicalContextBundle = {
  caseId: 'S26-0007',
  patientMrn: 'XN-000055',

  surgicalNotes: [],  // No operative note — this is a needle biopsy, no surgical procedure

  radiologyReports: [
    {
      id: 'rad-0007-001',
      reportType: 'RADIOLOGY',
      reportDate: '2025-12-15',
      sourceSystem: 'Epic',
      title: 'MRI Prostate, Multiparametric',
      relevance: 'PRIMARY',
      summary: null,
      body: `RADIOLOGY REPORT

EXAM: MRI Prostate, Multiparametric (mpMRI)
DATE: 12/15/2025
ORDERING PHYSICIAN: Dr. Robert Tse, MD (Urology)
RADIOLOGIST: Dr. David Kwon, MD

CLINICAL INDICATION: 72-year-old male on active surveillance for prostate adenocarcinoma (Gleason 3+3=6, diagnosed 2022). Rising PSA from 5.8 to 8.2 ng/mL over 18 months. Prior biopsy Gleason 3+3=6. MRI for re-staging prior to surveillance biopsy.

TECHNIQUE: 3T MRI with endorectal coil. T2-weighted, diffusion-weighted (b-values 50, 800, 1400), and dynamic contrast-enhanced sequences obtained per PI-RADS v2.1 protocol.

COMPARISON: Prior mpMRI dated 06/20/2024.

FINDINGS:
PROSTATE SIZE: 45 cc (4.2 x 3.8 x 3.5 cm). Mildly enlarged.

PERIPHERAL ZONE:
- Right mid-gland (sectors RMPZa/RMPZp): A 1.4 x 1.1 cm lesion demonstrating T2 hypointensity, markedly restricted diffusion (ADC ~650 mm²/s), and early focal enhancement. This lesion has increased in size from 0.9 cm on prior MRI. PI-RADS 4.
- Left apex (sector LAPZp): A 0.7 cm focus of moderate T2 hypointensity with mildly restricted diffusion. Stable compared to prior. PI-RADS 3.

TRANSITION ZONE: Benign prostatic hyperplasia with heterogeneous enhancement. No suspicious lesion (PI-RADS 1).

SEMINAL VESICLES: Normal signal bilaterally. No invasion.
EXTRAPROSTATIC EXTENSION: No definite extraprostatic extension.
LYMPH NODES: No suspicious pelvic lymphadenopathy.
BONES: No suspicious osseous lesions in the field of view.

IMPRESSION:
1. Right mid-gland peripheral zone lesion, PI-RADS 4, increased in size from prior MRI. Targeted biopsy recommended.
2. Left apical peripheral zone focus, PI-RADS 3, stable. Consider targeted biopsy.
3. No evidence of extraprostatic extension, seminal vesicle invasion, or distant disease.`,
    },
  ],

  priorPathology: [
    {
      id: 'pp-0007-001',
      caseId: 'S22-6710',
      reportDate: '2022-04-08',
      specimenType: 'Prostate, needle biopsy',
      anatomicSite: 'Prostate',
      diagnosisSummary: 'Gleason 3+3=6 (Grade Group 1), 1/12 cores positive',
      relevance: 'SUPPORTING',
      body: `SURGICAL PATHOLOGY REPORT

CASE: S22-6710
DATE REPORTED: 04/08/2022
PATHOLOGIST: Dr. Hlemsesor

CLINICAL INFORMATION: 68 y/o male, PSA 4.2 ng/mL (first elevation). TRUS-guided 12-core biopsy.

SPECIMENS SUBMITTED:
A-F: Right base, right mid, right apex, left base, left mid, left apex (2 cores each)

FINAL DIAGNOSIS:

Part A (Right prostate base): Benign prostatic tissue.
Part B (Right prostate mid): Prostatic adenocarcinoma, Gleason score 3+3=6 (Grade Group 1). Tumor involves 5% of one core (2 mm of 40 mm total tissue). No perineural invasion.
Part C (Right prostate apex): Benign prostatic tissue.
Part D (Left prostate base): Benign prostatic tissue.
Part E (Left prostate mid): Benign prostatic tissue with focal atrophy.
Part F (Left prostate apex): Benign prostatic tissue.

SUMMARY: Adenocarcinoma, Gleason 3+3=6, identified in 1 of 12 cores (right mid). Low-volume disease. Active surveillance criteria met per NCCN guidelines.`,
    },
    {
      id: 'pp-0007-002',
      caseId: 'S23-8442',
      reportDate: '2023-10-22',
      specimenType: 'Prostate, needle biopsy',
      anatomicSite: 'Prostate',
      diagnosisSummary: 'Gleason 3+3=6 (Grade Group 1), 1/12 cores positive',
      relevance: 'SUPPORTING',
      body: `SURGICAL PATHOLOGY REPORT

CASE: S23-8442
DATE REPORTED: 10/22/2023
PATHOLOGIST: Dr. Hlemsesor

CLINICAL INFORMATION: 69 y/o male on active surveillance, PSA 5.1 ng/mL (stable). Surveillance biopsy, 12-core systematic + 2 MRI-targeted cores to right mid-gland.

SPECIMENS SUBMITTED:
A-F: Systematic 12-core (right base, right mid, right apex, left base, left mid, left apex)
G: MRI target #1 (right mid, PI-RADS 3 lesion)

FINAL DIAGNOSIS:

Parts A-C (Right systematic): Benign prostatic tissue.
Part D (Left base): Benign prostatic tissue.
Part E (Left mid): Benign prostatic tissue.
Part F (Left apex): Benign prostatic tissue with high-grade PIN. No invasive carcinoma.
Part G (MRI target, right mid): Prostatic adenocarcinoma, Gleason score 3+3=6 (Grade Group 1). Tumor involves 8% of one core (3 mm of 38 mm). No perineural invasion. No lymphovascular invasion.

SUMMARY: Persistent low-grade, low-volume adenocarcinoma in the right mid-gland corresponding to the MRI target. Continues to meet active surveillance criteria.`,
    },
    {
      id: 'pp-0007-003',
      caseId: 'S25-0190',
      reportDate: '2025-01-14',
      specimenType: 'Prostate, needle biopsy',
      anatomicSite: 'Prostate',
      diagnosisSummary: 'Gleason 3+3=6 (Grade Group 1), 2/14 cores positive',
      relevance: 'PRIMARY',
      body: `SURGICAL PATHOLOGY REPORT

CASE: S25-0190
DATE REPORTED: 01/14/2025
PATHOLOGIST: Dr. Bmodeswuv

CLINICAL INFORMATION: 71 y/o male on active surveillance, PSA 6.5 ng/mL (slow rise). Surveillance biopsy, 12-core systematic + 2 MRI-targeted cores.

SPECIMENS SUBMITTED:
A-F: Systematic 12-core
G: MRI target #1 (right mid, PI-RADS 3 lesion)
H: MRI target #2 (left apex, PI-RADS 3 lesion)

FINAL DIAGNOSIS:

Part A (Right base): Benign prostatic tissue.
Part B (Right mid): Prostatic adenocarcinoma, Gleason score 3+3=6 (Grade Group 1). Tumor involves 10% of one core (4 mm of 42 mm). No perineural invasion.
Part C (Right apex): Benign prostatic tissue.
Part D (Left base): Benign prostatic tissue.
Part E (Left mid): Benign prostatic tissue.
Part F (Left apex): Benign prostatic tissue.
Part G (MRI target, right mid): Prostatic adenocarcinoma, Gleason score 3+3=6 (Grade Group 1). Tumor involves 15% of one core (6 mm of 40 mm). Perineural invasion identified.
Part H (MRI target, left apex): Benign prostatic tissue with atrophy.

SUMMARY: Persistent adenocarcinoma, Gleason 3+3=6, now identified in 2 of 14 cores (right mid systematic and right mid MRI target). Slight increase in tumor volume compared to prior biopsies. Note perineural invasion in targeted core. Continued surveillance versus intervention should be discussed with patient.`,
    },
  ],
};


// ==========================================================================
// CASE 5: S26-0008 — Thyroid lobectomy
// Critical prior: FNA Bethesda IV is the key piece of clinical context
// ==========================================================================

export const clinicalS26_0008: ClinicalContextBundle = {
  caseId: 'S26-0008',
  patientMrn: 'XN-000061',

  surgicalNotes: [
    {
      id: 'sn-0008-001',
      reportType: 'OPERATIVE_NOTE',
      reportDate: '2026-02-03',
      sourceSystem: 'Epic',
      title: 'Right Thyroid Lobectomy',
      relevance: 'PRIMARY',
      summary: null,
      body: `OPERATIVE REPORT

DATE OF PROCEDURE: 02/03/2026
SURGEON: Dr. Karen Tanaka, MD, FACS
ASSISTANT: Dr. Lisa Okonkwo, MD

PREOPERATIVE DIAGNOSIS: Right thyroid nodule, Bethesda IV (suspicious for follicular neoplasm)

POSTOPERATIVE DIAGNOSIS: Same, pending final pathology

OPERATION: Right thyroid lobectomy and isthmusectomy

ANESTHESIA: General endotracheal

INDICATIONS: This is a 54-year-old male with a 2.8 cm right thyroid nodule identified on ultrasound performed for palpable thyroid enlargement. FNA cytology returned Bethesda category IV (suspicious for follicular neoplasm). After discussion of options including surveillance, lobectomy, and total thyroidectomy, the patient elected diagnostic lobectomy. Risks including recurrent laryngeal nerve injury, hypoparathyroidism, bleeding, and need for completion thyroidectomy were discussed.

OPERATIVE FINDINGS: The right thyroid lobe was moderately enlarged with a firm, well-circumscribed nodule in the mid-to-lower pole. No extrathyroidal extension was grossly apparent. The recurrent laryngeal nerve was identified and preserved. The superior and inferior parathyroid glands on the right were identified and preserved with their blood supply.

PROCEDURE: A 5-cm low collar incision was made and deepened through platysma. Subplatysmal flaps were raised superiorly and inferiorly. The strap muscles were separated in the midline and retracted laterally. The right thyroid lobe was mobilized. The middle thyroid vein was ligated and divided. The superior thyroid artery and vein were individually ligated and divided close to the thyroid capsule to protect the external branch of the superior laryngeal nerve. The inferior thyroid artery was ligated. The recurrent laryngeal nerve was identified in the tracheoesophageal groove and traced to its entry into the larynx, confirming preservation. The right superior and inferior parathyroid glands were identified and preserved. The isthmus was divided, and the right lobe was dissected free from the trachea and removed.

The specimen was oriented and submitted to pathology fresh for possible intraoperative consultation (declined by attending pathologist — deferred to permanent sections given the need for thorough capsular evaluation).

Hemostasis was achieved. A small drain was placed. The wound was closed in layers.

SPECIMENS: Right thyroid lobe with isthmus, oriented.

EBL: 30 mL
COMPLICATIONS: None. Nerve monitor confirmed intact RLN signal at end of case.
DISPOSITION: PACU in stable condition.`,
    },
  ],

  radiologyReports: [
    {
      id: 'rad-0008-001',
      reportType: 'RADIOLOGY',
      reportDate: '2025-11-18',
      sourceSystem: 'Epic',
      title: 'Ultrasound Thyroid',
      relevance: 'PRIMARY',
      summary: null,
      body: `RADIOLOGY REPORT

EXAM: Ultrasound, Thyroid
DATE: 11/18/2025
ORDERING PHYSICIAN: Dr. Margaret Liu, MD (Endocrinology)
RADIOLOGIST: Dr. Steven Lee, MD

CLINICAL INDICATION: Palpable right thyroid enlargement. Evaluate for nodules. TSH normal.

TECHNIQUE: High-resolution ultrasound of the thyroid gland and central neck was performed.

COMPARISON: None available.

FINDINGS:

RIGHT LOBE: Measures 5.2 x 2.4 x 2.1 cm (mildly enlarged). A predominantly solid, hypoechoic nodule measuring 2.8 x 2.1 x 1.9 cm is identified in the mid-to-lower pole. The nodule has smooth margins, a thin hypoechoic halo, and no calcifications. Internal vascularity is present on color Doppler. No extrathyroidal extension.
ACR TI-RADS: TR4 (mildly suspicious) — hypoechoic, solid, wider-than-tall: absent, smooth margins. Score: 4 points. Size threshold for FNA: ≥1.5 cm. FNA recommended.

LEFT LOBE: Measures 4.0 x 1.5 x 1.4 cm (normal). A 6 mm isoechoic nodule in the upper pole. Likely benign. Below size threshold for biopsy (TR3, <2.5 cm).

ISTHMUS: 3 mm, normal.

LYMPH NODES: Bilateral cervical lymph nodes appear reactive and morphologically normal. No suspicious features (no microcalcifications, cystic change, or abnormal vascularity).

IMPRESSION:
1. Right mid-to-lower pole thyroid nodule, 2.8 cm, TI-RADS 4. FNA recommended.
2. Small left upper pole nodule, 6 mm, likely benign. No biopsy indicated.
3. No suspicious cervical lymphadenopathy.`,
    },
  ],

  priorPathology: [
    {
      id: 'pp-0008-001',
      caseId: 'C25-4220',
      reportDate: '2025-12-02',
      specimenType: 'Thyroid, right, FNA',
      anatomicSite: 'Thyroid, right lobe',
      diagnosisSummary: 'Bethesda IV — Follicular neoplasm / suspicious for follicular neoplasm',
      relevance: 'PRIMARY',
      body: `CYTOPATHOLOGY REPORT

CASE: C25-4220
DATE REPORTED: 12/02/2025
PATHOLOGIST: Dr. Hlemsesor

CLINICAL INFORMATION: 2.8 cm right thyroid nodule, TI-RADS 4. US-guided FNA.

SPECIMEN: Right thyroid nodule, FNA (3 passes)

ADEQUACY: Satisfactory for evaluation. Six or more groups of well-preserved follicular cells obtained.

DESCRIPTION: Smears show a cellular specimen composed of repetitive microfollicular groups and clusters of follicular cells with scant colloid. The cells display mild nuclear enlargement with occasional small nucleoli. There is a suggestion of trabecular architecture in some groups. No papillary nuclear features (grooves, pseudoinclusions) are identified. No Hürthle cell change.

DIAGNOSIS: Follicular neoplasm / Suspicious for a follicular neoplasm.
Bethesda System Category IV.

COMMENT: The microfollicular pattern and absence of colloid raise concern for a follicular neoplasm. Distinction between follicular adenoma and follicular carcinoma requires histologic evaluation of capsular and/or vascular invasion. Surgical excision (lobectomy) is recommended for definitive diagnosis. Molecular testing (e.g., Afirma, ThyroSeq) may be considered if the patient desires further risk stratification prior to surgery.`,
    },
  ],
};


// ==========================================================================
// Index by caseId for mock handler lookup
// ==========================================================================

export const clinicalFixtureIndex: Record<string, ClinicalContextBundle> = {
  'S26-0004': clinicalS26_0004,
  'S26-0005': clinicalS26_0005,
  'S26-0006': clinicalS26_0006,
  'S26-0007': clinicalS26_0007,
  'S26-0008': clinicalS26_0008,
};
