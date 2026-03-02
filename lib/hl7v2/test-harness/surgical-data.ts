/**
 * Surgical Data Pools for SIU Message Generation
 *
 * Realistic data organized by specialty for generating test HL7v2 messages.
 * Each procedure includes CPT code, matching ICD-10 diagnosis, and typical duration.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProcedureData {
  cptCode: string;
  name: string;
  icd10Code: string;
  icd10Description: string;
  typicalDurationMinutes: number;
  specialty: Specialty;
}

export interface SurgeonData {
  id: string;
  firstName: string;
  lastName: string;
  middleInitial: string;
  suffix: string;
  npi: string;
  specialty: Specialty;
}

export interface PatientData {
  mrn: string;
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string; // YYYYMMDD
  gender: 'M' | 'F';
  street: string;
  city: string;
  state: string;
  zip: string;
  homePhone: string;
  accountNumber: string;
}

export interface ORRoomData {
  code: string;
  description: string;
  facility: string;
}

export type Specialty =
  | 'orthopedics'
  | 'ophthalmology'
  | 'gi'
  | 'spine'
  | 'general';

export const ALL_SPECIALTIES: Specialty[] = [
  'orthopedics',
  'ophthalmology',
  'gi',
  'spine',
  'general',
];

// ── Procedure Pools by Specialty ─────────────────────────────────────────────

export const PROCEDURES: ProcedureData[] = [
  // Orthopedics
  {
    cptCode: '27447',
    name: 'Total knee arthroplasty',
    icd10Code: 'M17.11',
    icd10Description: 'Primary osteoarthritis, right knee',
    typicalDurationMinutes: 120,
    specialty: 'orthopedics',
  },
  {
    cptCode: '27130',
    name: 'Total hip arthroplasty',
    icd10Code: 'M16.11',
    icd10Description: 'Primary osteoarthritis, right hip',
    typicalDurationMinutes: 150,
    specialty: 'orthopedics',
  },
  {
    cptCode: '29888',
    name: 'ACL reconstruction',
    icd10Code: 'S83.511A',
    icd10Description: 'Sprain of anterior cruciate ligament of right knee',
    typicalDurationMinutes: 90,
    specialty: 'orthopedics',
  },
  {
    cptCode: '29827',
    name: 'Rotator cuff repair',
    icd10Code: 'M75.110',
    icd10Description: 'Incomplete rotator cuff tear of right shoulder',
    typicalDurationMinutes: 105,
    specialty: 'orthopedics',
  },
  {
    cptCode: '64721',
    name: 'Carpal tunnel release',
    icd10Code: 'G56.00',
    icd10Description: 'Carpal tunnel syndrome, unspecified upper limb',
    typicalDurationMinutes: 30,
    specialty: 'orthopedics',
  },

  // Ophthalmology
  {
    cptCode: '66984',
    name: 'Cataract surgery with IOL',
    icd10Code: 'H25.11',
    icd10Description: 'Age-related nuclear cataract, right eye',
    typicalDurationMinutes: 25,
    specialty: 'ophthalmology',
  },
  {
    cptCode: '67036',
    name: 'Pars plana vitrectomy',
    icd10Code: 'H43.11',
    icd10Description: 'Vitreous hemorrhage, right eye',
    typicalDurationMinutes: 90,
    specialty: 'ophthalmology',
  },
  {
    cptCode: '66170',
    name: 'Trabeculectomy',
    icd10Code: 'H40.1111',
    icd10Description: 'Primary open-angle glaucoma, right eye, mild stage',
    typicalDurationMinutes: 60,
    specialty: 'ophthalmology',
  },

  // GI
  {
    cptCode: '45378',
    name: 'Colonoscopy diagnostic',
    icd10Code: 'K63.5',
    icd10Description: 'Polyp of colon',
    typicalDurationMinutes: 30,
    specialty: 'gi',
  },
  {
    cptCode: '43239',
    name: 'Upper endoscopy with biopsy',
    icd10Code: 'K21.0',
    icd10Description: 'Gastro-esophageal reflux disease with esophagitis',
    typicalDurationMinutes: 25,
    specialty: 'gi',
  },
  {
    cptCode: '47562',
    name: 'Laparoscopic cholecystectomy',
    icd10Code: 'K80.20',
    icd10Description: 'Calculus of gallbladder without cholecystitis',
    typicalDurationMinutes: 60,
    specialty: 'gi',
  },

  // Spine
  {
    cptCode: '22612',
    name: 'Posterior lumbar interbody fusion',
    icd10Code: 'M47.816',
    icd10Description: 'Spondylosis without myelopathy, lumbar region',
    typicalDurationMinutes: 240,
    specialty: 'spine',
  },
  {
    cptCode: '63075',
    name: 'Anterior cervical discectomy',
    icd10Code: 'M50.121',
    icd10Description: 'Cervical disc disorder at C4-C5 level with radiculopathy',
    typicalDurationMinutes: 120,
    specialty: 'spine',
  },
  {
    cptCode: '63047',
    name: 'Lumbar laminectomy',
    icd10Code: 'M48.06',
    icd10Description: 'Spinal stenosis, lumbar region',
    typicalDurationMinutes: 150,
    specialty: 'spine',
  },

  // General Surgery
  {
    cptCode: '49650',
    name: 'Laparoscopic inguinal hernia repair',
    icd10Code: 'K40.90',
    icd10Description: 'Unilateral inguinal hernia without obstruction or gangrene',
    typicalDurationMinutes: 60,
    specialty: 'general',
  },
  {
    cptCode: '44970',
    name: 'Laparoscopic appendectomy',
    icd10Code: 'K35.80',
    icd10Description: 'Unspecified acute appendicitis',
    typicalDurationMinutes: 45,
    specialty: 'general',
  },
];

// ── Surgeon Pool ─────────────────────────────────────────────────────────────

export const SURGEONS: SurgeonData[] = [
  // Orthopedics
  {
    id: '1001',
    firstName: 'JOHN',
    lastName: 'SMITH',
    middleInitial: 'A',
    suffix: 'MD',
    npi: '1234567890',
    specialty: 'orthopedics',
  },
  {
    id: '1002',
    firstName: 'SARAH',
    lastName: 'CHEN',
    middleInitial: 'L',
    suffix: 'MD',
    npi: '1234567891',
    specialty: 'orthopedics',
  },

  // Ophthalmology
  {
    id: '2001',
    firstName: 'MICHAEL',
    lastName: 'PATEL',
    middleInitial: 'R',
    suffix: 'MD',
    npi: '2345678901',
    specialty: 'ophthalmology',
  },
  {
    id: '2002',
    firstName: 'LISA',
    lastName: 'WONG',
    middleInitial: 'K',
    suffix: 'MD',
    npi: '2345678902',
    specialty: 'ophthalmology',
  },

  // GI
  {
    id: '3001',
    firstName: 'DAVID',
    lastName: 'GARCIA',
    middleInitial: 'M',
    suffix: 'MD',
    npi: '3456789012',
    specialty: 'gi',
  },
  {
    id: '3002',
    firstName: 'JENNIFER',
    lastName: 'THOMPSON',
    middleInitial: 'A',
    suffix: 'DO',
    npi: '3456789013',
    specialty: 'gi',
  },

  // Spine
  {
    id: '4001',
    firstName: 'ROBERT',
    lastName: 'NGUYEN',
    middleInitial: 'T',
    suffix: 'MD',
    npi: '4567890123',
    specialty: 'spine',
  },
  {
    id: '4002',
    firstName: 'AMANDA',
    lastName: 'WILSON',
    middleInitial: 'J',
    suffix: 'MD',
    npi: '4567890124',
    specialty: 'spine',
  },

  // General
  {
    id: '5001',
    firstName: 'JAMES',
    lastName: 'MARTINEZ',
    middleInitial: 'P',
    suffix: 'MD',
    npi: '5678901234',
    specialty: 'general',
  },
  {
    id: '5002',
    firstName: 'EMILY',
    lastName: 'BROWN',
    middleInitial: 'R',
    suffix: 'DO',
    npi: '5678901235',
    specialty: 'general',
  },
];

// ── Anesthesiologist Pool ────────────────────────────────────────────────────

export const ANESTHESIOLOGISTS: SurgeonData[] = [
  {
    id: '6001',
    firstName: 'MARIA',
    lastName: 'JONES',
    middleInitial: 'L',
    suffix: 'MD',
    npi: '6789012345',
    specialty: 'general',
  },
  {
    id: '6002',
    firstName: 'THOMAS',
    lastName: 'ANDERSON',
    middleInitial: 'E',
    suffix: 'MD',
    npi: '6789012346',
    specialty: 'general',
  },
  {
    id: '6003',
    firstName: 'KAREN',
    lastName: 'DAVIS',
    middleInitial: 'S',
    suffix: 'DO',
    npi: '6789012347',
    specialty: 'general',
  },
];

// ── Patient Pool ─────────────────────────────────────────────────────────────

export const PATIENTS: PatientData[] = [
  {
    mrn: 'MRN10001',
    firstName: 'JANE',
    lastName: 'DOE',
    middleName: 'M',
    dateOfBirth: '19650415',
    gender: 'F',
    street: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    zip: '62704',
    homePhone: '(217)555-0123',
    accountNumber: 'ACCT10001',
  },
  {
    mrn: 'MRN10002',
    firstName: 'ROBERT',
    lastName: 'JOHNSON',
    middleName: 'A',
    dateOfBirth: '19720823',
    gender: 'M',
    street: '456 Oak Ave',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    homePhone: '(217)555-0456',
    accountNumber: 'ACCT10002',
  },
  {
    mrn: 'MRN10003',
    firstName: 'MARIA',
    lastName: 'GONZALEZ',
    middleName: 'T',
    dateOfBirth: '19580112',
    gender: 'F',
    street: '789 Elm Dr',
    city: 'Decatur',
    state: 'IL',
    zip: '62521',
    homePhone: '(217)555-0789',
    accountNumber: 'ACCT10003',
  },
  {
    mrn: 'MRN10004',
    firstName: 'WILLIAM',
    lastName: 'TAYLOR',
    middleName: 'J',
    dateOfBirth: '19800607',
    gender: 'M',
    street: '321 Pine Ln',
    city: 'Champaign',
    state: 'IL',
    zip: '61820',
    homePhone: '(217)555-1234',
    accountNumber: 'ACCT10004',
  },
  {
    mrn: 'MRN10005',
    firstName: 'PATRICIA',
    lastName: 'ANDERSON',
    middleName: 'R',
    dateOfBirth: '19470930',
    gender: 'F',
    street: '654 Maple Ct',
    city: 'Springfield',
    state: 'IL',
    zip: '62703',
    homePhone: '(217)555-5678',
    accountNumber: 'ACCT10005',
  },
  {
    mrn: 'MRN10006',
    firstName: 'THOMAS',
    lastName: 'JACKSON',
    middleName: 'D',
    dateOfBirth: '19630218',
    gender: 'M',
    street: '987 Cedar Rd',
    city: 'Bloomington',
    state: 'IL',
    zip: '61701',
    homePhone: '(309)555-9012',
    accountNumber: 'ACCT10006',
  },
  {
    mrn: 'MRN10007',
    firstName: 'SUSAN',
    lastName: 'WHITE',
    middleName: 'K',
    dateOfBirth: '19750511',
    gender: 'F',
    street: '159 Birch Way',
    city: 'Peoria',
    state: 'IL',
    zip: '61602',
    homePhone: '(309)555-3456',
    accountNumber: 'ACCT10007',
  },
  {
    mrn: 'MRN10008',
    firstName: 'CHARLES',
    lastName: 'HARRIS',
    middleName: 'B',
    dateOfBirth: '19880903',
    gender: 'M',
    street: '753 Walnut St',
    city: 'Springfield',
    state: 'IL',
    zip: '62702',
    homePhone: '(217)555-7890',
    accountNumber: 'ACCT10008',
  },
  {
    mrn: 'MRN10009',
    firstName: 'ELIZABETH',
    lastName: 'CLARK',
    middleName: 'A',
    dateOfBirth: '19550726',
    gender: 'F',
    street: '246 Ash Blvd',
    city: 'Decatur',
    state: 'IL',
    zip: '62526',
    homePhone: '(217)555-2345',
    accountNumber: 'ACCT10009',
  },
  {
    mrn: 'MRN10010',
    firstName: 'DANIEL',
    lastName: 'LEWIS',
    middleName: 'W',
    dateOfBirth: '19700104',
    gender: 'M',
    street: '852 Poplar Ave',
    city: 'Normal',
    state: 'IL',
    zip: '61761',
    homePhone: '(309)555-6789',
    accountNumber: 'ACCT10010',
  },
  {
    mrn: 'MRN10011',
    firstName: 'MARGARET',
    lastName: 'ROBINSON',
    middleName: 'E',
    dateOfBirth: '19830319',
    gender: 'F',
    street: '468 Spruce Dr',
    city: 'Springfield',
    state: 'IL',
    zip: '62704',
    homePhone: '(217)555-0147',
    accountNumber: 'ACCT10011',
  },
  {
    mrn: 'MRN10012',
    firstName: 'JOSEPH',
    lastName: 'WALKER',
    middleName: 'C',
    dateOfBirth: '19610812',
    gender: 'M',
    street: '135 Hickory Pl',
    city: 'Champaign',
    state: 'IL',
    zip: '61821',
    homePhone: '(217)555-8520',
    accountNumber: 'ACCT10012',
  },
  {
    mrn: 'MRN10013',
    firstName: 'DOROTHY',
    lastName: 'HALL',
    middleName: 'N',
    dateOfBirth: '19490505',
    gender: 'F',
    street: '792 Sycamore Ln',
    city: 'Bloomington',
    state: 'IL',
    zip: '61704',
    homePhone: '(309)555-3691',
    accountNumber: 'ACCT10013',
  },
  {
    mrn: 'MRN10014',
    firstName: 'RICHARD',
    lastName: 'ALLEN',
    middleName: 'F',
    dateOfBirth: '19780621',
    gender: 'M',
    street: '369 Chestnut Ave',
    city: 'Peoria',
    state: 'IL',
    zip: '61603',
    homePhone: '(309)555-7413',
    accountNumber: 'ACCT10014',
  },
  {
    mrn: 'MRN10015',
    firstName: 'HELEN',
    lastName: 'YOUNG',
    middleName: 'G',
    dateOfBirth: '19520917',
    gender: 'F',
    street: '951 Willow St',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    homePhone: '(217)555-9630',
    accountNumber: 'ACCT10015',
  },
  {
    mrn: 'MRN10016',
    firstName: 'KENNETH',
    lastName: 'KING',
    middleName: 'H',
    dateOfBirth: '19850214',
    gender: 'M',
    street: '573 Linden Rd',
    city: 'Decatur',
    state: 'IL',
    zip: '62522',
    homePhone: '(217)555-8524',
    accountNumber: 'ACCT10016',
  },
  {
    mrn: 'MRN10017',
    firstName: 'CAROL',
    lastName: 'WRIGHT',
    middleName: 'P',
    dateOfBirth: '19670803',
    gender: 'F',
    street: '684 Magnolia Dr',
    city: 'Normal',
    state: 'IL',
    zip: '61761',
    homePhone: '(309)555-1470',
    accountNumber: 'ACCT10017',
  },
  {
    mrn: 'MRN10018',
    firstName: 'GEORGE',
    lastName: 'LOPEZ',
    middleName: 'S',
    dateOfBirth: '19730129',
    gender: 'M',
    street: '426 Dogwood Ct',
    city: 'Champaign',
    state: 'IL',
    zip: '61822',
    homePhone: '(217)555-2580',
    accountNumber: 'ACCT10018',
  },
  {
    mrn: 'MRN10019',
    firstName: 'RUTH',
    lastName: 'HILL',
    middleName: 'V',
    dateOfBirth: '19560410',
    gender: 'F',
    street: '318 Redwood Ave',
    city: 'Springfield',
    state: 'IL',
    zip: '62703',
    homePhone: '(217)555-3690',
    accountNumber: 'ACCT10019',
  },
  {
    mrn: 'MRN10020',
    firstName: 'EDWARD',
    lastName: 'SCOTT',
    middleName: 'L',
    dateOfBirth: '19810716',
    gender: 'M',
    street: '147 Cypress Ln',
    city: 'Peoria',
    state: 'IL',
    zip: '61604',
    homePhone: '(309)555-4812',
    accountNumber: 'ACCT10020',
  },
];

// ── OR Room Pool ─────────────────────────────────────────────────────────────

export const OR_ROOMS: ORRoomData[] = [
  { code: 'OR1', description: 'Operating Room 1', facility: 'SURGERY_CENTER' },
  { code: 'OR2', description: 'Operating Room 2', facility: 'SURGERY_CENTER' },
  { code: 'OR3', description: 'Operating Room 3', facility: 'SURGERY_CENTER' },
  { code: 'OR4', description: 'Operating Room 4', facility: 'SURGERY_CENTER' },
  { code: 'OR5', description: 'Operating Room 5', facility: 'SURGERY_CENTER' },
  { code: 'OR6', description: 'Operating Room 6', facility: 'SURGERY_CENTER' },
];

// ── Selection Helpers ────────────────────────────────────────────────────────

/** Get procedures filtered by specialties */
export function getProceduresBySpecialty(specialties: Specialty[]): ProcedureData[] {
  return PROCEDURES.filter((p) => specialties.includes(p.specialty));
}

/** Get surgeons filtered by specialties */
export function getSurgeonsBySpecialty(specialties: Specialty[]): SurgeonData[] {
  return SURGEONS.filter((s) => specialties.includes(s.specialty));
}

/** Pick a random element from an array using a seeded index */
export function pickRandom<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/** Shuffle array using Fisher-Yates with a simple seed */
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
