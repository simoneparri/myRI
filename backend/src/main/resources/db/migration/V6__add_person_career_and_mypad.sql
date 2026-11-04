ALTER TABLE person
    ADD COLUMN career_started_on DATE NULL,
    ADD COLUMN seniority_level VARCHAR(10) NULL,
    ADD COLUMN mypad_id VARCHAR(100) NULL,
    ADD CONSTRAINT ck_person_career_start CHECK (
        career_started_on IS NULL OR career_started_on <= hired_on
    ),
    ADD CONSTRAINT ck_person_seniority_level CHECK (
        seniority_level IS NULL OR seniority_level IN ('junior', 'medior', 'senior')
    ),
    ADD CONSTRAINT ck_person_mypad_id CHECK (
        mypad_id IS NULL OR REGEXP_LIKE(mypad_id, '^[A-Za-z0-9_-]+$', 'c')
    ),
    ADD UNIQUE INDEX uk_person_mypad_id (mypad_id);
