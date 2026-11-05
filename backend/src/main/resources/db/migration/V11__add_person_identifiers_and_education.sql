ALTER TABLE person
    ADD COLUMN rsno_agresso VARCHAR(100) NULL,
    ADD COLUMN inside_id VARCHAR(100) NULL,
    ADD COLUMN education VARCHAR(20) NULL,
    ADD CONSTRAINT uk_person_rsno_agresso UNIQUE (rsno_agresso),
    ADD CONSTRAINT uk_person_inside_id UNIQUE (inside_id),
    ADD CONSTRAINT chk_person_education
        CHECK (education IN ('diploma', 'bachelor', 'master', 'phd'));
