CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  id_number text,
  passport_number text,
  date_of_birth date,
  gender text,
  nationality text,
  race text,
  disability_status text,
  address_line1 text,
  address_line2 text,
  city text,
  province text,
  postal_code text,
  postal_address_line1 text,
  postal_address_line2 text,
  postal_city text,
  postal_province text,
  postal_postal_code text,
  phone text,
  alt_phone text,
  email citext,
  drivers_licence_codes text[],
  professional_registrations text[],
  current_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE profile_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles
  ADD CONSTRAINT fk_profiles_current_version
  FOREIGN KEY (current_version_id) REFERENCES profile_versions(id) ON DELETE SET NULL;

CREATE INDEX idx_profile_versions_profile ON profile_versions(profile_id);

CREATE TABLE qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  institution text NOT NULL,
  qualification_name text NOT NULL,
  field_of_study text,
  nqf_level smallint,
  year_completed smallint,
  still_studying boolean NOT NULL DEFAULT false,
  order_index smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_qualifications_profile ON qualifications(profile_id);

CREATE TABLE work_experience (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  employer text NOT NULL,
  job_title text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  is_current boolean NOT NULL DEFAULT false,
  responsibilities text,
  order_index smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_experience_profile ON work_experience(profile_id);

CREATE TABLE languages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  language text NOT NULL,
  speak_level text NOT NULL CHECK (speak_level IN ('poor', 'fair', 'good')),
  read_level text NOT NULL CHECK (read_level IN ('poor', 'fair', 'good')),
  write_level text NOT NULL CHECK (write_level IN ('poor', 'fair', 'good')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_languages_profile ON languages(profile_id);

-- Spec entity name is "references"; reserved word in SQL, so this table is
-- applicant_references. See docs/DATABASE.md.
CREATE TABLE applicant_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  relationship text,
  organisation text,
  phone text,
  email citext,
  order_index smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_applicant_references_profile ON applicant_references(profile_id);
