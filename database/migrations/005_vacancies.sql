CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE circulars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circular_number text NOT NULL,
  publication_date date NOT NULL,
  source_url text,
  source_document_key text,
  ingestion_method text NOT NULL CHECK (ingestion_method IN ('automatic', 'manual_upload')),
  status text NOT NULL CHECK (status IN ('collected', 'processing', 'processed', 'failed')) DEFAULT 'collected',
  uploaded_by_admin_id uuid REFERENCES admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_circulars_number ON circulars(circular_number);

CREATE TABLE vacancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circular_id uuid NOT NULL REFERENCES circulars(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id),
  job_title text NOT NULL,
  reference_number text NOT NULL,
  salary_text text,
  province text,
  location_text text,
  page_number integer,
  closing_at timestamptz,
  submission_method text NOT NULL CHECK (submission_method IN ('email', 'hand_delivery', 'online', 'either')),
  submission_email citext,
  submission_address text,
  special_instructions text,
  raw_extracted_text text,
  status text NOT NULL CHECK (status IN ('pending_verification', 'published', 'closed', 'rejected')) DEFAULT 'pending_verification',
  verified_by_admin_id uuid REFERENCES admin_users(id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vacancies_status ON vacancies(status);
CREATE INDEX idx_vacancies_circular ON vacancies(circular_id);
CREATE INDEX idx_vacancies_department ON vacancies(department_id);

CREATE TABLE vacancy_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id uuid NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  requirement_type text NOT NULL CHECK (requirement_type IN (
    'qualification', 'experience_years', 'drivers_licence',
    'professional_registration', 'competency', 'other'
  )),
  description text NOT NULL,
  minimum_value text,
  is_mandatory boolean NOT NULL DEFAULT true,
  order_index smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vacancy_requirements_vacancy ON vacancy_requirements(vacancy_id);
